import { getMosTypes, IMOSObjectStatus, IMOSStoryStatus, MosTypes, type IMOSDevice } from '@mos-connection/connector'
import type { MosDeviceStatusesConfig } from './generated/devices'
import type { CoreMosDeviceHandler } from './CoreMosDeviceHandler'
import {
	type Observer,
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
	stringifyError,
	SubscriptionId,
} from '@sofie-automation/server-core-integration'
import {
	IngestPartPlaybackStatus,
	type IngestPartStatus,
	type IngestRundownStatus,
} from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import type { RundownId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import type winston = require('winston')
import { Queue } from '@sofie-automation/server-core-integration/dist/lib/queue'

const MOS_STATUS_UNKNOWN = '' as IMOSObjectStatus // Force the status to be empty, which isn't a valid state in the enum

export class MosStatusHandler {
	readonly #logger: winston.Logger
	readonly #mosDevice: IMOSDevice
	readonly #coreMosHandler: CoreMosDeviceHandler
	readonly #config: MosDeviceStatusesConfig
	readonly #mosTypes: MosTypes

	readonly #messageQueue = new Queue()

	#subId: SubscriptionId | undefined
	#observer: Observer<IngestRundownStatus> | undefined

	#destroyed = false

	readonly #lastStatuses = new Map<RundownId, IngestRundownStatus>()

	constructor(
		logger: winston.Logger,
		mosDevice: IMOSDevice,
		coreMosHandler: CoreMosDeviceHandler,
		config: MosDeviceStatusesConfig,
		strictMosTypes: boolean
	) {
		if (!config.enabled) throw new Error('MosStatusHandler is not enabled')

		this.#logger = logger
		this.#mosDevice = mosDevice
		this.#coreMosHandler = coreMosHandler
		this.#config = config
		this.#mosTypes = getMosTypes(strictMosTypes)

		coreMosHandler.core
			.autoSubscribe(PeripheralDevicePubSub.ingestDeviceRundownStatus, coreMosHandler.core.deviceId)
			.then((subId) => {
				this.#subId = subId

				if (this.#destroyed) coreMosHandler.core.unsubscribe(subId)
			})
			.catch((e) => {
				this.#logger.error(`Error subscribing to ingestDeviceRundownStatus: ${stringifyError(e)}`)
			})

		// Setup the observer immediately, which will trigger a resync upon the documents being added
		this.#observer = coreMosHandler.core.observe(PeripheralDevicePubSubCollectionsNames.ingestRundownStatus)
		this.#observer.added = (id) => this.#rundownChanged(id)
		this.#observer.changed = (id) => this.#rundownChanged(id)
		this.#observer.removed = (id) => this.#rundownChanged(id)

		this.#logger.info(`MosStatusHandler initialized for ${coreMosHandler.core.deviceId}`)
	}

	#rundownChanged(id: RundownId): void {
		const collection = this.#coreMosHandler.core.getCollection(
			PeripheralDevicePubSubCollectionsNames.ingestRundownStatus
		)

		const newStatuses = collection.findOne(id)
		const previousStatuses = this.#lastStatuses.get(id)

		// Update the last statuses store
		if (newStatuses) {
			this.#lastStatuses.set(id, newStatuses)
		} else {
			this.#lastStatuses.delete(id)
		}

		const statusDiff = diffStatuses(this.#config, previousStatuses, newStatuses)
		if (statusDiff.length === 0) return

		const diffTime = this.#mosTypes.mosTime.create(Date.now())

		// Future: should this be done with some concurrency?
		for (const status of statusDiff) {
			// New implementation 2022 only sends PLAY, never stop, after getting advice from AP
			// Reason 1: NRK ENPS "sendt tid" (elapsed time) stopped working in ENPS 8/9 when doing STOP prior to PLAY
			// Reason 2: there's a delay between the STOP (yellow line disappears) and PLAY (yellow line re-appears), which annoys the users
			if (this.#config.onlySendPlay && status.mosStatus !== IMOSObjectStatus.PLAY) continue

			this.#messageQueue
				.putOnQueue(async () => {
					const newStatus: IMOSStoryStatus = {
						RunningOrderId: this.#mosTypes.mosString128.create(status.rundownExternalId),
						ID: this.#mosTypes.mosString128.create(status.storyId),
						Status: status.mosStatus,
						Time: diffTime,
					}
					this.#logger.info(`Sending Story status: ${JSON.stringify(newStatus)}`)

					if (this.#isDeviceConnected()) {
						// Send status
						await this.#mosDevice.sendStoryStatus(newStatus)
					} else if (this.#config.onlySendPlay) {
						// No need to do anything.
						this.#logger.info(`Not connected, skipping play status: ${JSON.stringify(newStatus)}`)
					} else {
						this.#logger.info(`Not connected, discarding status: ${JSON.stringify(newStatus)}`)
					}
				})
				.catch((e) => {
					this.#logger.error(
						`Error sending of "${status.rundownExternalId}"-"${
							status.storyId
						}" status to MOS device: ${stringifyError(e)}`
					)
				})
		}
	}

	#isDeviceConnected(): boolean {
		return (
			this.#mosDevice.getConnectionStatus().PrimaryConnected ||
			this.#mosDevice.getConnectionStatus().SecondaryConnected
		)
	}

	dispose(): void {
		this.#destroyed = true

		this.#observer?.stop()
		if (this.#subId) this.#coreMosHandler.core.unsubscribe(this.#subId)
	}
}

interface StoryStatusItem {
	rundownExternalId: string
	storyId: string
	mosStatus: IMOSObjectStatus
}

function diffStatuses(
	config: MosDeviceStatusesConfig,
	previousStatuses: IngestRundownStatus | undefined,
	newStatuses: IngestRundownStatus | undefined
): StoryStatusItem[] {
	const rundownExternalId = previousStatuses?.externalId ?? newStatuses?.externalId

	if ((!previousStatuses && !newStatuses) || !rundownExternalId) return []

	const statuses: StoryStatusItem[] = []

	const previousStories = buildStoriesMap(previousStatuses)
	const newStories = buildStoriesMap(newStatuses)

	// Process any removed stories first
	for (const storyId of previousStories.keys()) {
		if (!newStories.has(storyId)) {
			// The story has been removed
			statuses.push({
				rundownExternalId,
				storyId,
				mosStatus: MOS_STATUS_UNKNOWN,
			})
		}
	}

	// Then any remaining stories in order
	for (const [storyId, status] of newStories) {
		const previousStatus = previousStories.get(storyId)

		const newMosStatus = buildMosStatus(config, status, newStatuses?.active)
		if (
			newMosStatus !== null &&
			(!previousStatus || buildMosStatus(config, previousStatus, previousStatuses?.active) !== newMosStatus)
		) {
			statuses.push({
				rundownExternalId,
				storyId,
				mosStatus: newMosStatus,
			})
		}
	}

	return statuses
}

function buildStoriesMap(state: IngestRundownStatus | undefined): Map<string, IngestPartStatus> {
	const stories = new Map<string, IngestPartStatus>()

	if (state) {
		for (const segment of state.segments) {
			for (const part of segment.parts) {
				stories.set(part.externalId, part)
			}
		}
	}

	return stories
}

function buildMosStatus(
	config: MosDeviceStatusesConfig,
	story: IngestPartStatus,
	active: IngestRundownStatus['active'] | undefined
): IMOSObjectStatus | null {
	if (active === 'inactive') return MOS_STATUS_UNKNOWN
	if (active === 'rehearsal' && !config.sendInRehearsal) return null

	switch (story.playbackStatus) {
		case IngestPartPlaybackStatus.PLAY:
			return IMOSObjectStatus.PLAY
		case IngestPartPlaybackStatus.STOP:
			return IMOSObjectStatus.STOP
		default:
			switch (story.isReady) {
				case true:
					return IMOSObjectStatus.READY
				case false:
					return IMOSObjectStatus.NOT_READY
				default:
					return MOS_STATUS_UNKNOWN
			}
	}
}
