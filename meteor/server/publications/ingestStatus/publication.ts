import { PartId, PeripheralDeviceId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { ContentCache, createReactiveContentCache, PartInstanceFields } from './reactiveContentCache'
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
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import _ from 'underscore'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

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
		logger.silly(`Creating new RundownContentObserver`, rundownIds)

		// TODO - can this be done cheaper?
		const cache = createReactiveContentCache(rundownIds)

		// Push update
		triggerUpdate({ newCache: cache })

		const contentObserver = await RundownContentObserver.create(rundownIds, cache)

		const innerQueries = [
			cache.Playlists.find({}).observeChanges(
				{
					added: (docId) => triggerUpdate({ invalidatePlaylistIds: [protectString(docId)] }),
					changed: (docId) => triggerUpdate({ invalidatePlaylistIds: [protectString(docId)] }),
					removed: (docId) => triggerUpdate({ invalidatePlaylistIds: [protectString(docId)] }),
				},
				{ nonMutatingCallbacks: true }
			),
			cache.Rundowns.find({}).observeChanges(
				{
					added: (docId) => {
						triggerUpdate({ invalidateRundownIds: [protectString(docId)] })
						contentObserver.checkPlaylistIds()
					},
					changed: (docId) => {
						triggerUpdate({ invalidateRundownIds: [protectString(docId)] })
						contentObserver.checkPlaylistIds()
					},
					removed: (docId) => {
						triggerUpdate({ invalidateRundownIds: [protectString(docId)] })
						contentObserver.checkPlaylistIds()
					},
				},
				{ nonMutatingCallbacks: true }
			),
			cache.Parts.find({}).observe({
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
		externalId: rundown.externalId,

		active: 'inactive',

		segments: [],
	}

	const playlist = cache.Playlists.findOne({
		_id: rundown.playlistId,
		activationId: { $exists: true },
	})

	if (playlist) {
		newDoc.active = playlist.rehearsal ? 'rehearsal' : 'active'
	}

	// Find the most important part instance for each part
	const partInstanceMap = new Map<PartId, Pick<DBPartInstance, PartInstanceFields>>()
	if (playlist) {
		for (const partInstance of cache.PartInstances.find({}).fetch()) {
			if (partInstance.rundownId !== rundownId) continue
			// Ignore the next partinstance
			if (partInstance._id === playlist.nextPartInfo?.partInstanceId) continue

			// The current part instance is the most important
			if (partInstance._id === playlist.currentPartInfo?.partInstanceId) {
				partInstanceMap.set(partInstance.part._id, partInstance)
				continue
			}

			// Take the part with the highest takeCount
			const existingEntry = partInstanceMap.get(partInstance.part._id)
			if (!existingEntry || existingEntry.takeCount < partInstance.takeCount) {
				partInstanceMap.set(partInstance.part._id, partInstance)
			}
		}
	}

	const nrcsSegments = cache.NrcsIngestData.find({ rundownId, type: NrcsIngestCacheType.SEGMENT }).fetch()
	for (const nrcsSegment of nrcsSegments) {
		const nrcsParts = cache.NrcsIngestData.find({
			rundownId,
			segmentId: nrcsSegment.segmentId,
			type: NrcsIngestCacheType.PART,
		}).fetch()

		newDoc.segments.push({
			externalId: nrcsSegment.data.externalId,
			parts: _.compact(
				nrcsParts.map((nrcsPart) => {
					if (!nrcsPart.partId || !nrcsPart.segmentId) return null

					const part = cache.Parts.findOne({ _id: nrcsPart.partId, rundownId })
					const partInstance = partInstanceMap.get(nrcsPart.partId)

					// Determine the playback status from the PartInstance
					let playbackStatus = IngestPartPlaybackStatus.UNKNOWN
					if (playlist && partInstance && partInstance.part.shouldNotifyCurrentPlayingPart) {
						const isCurrentPartInstance = playlist.currentPartInfo?.partInstanceId === partInstance._id

						if (isCurrentPartInstance) {
							// If the current, it is playing
							playbackStatus = IngestPartPlaybackStatus.PLAY
						} else {
							// If not the current, but has been played, it is stopped
							playbackStatus = IngestPartPlaybackStatus.STOP
						}
					}

					// Determine the ready status from the PartInstance or Part
					const isReady = partInstance ? partInstance.part.ingestNotifyPartReady : part?.ingestNotifyPartReady

					return {
						externalId: nrcsPart.data.externalId,

						isReady: isReady ?? null,

						playbackStatus,
					}
				})
			),
		})
	}

	return newDoc
}

meteorCustomPublish(
	PeripheralDevicePubSub.ingestDeviceRundownStatus,
	PeripheralDevicePubSubCollectionsNames.ingestRundownStatus,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		await checkAccessAndGetPeripheralDevice(deviceId, token, this)

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
