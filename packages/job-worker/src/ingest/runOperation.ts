import { IngestModel, IngestModelReadonly } from './model/IngestModel'
import { BeforeIngestOperationPartMap, CommitIngestOperation } from './commit'
import { RundownIngestDataCache, RundownIngestDataCacheGenerator } from './ingestCache'
import { canRundownBeUpdated, getRundownId, getSegmentId } from './lib'
import { JobContext } from '../jobs'
import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { loadIngestModelFromRundownExternalId } from './model/implementation/LoadIngestModel'
import { Complete, clone } from '@sofie-automation/corelib/dist/lib'
import { CommitIngestData, runWithRundownLockWithoutFetchingRundown } from './lock'
import { DatabasePersistedModel } from '../modelBase'
import {
	NrcsIngestChangeDetails,
	IngestRundown,
	UserOperationChange,
	IngestSegment,
} from '@sofie-automation/blueprints-integration'
import { MutableIngestRundownImpl } from '../blueprints/ingest/MutableIngestRundownImpl'
import { CommonContext } from '../blueprints/context'
import { PartId, PeripheralDeviceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { GenerateRundownMode, updateRundownFromIngestData, updateRundownFromIngestDataInner } from './generationRundown'
import { calculateSegmentsAndRemovalsFromIngestData, calculateSegmentsFromIngestData } from './generationSegment'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import _ = require('underscore')
import { wipGroupRundownForMos } from '../blueprints/ingest/wipGroupRundownForMos'

export enum UpdateIngestRundownAction {
	DELETE = 'delete',
	FORCE_DELETE = 'force-delete',
}

export interface UpdateIngestRundownChange {
	ingestRundown: IngestRundown
	changes: NrcsIngestChangeDetails | UserOperationChange
}

export type UpdateIngestRundownResult = UpdateIngestRundownChange | UpdateIngestRundownAction

// nocommit - this needs a better name
export interface ComputedIngestChanges {
	ingestRundown: IngestRundown

	// define what needs regenerating
	segmentsToRemove: string[]
	segmentsUpdatedRanks: Record<string, number> // contains the new rank
	segmentsToRegenerate: IngestSegment[]
	regenerateRundown: boolean // TODO - full vs metadata?

	segmentRenames: Record<string, string> // old -> new
}

// nocommit - this needs a better name
export type ComputedIngestChanges2 = ComputedIngestChanges | UpdateIngestRundownAction

/**
 * Perform an 'ingest' update operation which modifies a Rundown without modifying the ingest data
 * This will automatically do some post-update data changes, to ensure the playout side (partinstances etc) is updated with the changes
 * @param context Context of the job being run
 * @param data Ids for the rundown and peripheral device
 * @param doWorkFcn Function to run to update the Rundown. Return the blob of data about the change to help the post-update perform its duties. Return null to indicate that nothing changed
 */
export async function runCustomIngestUpdateOperation(
	context: JobContext,
	data: IngestPropsBase,
	doWorkFcn: (
		context: JobContext,
		ingestModel: IngestModel,
		ingestRundown: IngestRundown
	) => Promise<CommitIngestData | null>
): Promise<void> {
	if (!data.rundownExternalId) {
		throw new Error(`Job is missing rundownExternalId`)
	}

	const rundownId = getRundownId(context.studioId, data.rundownExternalId)
	return runWithRundownLockWithoutFetchingRundown(context, rundownId, async (rundownLock) => {
		const span = context.startSpan(`ingestLockFunction.${context.studioId}`)

		// Load the old ingest data
		const pIngestModel = loadIngestModelFromRundownExternalId(context, rundownLock, data.rundownExternalId)
		pIngestModel.catch(() => null) // Prevent unhandled promise rejection
		const sofieIngestObjectCache = await RundownIngestDataCache.create(
			context,
			context.directCollections.SofieIngestDataCache,
			rundownId
		)
		const sofieIngestRundown = sofieIngestObjectCache.fetchRundown()
		if (!sofieIngestRundown) throw new Error(`SofieIngestRundown "${rundownId}" not found`)

		let resultingError: UserError | void | undefined

		try {
			const ingestModel = await pIngestModel

			// Load any 'before' data for the commit,
			const beforeRundown = ingestModel.rundown
			const beforePartMap = generatePartMap(ingestModel)

			// Perform the update operation
			const commitData = await doWorkFcn(context, ingestModel, sofieIngestRundown)

			if (commitData) {
				const commitSpan = context.startSpan('ingest.commit')
				// The change is accepted. Perform some playout calculations and save it all
				resultingError = await CommitIngestOperation(
					context,
					ingestModel,
					beforeRundown,
					beforePartMap,
					commitData
				)
				commitSpan?.end()
			} else {
				// Should be no changes
				ingestModel.assertNoChanges()
			}
		} finally {
			span?.end()
		}

		if (resultingError) throw resultingError
	})
}

export type IngestUpdateOperationFunction = (oldIngestRundown: IngestRundown | undefined) => UpdateIngestRundownResult

/**
 * Perform an ingest update operation on a rundown
 * This will automatically do some post-update data changes, to ensure the playout side (partinstances etc) is updated with the changes
 * @param context Context of the job being run
 * @param data Ids for the rundown and peripheral device
 * @param updateNrcsIngestModelFcn Function to mutate the ingestData. Throw if the requested change is not valid. Return undefined to indicate the ingestData should be deleted
 */
export async function runIngestUpdateOperation(
	context: JobContext,
	data: IngestPropsBase,
	updateNrcsIngestModelFcn: IngestUpdateOperationFunction
): Promise<void> {
	return runIngestUpdateOperationBase(context, data, async (nrcsIngestObjectCache) =>
		updateNrcsIngestObjects(context, nrcsIngestObjectCache, updateNrcsIngestModelFcn)
	)
}

/**
 * Perform an ingest update operation on a rundown
 * This will automatically do some post-update data changes, to ensure the playout side (partinstances etc) is updated with the changes
 * @param context Context of the job being run
 * @param data Ids for the rundown and peripheral device
 * @param updateNrcsIngestModelFcn Function to mutate the ingestData. Throw if the requested change is not valid. Return undefined to indicate the ingestData should be deleted
 */
// nocommit - this needs a better name
export async function runIngestUpdateOperationBase(
	context: JobContext,
	data: IngestPropsBase,
	executeFcn: (nrcsIngestObjectCache: RundownIngestDataCache) => Promise<UpdateIngestRundownResult>
): Promise<void> {
	if (!data.rundownExternalId) {
		throw new Error(`Job is missing rundownExternalId`)
	}

	const rundownId = getRundownId(context.studioId, data.rundownExternalId)
	return runWithRundownLockWithoutFetchingRundown(context, rundownId, async (rundownLock) => {
		const span = context.startSpan(`ingestLockFunction.${context.studioId}`)

		// Load the old ingest data
		const pIngestModel = loadIngestModelFromRundownExternalId(context, rundownLock, data.rundownExternalId)
		pIngestModel.catch(() => null) // Prevent unhandled promise rejection
		const pSofieIngestObjectCache = RundownIngestDataCache.create(
			context,
			context.directCollections.SofieIngestDataCache,
			rundownId
		)
		pSofieIngestObjectCache.catch(() => null) // Prevent unhandled promise rejection
		const nrcsIngestObjectCache = await RundownIngestDataCache.create(
			context,
			context.directCollections.NrcsIngestDataCache,
			rundownId
		)
		const originalNrcsIngestRundown = clone(nrcsIngestObjectCache.fetchRundown())

		const ingestRundownChanges = await executeFcn(nrcsIngestObjectCache)

		// // Update the NRCS ingest view
		// const ingestRundownChanges = updateNrcsIngestObjects(context, nrcsIngestObjectCache, updateNrcsIngestModelFcn)

		// Start saving the nrcs ingest data
		const pSaveNrcsIngestChanges = nrcsIngestObjectCache.saveToDatabase()
		pSaveNrcsIngestChanges.catch(() => null) // Prevent unhandled promise rejection

		let resultingError: UserError | void | undefined

		try {
			// Update the Sofie ingest view
			const sofieIngestObjectCache = await pSofieIngestObjectCache
			const computedChanges = await updateSofieIngestRundown(
				context,
				rundownId,
				sofieIngestObjectCache,
				ingestRundownChanges,
				originalNrcsIngestRundown
			)

			// Start saving the Sofie ingest data
			const pSaveSofieIngestChanges = sofieIngestObjectCache.saveToDatabase()

			try {
				resultingError = await updateSofieRundownModel(
					context,
					pIngestModel,
					computedChanges,
					data.peripheralDeviceId
				)
			} finally {
				// Ensure we save the sofie ingest data
				await pSaveSofieIngestChanges
			}
		} finally {
			// Ensure we save the nrcs ingest data
			// await pSaveNrcsIngestChanges

			span?.end()
		}

		if (resultingError) throw resultingError
	})
}

function updateNrcsIngestObjects(
	context: JobContext,
	nrcsIngestObjectCache: RundownIngestDataCache,
	updateNrcsIngestModelFcn: (oldIngestRundown: IngestRundown | undefined) => UpdateIngestRundownResult
): UpdateIngestRundownResult {
	const updateNrcsIngestModelSpan = context.startSpan('ingest.calcFcn')
	const oldNrcsIngestRundown = nrcsIngestObjectCache.fetchRundown()
	const updatedIngestRundown = updateNrcsIngestModelFcn(clone(oldNrcsIngestRundown))
	updateNrcsIngestModelSpan?.end()

	switch (updatedIngestRundown) {
		// case UpdateIngestRundownAction.REJECT:
		// 	// Reject change
		// 	return
		case UpdateIngestRundownAction.DELETE:
		case UpdateIngestRundownAction.FORCE_DELETE:
			nrcsIngestObjectCache.delete()
			break
		default:
			nrcsIngestObjectCache.replace(updatedIngestRundown.ingestRundown)
			break
	}

	return updatedIngestRundown
}

async function updateSofieIngestRundown(
	context: JobContext,
	rundownId: RundownId,
	sofieIngestObjectCache: RundownIngestDataCache,
	ingestRundownChanges: UpdateIngestRundownResult,
	oldNrcsIngestRundown: IngestRundown | undefined
): Promise<ComputedIngestChanges2 | null> {
	if (
		ingestRundownChanges === UpdateIngestRundownAction.DELETE ||
		ingestRundownChanges === UpdateIngestRundownAction.FORCE_DELETE
	) {
		// Also delete the Sofie view of the Rundown
		// nocommit Is this correct? Or should we keep the Sofie view as-is until the rundown is deleted? Or perhaps even let the blueprints decide?
		sofieIngestObjectCache.delete()

		return ingestRundownChanges
	} else {
		const studioBlueprint = context.studioBlueprint.blueprint

		const nrcsIngestRundown = ingestRundownChanges.ingestRundown
		const sofieIngestRundown = sofieIngestObjectCache.fetchRundown()

		sortIngestRundown(nrcsIngestRundown)

		const mutableIngestRundown = sofieIngestRundown
			? new MutableIngestRundownImpl(clone(sofieIngestRundown), true)
			: new MutableIngestRundownImpl(
					{
						externalId: nrcsIngestRundown.externalId,
						name: nrcsIngestRundown.name,
						type: nrcsIngestRundown.type,
						segments: [],
						payload: undefined,
					} satisfies Complete<IngestRundown>,
					false
			  )

		// Let blueprints apply changes to the Sofie ingest data
		if (typeof studioBlueprint.processIngestData === 'function') {
			const blueprintContext = new CommonContext({
				name: 'processIngestData',
				identifier: `studio:${context.studioId},blueprint:${studioBlueprint.blueprintId}`,
			})

			await studioBlueprint.processIngestData(
				blueprintContext,
				mutableIngestRundown,
				nrcsIngestRundown,
				ingestRundownChanges.changes
			)
		} else if (ingestRundownChanges.changes.source === 'ingest') {
			// nocommit - temporary hack for development
			const { nrcsIngestRundown: nrcsIngestRundown2, changes } = wipGroupRundownForMos(
				nrcsIngestRundown,
				ingestRundownChanges.changes,
				oldNrcsIngestRundown
			)

			// Blueprints has not defined a processIngestData()
			mutableIngestRundown.defaultApplyIngestChanges(nrcsIngestRundown2, changes)
		} else {
			throw new Error(`Blueprint missing processIngestData function`)
		}

		const ingestObjectGenerator = new RundownIngestDataCacheGenerator(rundownId)
		const resultChanges = mutableIngestRundown.intoIngestRundown(ingestObjectGenerator)
		//  const newSofieIngestRundown = resultChanges.ingestRundown

		// Sync changes to the cache
		sofieIngestObjectCache.replaceDocuments(resultChanges.changedCacheObjects)
		sofieIngestObjectCache.removeAllOtherDocuments(resultChanges.allCacheObjectIds)

		return resultChanges.computedChanges
	}
}

function sortIngestRundown(rundown: IngestRundown): void {
	rundown.segments.sort((a, b) => a.rank - b.rank)
	for (const segment of rundown.segments) {
		segment.parts.sort((a, b) => a.rank - b.rank)
	}
}

async function updateSofieRundownModel(
	context: JobContext,
	pIngestModel: Promise<IngestModel & DatabasePersistedModel>,
	computedIngestChanges: ComputedIngestChanges2 | null,
	peripheralDeviceId: PeripheralDeviceId | null
) {
	const ingestModel = await pIngestModel

	// Load any 'before' data for the commit
	const beforeRundown = ingestModel.rundown
	const beforePartMap = generatePartMap(ingestModel)

	let commitData: CommitIngestData | null = null

	if (
		computedIngestChanges === UpdateIngestRundownAction.DELETE ||
		computedIngestChanges === UpdateIngestRundownAction.FORCE_DELETE
	) {
		// Get the rundown, and fail if it doesn't exist
		const rundown = ingestModel.getRundown()

		// Check if it can be deleted
		const canRemove =
			computedIngestChanges === UpdateIngestRundownAction.FORCE_DELETE || canRundownBeUpdated(rundown, false)
		if (!canRemove) throw UserError.create(UserErrorMessage.RundownRemoveWhileActive, { name: rundown.name })

		// The rundown has been deleted
		commitData = {
			changedSegmentIds: [],
			removedSegmentIds: [],
			renamedSegments: new Map(),

			removeRundown: true,
			returnRemoveFailure: true,
		}
	} else if (computedIngestChanges) {
		const calcSpan = context.startSpan('ingest.calcFcn')
		commitData = await applyCalculatedIngestChangesToModel(
			context,
			ingestModel,
			computedIngestChanges,
			peripheralDeviceId
		)
		calcSpan?.end()
	}

	// console.log('commitData', commitData, computedIngestChanges)

	let resultingError: UserError | void | undefined

	if (commitData) {
		const commitSpan = context.startSpan('ingest.commit')
		// The change is accepted. Perform some playout calculations and save it all
		resultingError = await CommitIngestOperation(context, ingestModel, beforeRundown, beforePartMap, commitData)
		commitSpan?.end()
	} else {
		// Should be no changes
		ingestModel.assertNoChanges()
	}

	return resultingError
}

async function applyCalculatedIngestChangesToModel(
	context: JobContext,
	ingestModel: IngestModel,
	computedIngestChanges: ComputedIngestChanges,
	peripheralDeviceId: PeripheralDeviceId | null
): Promise<CommitIngestData | null> {
	const newIngestRundown = computedIngestChanges.ingestRundown

	// Ensure the rundown can be updated
	const rundown = ingestModel.rundown
	// if (!canRundownBeUpdated(rundown, false)) return null
	if (!canRundownBeUpdated(rundown, computedIngestChanges.regenerateRundown)) return null

	const span = context.startSpan('ingest.applyCalculatedIngestChangesToModel')

	if (!rundown || computedIngestChanges.regenerateRundown) {
		// Do a full regeneration

		const result = await updateRundownFromIngestData(
			context,
			ingestModel,
			newIngestRundown,
			GenerateRundownMode.Create,
			peripheralDeviceId
		)

		// nocommit any segment renames?

		span?.end()
		return result
	} else {
		// Update segment ranks:
		for (const [segmentExternalId, newRank] of Object.entries<number>(computedIngestChanges.segmentsUpdatedRanks)) {
			const segment = ingestModel.getSegmentByExternalId(segmentExternalId)
			if (segment) {
				segment.setRank(newRank)
			}
		}

		// Updated segments that has had their segment.externalId changed:
		const renamedSegments = applyExternalIdDiff(ingestModel, computedIngestChanges, true)

		// If requested, regenerate the rundown in the 'metadata' mode
		if (computedIngestChanges.regenerateRundown) {
			const regenerateCommitData = await updateRundownFromIngestDataInner(
				context,
				ingestModel,
				newIngestRundown,
				GenerateRundownMode.MetadataChange, // TODO - full vs metadata?
				peripheralDeviceId
			)
			if (regenerateCommitData?.regenerateAllContents) {
				const regeneratedSegmentIds = await calculateSegmentsAndRemovalsFromIngestData(
					context,
					ingestModel,
					newIngestRundown,
					regenerateCommitData.allRundownWatchedPackages
				)

				// TODO - should this include the ones which were renamed/updated ranks above?
				return {
					changedSegmentIds: regeneratedSegmentIds.changedSegmentIds,
					removedSegmentIds: regeneratedSegmentIds.removedSegmentIds,
					renamedSegments: renamedSegments,

					removeRundown: false,
				} satisfies CommitIngestData
			}
		}

		// Create/Update segments
		const segmentsToRegenerate = _.sortBy([...computedIngestChanges.segmentsToRegenerate], (se) => se.rank) // nocommit: is this sort necessary?
		const changedSegmentIds = await calculateSegmentsFromIngestData(
			context,
			ingestModel,
			segmentsToRegenerate,
			null
		)

		const changedSegmentIdsSet = new Set<SegmentId>(changedSegmentIds)
		for (const segmentId of Object.keys(computedIngestChanges.segmentsUpdatedRanks)) {
			changedSegmentIdsSet.add(ingestModel.getSegmentIdFromExternalId(segmentId))
		}
		// TODO - include changed external ids?

		// Remove/orphan old segments
		const orphanedSegmentIds: SegmentId[] = []
		for (const segmentExternalId of computedIngestChanges.segmentsToRemove) {
			const segment = ingestModel.getSegmentByExternalId(segmentExternalId)
			if (segment) {
				// We orphan it and queue for deletion. the commit phase will complete if possible
				orphanedSegmentIds.push(segment.segment._id)
				segment.setOrphaned(SegmentOrphanedReason.DELETED)

				segment.removeAllParts()

				// It can't also have been changed if it is deleted
				changedSegmentIdsSet.delete(segment.segment._id)
			}
		}

		span?.end()
		return {
			changedSegmentIds: Array.from(changedSegmentIdsSet),
			removedSegmentIds: orphanedSegmentIds, // Only inform about the ones that werent renamed
			renamedSegments: renamedSegments,

			removeRundown: false,
		} satisfies CommitIngestData
	}
}

/**
 * Apply the externalId renames from a DiffSegmentEntries
 * @param ingestModel Ingest model of the rundown being updated
 * @param segmentDiff Calculated Diff
 * @returns Map of the SegmentId changes
 */
function applyExternalIdDiff(
	ingestModel: IngestModel,
	segmentDiff: Pick<ComputedIngestChanges, 'segmentRenames' | 'segmentsUpdatedRanks'>,
	canDiscardParts: boolean
): CommitIngestData['renamedSegments'] {
	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = new Map<SegmentId, SegmentId>()
	for (const [oldSegmentExternalId, newSegmentExternalId] of Object.entries<string>(segmentDiff.segmentRenames)) {
		const oldSegmentId = getSegmentId(ingestModel.rundownId, oldSegmentExternalId)
		const newSegmentId = getSegmentId(ingestModel.rundownId, newSegmentExternalId)

		// Track the rename
		renamedSegments.set(oldSegmentId, newSegmentId)

		// If the segment doesnt exist (it should), then there isn't a segment to rename
		const oldSegment = ingestModel.getSegment(oldSegmentId)
		if (!oldSegment) continue

		if (ingestModel.getSegment(newSegmentId)) {
			// If the new SegmentId already exists, we need to discard the old one rather than trying to merge it.
			// This can only be done if the caller is expecting to regenerate Segments
			const canDiscardPartsForSegment = canDiscardParts && !segmentDiff.segmentsUpdatedRanks[oldSegmentExternalId]
			if (!canDiscardPartsForSegment) {
				throw new Error(`Cannot merge Segments with only rank changes`)
			}

			// Remove the old Segment and it's contents, the new one will be generated shortly
			ingestModel.removeSegment(oldSegmentId)
		} else {
			// Perform the rename
			ingestModel.changeSegmentId(oldSegmentId, newSegmentId)
		}
	}

	return renamedSegments
}

function generatePartMap(ingestModel: IngestModelReadonly): BeforeIngestOperationPartMap {
	const rundown = ingestModel.rundown
	if (!rundown) return new Map()

	const res = new Map<SegmentId, Array<{ id: PartId; rank: number }>>()
	for (const segment of ingestModel.getAllSegments()) {
		res.set(
			segment.segment._id,
			segment.parts.map((p) => ({ id: p.part._id, rank: p.part._rank }))
		)
	}
	return res
}
