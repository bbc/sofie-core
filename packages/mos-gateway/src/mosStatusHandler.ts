import { getMosTypes, IMOSObjectStatus, type IMOSDevice } from '@mos-connection/connector'
import type { MosDeviceStatusesConfig } from './generated/devices'
import type { CoreMosDeviceHandler } from './CoreMosDeviceHandler'
import {
	type Observer,
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
	stringifyError,
	SubscriptionId,
} from '@sofie-automation/server-core-integration'
import type { IngestPartStatus, IngestRundownStatus } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import type { RundownId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import type winston = require('winston')
import { Queue } from '@sofie-automation/server-core-integration/dist/lib/queue'

const MOS_STATUS_UNKNOWN = '' as IMOSObjectStatus // nocommit - check this

const mosTypes = getMosTypes(false)

export class MosStatusHandler {
	readonly #logger: winston.Logger
	readonly #mosDevice: IMOSDevice
	readonly #coreMosHandler: CoreMosDeviceHandler

	readonly #messageQueue = new Queue()

	#subId: SubscriptionId | undefined
	#observer: Observer<IngestRundownStatus> | undefined

	#destroyed = false

	readonly #lastStatuses = new Map<RundownId, IngestRundownStatus>()

	constructor(
		logger: winston.Logger,
		mosDevice: IMOSDevice,
		coreMosHandler: CoreMosDeviceHandler,
		config: MosDeviceStatusesConfig
	) {
		if (!config.enabled) throw new Error('MosStatusHandler is not enabled')

		this.#logger = logger
		this.#mosDevice = mosDevice
		this.#coreMosHandler = coreMosHandler

		coreMosHandler.core
			.autoSubscribe(PeripheralDevicePubSub.ingestDeviceRundownStatus, coreMosHandler.core.deviceId, undefined) // nocommit - does this need a token?
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

		const statusDiff = diffStatuses(previousStatuses, newStatuses)
		if (statusDiff.length === 0) return

		const diffTime = mosTypes.mosTime.create(Date.now())

		// nocommit - should this be done with some concurrency?
		for (const status of statusDiff) {
			this.#messageQueue
				.putOnQueue(async () => {
					// Send status
					await this.#mosDevice.sendStoryStatus({
						RunningOrderId: mosTypes.mosString128.create(status.rundownExternalId),
						ID: mosTypes.mosString128.create(status.storyId),
						Status: status.mosStatus,
						Time: diffTime,
					})
				})
				.catch((e) => {
					this.#logger.error(
						`Error sending of "${status.rundownExternalId}"-"${
							status.storyId
						}" status to MOS device: ${stringifyError(e)}`
					)
				})
		}

		throw new Error('Method not implemented.')
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

		const newMosStatus = buildMosStatus(status)
		if (!previousStatus || buildMosStatus(previousStatus) !== newMosStatus) {
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

function buildMosStatus(story: IngestPartStatus): IMOSObjectStatus {
	switch (story.playbackStatus) {
		case 'playing':
			return IMOSObjectStatus.PLAY
		case 'stopped':
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
