import type { IMOSDevice } from '@mos-connection/connector'
import type { MosDeviceStatusesConfig } from './generated/devices'
import type { CoreMosDeviceHandler } from './CoreMosDeviceHandler'
import {
	type Observer,
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
	stringifyError,
	SubscriptionId,
} from '@sofie-automation/server-core-integration'
import type { IngestRundownStatus } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import { RundownId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import type winston = require('winston')

export class MosStatusHandler {
	readonly #logger: winston.Logger
	readonly #mosDevice: IMOSDevice
	readonly #coreMosHandler: CoreMosDeviceHandler

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

		// nocommit - send statuses to MOS device. with a queue?

		throw new Error('Method not implemented.')
	}

	dispose(): void {
		this.#destroyed = true

		this.#observer?.stop()
		if (this.#subId) this.#coreMosHandler.core.unsubscribe(this.#subId)
	}
}

interface StoryStatusItem {
	storyId: string
	mosStatus: string
}

function diffStatuses(
	previousStatuses: IngestRundownStatus | undefined,
	newStatuses: IngestRundownStatus | undefined
): StoryStatusItem[] {
	if (!previousStatuses && !newStatuses) return []

	// TODO
	return []
}
