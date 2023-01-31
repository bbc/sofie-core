import { assertNever, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartInstanceId, RundownId, SegmentId, SegmentPlayoutId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CacheForPlayout, getRundownIDsFromCache, getSelectedPartInstancesFromCache } from './cache'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS } from '@sofie-automation/shared-lib/dist/core/constants'
import { getCurrentTime } from '../lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import _ = require('underscore')
import { resetPartInstancesWithPieceInstances, SelectNextPartResult } from './lib'

type ParsedNextPart =
	| {
			type: 'part'
			part: DBPart
			consumesNextSegmentId: boolean | undefined
	  }
	| {
			type: 'partinstance'
			instance: DBPartInstance
	  }

export async function setNextPart(
	context: JobContext,
	cache: CacheForPlayout,
	rawNextPart: Omit<SelectNextPartResult, 'index'> | DBPartInstance | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined
): Promise<void> {
	const span = context.startSpan('setNextPart')

	const rundownIds = getRundownIDsFromCache(cache)
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

	if (rawNextPart) {
		if (!cache.Playlist.doc.activationId)
			throw new Error(`RundownPlaylist "${cache.Playlist.doc._id}" is not active`)

		let nextPartInfo: ParsedNextPart
		if ('playlistActivationId' in rawNextPart) {
			nextPartInfo = {
				type: 'partinstance',
				instance: rawNextPart,
			}
		} else {
			nextPartInfo = {
				type: 'part',
				part: rawNextPart.part,
				consumesNextSegmentId: rawNextPart.consumesNextSegmentId,
			}
		}

		if (
			(nextPartInfo.type === 'part' && nextPartInfo.part.invalid) ||
			(nextPartInfo.type === 'partinstance' && nextPartInfo.instance.part.invalid)
		) {
			throw new Error('Part is marked as invalid, cannot set as next.')
		}

		switch (nextPartInfo.type) {
			case 'part':
				if (!rundownIds.includes(nextPartInfo.part.rundownId)) {
					throw new Error(
						`Part "${nextPartInfo.part._id}" of rundown "${nextPartInfo.part.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
					)
				}
				break
			case 'partinstance':
				if (!rundownIds.includes(nextPartInfo.instance.rundownId)) {
					throw new Error(
						`PartInstance "${nextPartInfo.instance._id}" of rundown "${nextPartInfo.instance.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
					)
				}
				break
			default:
				assertNever(nextPartInfo)
				throw new Error('Unhandled ParsedNextPart in setNextPart')
		}

		const nextPart = nextPartInfo.type === 'partinstance' ? nextPartInfo.instance.part : nextPartInfo.part

		// create new instance
		let newInstanceId: PartInstanceId
		if (nextPartInfo.type === 'partinstance') {
			newInstanceId = nextPartInfo.instance._id
			cache.PartInstances.updateOne(newInstanceId, (p) => {
				delete p.consumesNextSegmentId
				return p
			})
			await syncPlayheadInfinitesForNextPartInstance(context, cache)
		} else if (nextPartInstance && nextPartInstance.part._id === nextPart._id) {
			// Re-use existing
			newInstanceId = nextPartInstance._id
			const consumesNextSegmentId = nextPartInfo.consumesNextSegmentId ?? false
			cache.PartInstances.updateOne(newInstanceId, (p) => {
				p.consumesNextSegmentId = consumesNextSegmentId
				return p
			})
			await syncPlayheadInfinitesForNextPartInstance(context, cache)
		} else {
			// Create new isntance
			newInstanceId = protectString<PartInstanceId>(`${nextPart._id}_${getRandomId()}`)
			const newTakeCount = currentPartInstance ? currentPartInstance.takeCount + 1 : 0 // Increment
			const segmentPlayoutId: SegmentPlayoutId =
				currentPartInstance && nextPart.segmentId === currentPartInstance.segmentId
					? currentPartInstance.segmentPlayoutId
					: getRandomId()

			cache.PartInstances.insert({
				_id: newInstanceId,
				takeCount: newTakeCount,
				playlistActivationId: cache.Playlist.doc.activationId,
				rundownId: nextPart.rundownId,
				segmentId: nextPart.segmentId,
				segmentPlayoutId,
				part: nextPart,
				rehearsal: !!cache.Playlist.doc.rehearsal,
				consumesNextSegmentId: nextPartInfo.consumesNextSegmentId,
				timings: {
					setAsNext: getCurrentTime(),
				},
			})

			const rundown = cache.Rundowns.findOne(nextPart.rundownId)

			if (!rundown) {
				throw new Error(`Could not find rundown ${nextPart.rundownId}`)
			}

			const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, cache, undefined, nextPart)
			const newPieceInstances = getPieceInstancesForPart(
				context,
				cache,
				currentPartInstance,
				rundown,
				nextPart,
				possiblePieces,
				newInstanceId
			)
			for (const pieceInstance of newPieceInstances) {
				cache.PieceInstances.insert(pieceInstance)
			}
		}

		const selectedPartInstanceIds = _.compact([
			newInstanceId,
			cache.Playlist.doc.currentPartInstanceId,
			cache.Playlist.doc.previousPartInstanceId,
		])

		// reset any previous instances of this part
		resetPartInstancesWithPieceInstances(context, cache, {
			_id: { $nin: selectedPartInstanceIds },
			rundownId: nextPart.rundownId,
			'part._id': nextPart._id,
		})

		const nextPartInstanceTmp = nextPartInfo.type === 'partinstance' ? nextPartInfo.instance : null
		cache.Playlist.update((p) => {
			p.nextPartInstanceId = newInstanceId
			p.nextPartManual = !!(setManually || nextPartInstanceTmp?.orphaned)
			p.nextTimeOffset = nextTimeOffset || null
			return p
		})
	} else {
		// Set to null

		cache.Playlist.update((p) => {
			p.nextPartInstanceId = null
			p.nextPartManual = !!setManually
			p.nextTimeOffset = null
			return p
		})
	}

	// Remove any instances which havent been taken
	const instancesIdsToRemove = cache.PartInstances.remove(
		(p) =>
			!p.isTaken &&
			p._id !== cache.Playlist.doc.nextPartInstanceId &&
			p._id !== cache.Playlist.doc.currentPartInstanceId
	)
	cache.PieceInstances.remove((p) => instancesIdsToRemove.includes(p.partInstanceId))

	{
		const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
		// When entering a segment, or moving backwards in a segment, reset any partInstances in that window
		// In theory the new segment should already be reset, as we do that upon leaving, but it wont be if jumping to earlier in the same segment or maybe if the rundown wasnt reset
		if (nextPartInstance) {
			const resetPartInstanceIds = new Set<PartInstanceId>()
			if (currentPartInstance) {
				// Always clean the current segment, anything after the current part (except the next part)
				const trailingInOldSegment = cache.PartInstances.findAll(
					(p) =>
						!p.reset &&
						p._id !== currentPartInstance._id &&
						p._id !== nextPartInstance._id &&
						p.segmentId === currentPartInstance.segmentId &&
						p.part._rank > currentPartInstance.part._rank
				)

				for (const part of trailingInOldSegment) {
					resetPartInstanceIds.add(part._id)
				}
			}

			if (
				!currentPartInstance ||
				nextPartInstance.segmentId !== currentPartInstance.segmentId ||
				(nextPartInstance.segmentId === currentPartInstance.segmentId &&
					nextPartInstance.part._rank < currentPartInstance.part._rank)
			) {
				// clean the whole segment if new, or jumping backwards
				const newSegmentParts = cache.PartInstances.findAll(
					(p) =>
						!p.reset &&
						p._id !== nextPartInstance._id &&
						p._id !== currentPartInstance?._id &&
						p.segmentId === nextPartInstance.segmentId
				)
				for (const part of newSegmentParts) {
					resetPartInstanceIds.add(part._id)
				}
			}

			if (resetPartInstanceIds.size > 0) {
				resetPartInstancesWithPieceInstances(context, cache, {
					_id: { $in: Array.from(resetPartInstanceIds) },
				})
			}
		}
	}

	await cleanupOrphanedItems(context, cache)

	if (span) span.end()
}

/**
 * Cleanup any orphaned (deleted) segments and partinstances once they are no longer being played
 * @param cache
 */
async function cleanupOrphanedItems(context: JobContext, cache: CacheForPlayout) {
	const playlist = cache.Playlist.doc

	const selectedPartInstancesSegmentIds = new Set<SegmentId>()
	const selectedPartInstances = getSelectedPartInstancesFromCache(cache)
	if (selectedPartInstances.currentPartInstance)
		selectedPartInstancesSegmentIds.add(selectedPartInstances.currentPartInstance.segmentId)
	if (selectedPartInstances.nextPartInstance)
		selectedPartInstancesSegmentIds.add(selectedPartInstances.nextPartInstance.segmentId)

	// Cleanup any orphaned segments once they are no longer being played. This also cleans up any adlib-parts, that have been marked as deleted as a deferred cleanup operation
	const segments = cache.Segments.findAll((s) => !!s.orphaned)
	const orphanedSegmentIds = new Set(segments.map((s) => s._id))

	const alterSegmentsFromRundowns = new Map<RundownId, { deleted: SegmentId[]; hidden: SegmentId[] }>()
	for (const segment of segments) {
		// If the segment is orphaned and not the segment for the next or current partinstance
		if (!selectedPartInstancesSegmentIds.has(segment._id)) {
			let rundownSegments = alterSegmentsFromRundowns.get(segment.rundownId)
			if (!rundownSegments) {
				rundownSegments = { deleted: [], hidden: [] }
				alterSegmentsFromRundowns.set(segment.rundownId, rundownSegments)
			}
			// The segment is finished with. Queue it for attempted removal or reingest
			switch (segment.orphaned) {
				case SegmentOrphanedReason.DELETED: {
					rundownSegments.deleted.push(segment._id)
					break
				}
				case SegmentOrphanedReason.HIDDEN: {
					// The segment is finished with. Queue it for attempted resync
					rundownSegments.hidden.push(segment._id)
					break
				}
			}
		}
	}

	// We need to run this outside of the current lock, and within an ingest lock, so defer to the work queue
	for (const [rundownId, candidateSegmentIds] of alterSegmentsFromRundowns) {
		const rundown = cache.Rundowns.findOne(rundownId)
		if (rundown?.restoredFromSnapshotId) {
			// This is not valid as the rundownId won't match the externalId, so ingest will fail
			// For now do nothing
		} else if (rundown) {
			await context.queueIngestJob(IngestJobs.RemoveOrphanedSegments, {
				rundownExternalId: rundown.externalId,
				peripheralDeviceId: null,
				orphanedHiddenSegmentIds: candidateSegmentIds.hidden,
				orphanedDeletedSegmentIds: candidateSegmentIds.deleted,
			})
		}
	}

	const removePartInstanceIds: PartInstanceId[] = []
	// Cleanup any orphaned partinstances once they are no longer being played (and the segment isnt orphaned)
	const orphanedInstances = cache.PartInstances.findAll((p) => p.orphaned === 'deleted' && !p.reset)
	for (const partInstance of orphanedInstances) {
		if (PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS && orphanedSegmentIds.has(partInstance.segmentId)) {
			// If the segment is also orphaned, then don't delete it until it is clear
			continue
		}

		if (partInstance._id !== playlist.currentPartInstanceId && partInstance._id !== playlist.nextPartInstanceId) {
			removePartInstanceIds.push(partInstance._id)
		}
	}

	// Cleanup any instances from above
	if (removePartInstanceIds.length > 0) {
		resetPartInstancesWithPieceInstances(context, cache, { _id: { $in: removePartInstanceIds } })
	}
}

export function setNextSegment(context: JobContext, cache: CacheForPlayout, nextSegment: DBSegment | null): void {
	const span = context.startSpan('setNextSegment')
	if (nextSegment) {
		// Just run so that errors will be thrown if something wrong:
		const partsInSegment = cache.Parts.findAll((p) => p.segmentId === nextSegment._id)
		if (!partsInSegment.find((p) => isPartPlayable(p))) {
			throw new Error('Segment contains no valid parts')
		}

		cache.Playlist.update((p) => {
			p.nextSegmentId = nextSegment._id
			return p
		})
	} else {
		cache.Playlist.update((p) => {
			delete p.nextSegmentId
			return p
		})
	}
	if (span) span.end()
}
