import { PeripheralDeviceId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { ContentCache, createReactiveContentCache } from './reactiveContentCache'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { checkAccessAndGetPeripheralDevice } from '../../security/check'
import { check } from '../../lib/check'
import { IngestPartPlaybackStatus, IngestRundownStatus } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

interface IngestRundownStatusArgs {
	readonly deviceId: PeripheralDeviceId
}

export interface IngestRundownStatusState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface IngestRundownStatusUpdateProps {
	newCache: ContentCache

	invalidateRundownIds: RundownId[]
	invalidatePlaylistIds: RundownPlaylistId[]
}

async function setupIngestRundownStatusPublicationObservers(
	args: ReadonlyDeep<IngestRundownStatusArgs>,
	triggerUpdate: TriggerUpdate<IngestRundownStatusUpdateProps>
): Promise<SetupObserversResult> {
	const rundownsObserver = await RundownsObserver.createForPeripheralDevice(args.deviceId, async (rundownIds) => {
		logger.silly(`Creating new RundownContentObserver`)

		// TODO - can this be done cheaper?
		const cache = createReactiveContentCache(rundownIds)

		// Push update
		triggerUpdate({ newCache: cache })

		const contentObserver = await RundownContentObserver.create(rundownIds, cache)

		const innerQueries = [
			cache.Playlists.find({}).observeChanges({
				added: (docId) => triggerUpdate({ invalidatePlaylistIds: [protectString(docId)] }),
				changed: (docId) => triggerUpdate({ invalidatePlaylistIds: [protectString(docId)] }),
				removed: (docId) => triggerUpdate({ invalidatePlaylistIds: [protectString(docId)] }),
			}),
			cache.Rundowns.find({}).observe({
				added: (doc) => {
					triggerUpdate({ invalidateRundownIds: [doc._id] })
					contentObserver.checkPlaylistIds()
				},
				changed: (doc) => {
					triggerUpdate({ invalidateRundownIds: [doc._id] })
					contentObserver.checkPlaylistIds()
				},
				removed: (doc) => {
					triggerUpdate({ invalidateRundownIds: [doc._id] })
					contentObserver.checkPlaylistIds()
				},
			}),
			cache.Parts.find({}).observe({
				added: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId, oldDoc.rundownId] }),
				removed: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
			}),
			cache.Segments.find({}).observe({
				added: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId, oldDoc.rundownId] }),
				removed: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
			}),
			cache.PartInstances.find({}).observe({
				added: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId, oldDoc.rundownId] }),
				removed: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
			}),
			cache.NrcsIngestData.find({}).observe({
				added: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId, oldDoc.rundownId] }),
				removed: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
			}),
		]

		return () => {
			contentObserver.dispose()

			for (const query of innerQueries) {
				query.stop()
			}
		}
	})

	// Set up observers:
	return [rundownsObserver]
}

async function manipulateIngestRundownStatusPublicationData(
	_args: IngestRundownStatusArgs,
	state: Partial<IngestRundownStatusState>,
	collection: CustomPublishCollection<IngestRundownStatus>,
	updateProps: Partial<ReadonlyDeep<IngestRundownStatusUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// We know that `collection` does diffing when 'commiting' all of the changes we have made
	// meaning that for anything we will call `replace()` on, we can `remove()` it first for no extra cost

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the notes
		collection.remove(null)

		return
	}

	const updateAll = !updateProps || !!updateProps?.newCache
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		const knownRundownIds = new Set(state.contentCache.RundownIds)

		for (const rundownId of knownRundownIds) {
			const newDoc = regenerateForRundown(state.contentCache, rundownId)
			if (newDoc) collection.replace(newDoc)
		}
	} else {
		const regenerateForRundownIds = new Set(updateProps.invalidateRundownIds)

		// Include anything where the playlist has changed
		if (updateProps.invalidatePlaylistIds && updateProps.invalidatePlaylistIds.length > 0) {
			const rundownsToUpdate = state.contentCache.Rundowns.find(
				{
					playlistId: { $in: updateProps.invalidatePlaylistIds },
				},
				{
					projection: {
						_id: 1,
					},
				}
			).fetch() as Pick<DBRundown, '_id'>[]

			for (const rundown of rundownsToUpdate) {
				regenerateForRundownIds.add(rundown._id)
			}
		}

		for (const rundownId of regenerateForRundownIds) {
			const newDoc = regenerateForRundown(state.contentCache, rundownId)
			if (newDoc) {
				collection.replace(newDoc)
			} else {
				collection.remove(rundownId)
			}
		}
	}
}

function regenerateForRundown(cache: ReadonlyDeep<ContentCache>, rundownId: RundownId): IngestRundownStatus | null {
	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) return null

	const newDoc: IngestRundownStatus = {
		_id: rundownId,
		id: rundown.externalId,

		segments: [],
	}

	const segments = cache.Segments.find({ rundownId }).fetch()
	for (const segment of segments) {
		const parts = cache.Parts.find({ rundownId, segmentId: segment._id }).fetch()

		// nocommit TODO
		/*
		 * This should probably be structured like the nrcs expects the data to be.
		 * That probably means using the NRCSIngestData, as that is supposed to exactly match the NRCS.
		 *
		 */
		newDoc.segments.push({
			id: segment.externalId,
			parts: parts.map((part) => {
				const partInstance = cache.PartInstances.findOne({
					rundownId,
					segmentId: segment._id,
					'part._id': part._id,
				})

				const reportPartAsPlaying = partInstance
					? partInstance.part.shouldNotifyCurrentPlayingPart
					: part.shouldNotifyCurrentPlayingPart

				return {
					id: part.externalId,

					isReady:
						(partInstance ? partInstance.part.ingestNotifyPartReady : part.ingestNotifyPartReady) ?? null,

					playbackStatus: reportPartAsPlaying
						? IngestPartPlaybackStatus.PLAYING
						: IngestPartPlaybackStatus.UNKNOWN, // TODO - this is missing some states and logic!
				}
			}),
		})
	}

	return newDoc
}

meteorCustomPublish(
	PeripheralDevicePubSub.ingestDeviceRundownStatus,
	PeripheralDevicePubSubCollectionsNames.ingestRundownStatus,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioId
		if (!studioId) {
			logger.warn(`Pub.packageManagerPackageContainers: device "${peripheralDevice._id}" has no studioId`)
			return this.ready()
		}

		await setUpCollectionOptimizedObserver<
			IngestRundownStatus,
			IngestRundownStatusArgs,
			IngestRundownStatusState,
			IngestRundownStatusUpdateProps
		>(
			`pub_${PeripheralDevicePubSub.ingestDeviceRundownStatus}_${deviceId}`,
			{ deviceId },
			setupIngestRundownStatusPublicationObservers,
			manipulateIngestRundownStatusPublicationData,
			pub,
			100
		)
	}
)
