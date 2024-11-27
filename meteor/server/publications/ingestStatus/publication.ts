import { PeripheralDeviceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { UISegmentPartNote } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Rundown, getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { groupByToMap, normalizeArrayToMap, protectString } from '../../lib/tempLib'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import {
	ContentCache,
	createReactiveContentCache,
	PartFields,
	PartInstanceFields,
	RundownFields,
	SegmentFields,
} from './reactiveContentCache'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import { generateNotesForSegment } from './generateNotesForSegment'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { checkAccessAndGetPeripheralDevice } from '../../security/check'
import { check } from '../../lib/check'
import { IngestRundownStatus } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'

interface IngestRundownStatusArgs {
	readonly deviceId: PeripheralDeviceId
}

export interface IngestRundownStatusState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface IngestRundownStatusUpdateProps {
	newCache: ContentCache

	invalidateRundownIds: RundownId[]
	invalidateSegmentIds: SegmentId[]
}

async function setupIngestRundownStatusPublicationObservers(
	args: ReadonlyDeep<IngestRundownStatusArgs>,
	triggerUpdate: TriggerUpdate<IngestRundownStatusUpdateProps>
): Promise<SetupObserversResult> {
	const rundownsObserver = await RundownsObserver.createForPeripheralDevice(args.deviceId, async (rundownIds) => {
		logger.silly(`Creating new RundownContentObserver`)

		// TODO - can this be done cheaper?
		const cache = createReactiveContentCache()

		// Push update
		triggerUpdate({ newCache: cache })

		const obs1 = await RundownContentObserver.create(rundownIds, cache)

		const innerQueries = [
			cache.Segments.find({}).observeChanges({
				added: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				changed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				removed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
			}),
			cache.Parts.find({}).observe({
				added: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId, oldDoc.segmentId] }),
				removed: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
			}),
			cache.DeletedPartInstances.find({}).observe({
				added: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId, oldDoc.segmentId] }),
				removed: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
			}),
			cache.Rundowns.find({}).observeChanges({
				added: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
				changed: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
				removed: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
			}),
		]

		return () => {
			obs1.dispose()

			for (const query of innerQueries) {
				query.stop()
			}
		}
	})

	// Set up observers:
	return [rundownsObserver]
}

export async function manipulateIngestRundownStatusPublicationData(
	args: IngestRundownStatusArgs,
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

	const updateContext = compileUpdateNotesData(state.contentCache)

	const updateAll = !updateProps || !!updateProps?.newCache
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		state.contentCache.Segments.find({}).forEach((segment) => {
			updateNotesForSegment(args, updateContext, collection, segment)
		})
	} else {
		const regenerateForSegmentIds = new Set(updateProps.invalidateSegmentIds)

		// Figure out the Rundowns which have changed, but may not have updated the segments/parts
		const changedRundownIdsSet = new Set(updateProps.invalidateRundownIds)
		if (changedRundownIdsSet.size > 0) {
			state.contentCache.Segments.find({}).forEach((segment) => {
				if (changedRundownIdsSet.has(segment.rundownId)) {
					regenerateForSegmentIds.add(segment._id)
				}
			})
		}

		// Remove ones from segments being regenerated
		if (regenerateForSegmentIds.size > 0) {
			collection.remove((doc) => regenerateForSegmentIds.has(doc.segmentId))

			// Generate notes for each segment
			for (const segmentId of regenerateForSegmentIds) {
				const segment = state.contentCache.Segments.findOne(segmentId)

				if (segment) {
					updateNotesForSegment(args, updateContext, collection, segment)
				} else {
					// Notes have already been removed
				}
			}
		}
	}
}

interface UpdateNotesData {
	rundownsCache: Map<RundownId, Pick<Rundown, RundownFields>>
	parts: Map<SegmentId, Pick<DBPart, PartFields>[]>
	deletedPartInstances: Map<SegmentId, Pick<DBPartInstance, PartInstanceFields>[]>
}
function compileUpdateNotesData(cache: ReadonlyDeep<ContentCache>): UpdateNotesData {
	return {
		rundownsCache: normalizeArrayToMap(cache.Rundowns.find({}).fetch(), '_id'),
		parts: groupByToMap(cache.Parts.find({}).fetch(), 'segmentId'),
		deletedPartInstances: groupByToMap(cache.DeletedPartInstances.find({}).fetch(), 'segmentId'),
	}
}

function updateNotesForSegment(
	args: IngestRundownStatusArgs,
	state: UpdateNotesData,
	collection: CustomPublishCollection<UISegmentPartNote>,
	segment: Pick<DBSegment, SegmentFields>
) {
	const notesForSegment = generateNotesForSegment(
		args.playlistId,
		segment,
		getRundownNrcsName(state.rundownsCache.get(segment.rundownId)),
		state.parts.get(segment._id) ?? [],
		state.deletedPartInstances.get(segment._id) ?? []
	)

	// Insert generated notes
	for (const note of notesForSegment) {
		collection.replace(note)
	}
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
