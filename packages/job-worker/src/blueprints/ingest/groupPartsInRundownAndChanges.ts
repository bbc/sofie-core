import {
	GroupPartsInMosRundownAndChangesResult,
	IngestChangeType,
	IngestPart,
	IngestRundown,
	IngestSegment,
	NrcsIngestChangeDetails,
	NrcsIngestPartChangeDetails,
	NrcsIngestRundownChangeDetails,
	NrcsIngestSegmentChangeDetails,
	NrcsIngestSegmentChangeDetailsEnum,
} from '@sofie-automation/blueprints-integration'
import { Complete, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')

export function groupMosPartsIntoIngestSegments(
	rundownExternalId: string,
	ingestSegments: IngestSegment[],
	separator: string
): IngestSegment[] {
	const groupedParts: { name: string; parts: IngestPart[] }[] = []

	for (const ingestSegment of ingestSegments) {
		const segmentName = ingestSegment.name.split(separator)[0] || ingestSegment.name

		const lastSegment = _.last(groupedParts)
		if (lastSegment && lastSegment.name === segmentName) {
			lastSegment.parts.push(...ingestSegment.parts)
		} else {
			groupedParts.push({ name: segmentName, parts: [...ingestSegment.parts] })
		}
	}

	return groupedParts.map(
		(partGroup, i) =>
			({
				externalId: `${rundownExternalId}_${partGroup.name}_${partGroup.parts[0].externalId}`,
				name: partGroup.name,
				rank: i,
				parts: partGroup.parts.map((part, i) => ({ ...part, rank: i })),
			} satisfies IngestSegment)
	)
}

/**
 * Group Parts in a Rundown and return a new changes object
 * Note: This ignores a lot of the contents of the `ingestChanges` object, and relies more on the `previousNrcsIngestRundown` instead
 * @param nrcsIngestRundown The rundown whose parts needs grouping
 * @param previousNrcsIngestRundown The rundown prior to the changes, if known
 * @param ingestChanges The changes which have been performed in `nrcsIngestRundown`, that need to translating
 * @param groupPartsIntoSegmentsOrSeparator A string to split the segment name on, or a function to group parts into segments
 * @returns A transformed rundown and changes object
 */
export function groupPartsInRundownAndChanges(
	nrcsIngestRundown: IngestRundown,
	previousNrcsIngestRundown: IngestRundown | undefined,
	ingestChanges: Omit<NrcsIngestChangeDetails, 'segmentOrderChanged'>,
	groupPartsIntoSegments: (ingestSegments: IngestSegment[]) => IngestSegment[]
): GroupPartsInMosRundownAndChangesResult {
	// Combine parts into segments
	const combinedIngestRundown = groupPartsIntoNewIngestRundown(nrcsIngestRundown, groupPartsIntoSegments)

	// If there is no previous rundown, we need to regenerate everything
	if (!previousNrcsIngestRundown) {
		return {
			nrcsIngestRundown: combinedIngestRundown,
			ingestChanges: {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		}
	}

	// Combine parts into segments, in both the new and old ingest rundowns
	const oldCombinedIngestRundown = groupPartsIntoNewIngestRundown(previousNrcsIngestRundown, groupPartsIntoSegments)

	// Calculate the changes to each segment
	const allPartWithChanges = findAllPartsWithChanges(nrcsIngestRundown, ingestChanges)
	const segmentChanges = calculateSegmentChanges(oldCombinedIngestRundown, combinedIngestRundown, allPartWithChanges)

	// Calculate other changes
	const changedSegmentExternalIds = calculateSegmentExternalIdChanges(oldCombinedIngestRundown, combinedIngestRundown)
	const segmentOrderChanged = hasSegmentOrderChanged(
		combinedIngestRundown.segments,
		oldCombinedIngestRundown.segments
	)

	// Ensure id changes aren't flagged as deletions
	for (const [oldSegmentExternalId, newSegmentExternalId] of Object.entries<string>(changedSegmentExternalIds)) {
		if (!oldSegmentExternalId || !newSegmentExternalId) continue

		if (segmentChanges[oldSegmentExternalId] === NrcsIngestSegmentChangeDetailsEnum.Deleted) {
			delete segmentChanges[oldSegmentExternalId]
		}
	}

	return {
		nrcsIngestRundown: combinedIngestRundown,
		ingestChanges: {
			source: IngestChangeType.Ingest,
			rundownChanges: ingestChanges.rundownChanges,
			segmentOrderChanged,
			segmentChanges,
			changedSegmentExternalIds,
		} satisfies Complete<NrcsIngestChangeDetails>,
	}
}

function findAllPartsWithChanges(
	nrcsIngestRundown: IngestRundown,
	sourceChanges: NrcsIngestChangeDetails
): Set<string> {
	if (!sourceChanges.segmentChanges) return new Set()

	const partChanges = new Set<string>()

	for (const segment of nrcsIngestRundown.segments) {
		const segmentChanges = sourceChanges.segmentChanges[segment.externalId]
		if (!segmentChanges) continue

		for (const part of segment.parts) {
			switch (segmentChanges) {
				case NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated:
					// This could have been an update, ensure that gets propogated
					partChanges.add(part.externalId)
					break
				case NrcsIngestSegmentChangeDetailsEnum.Deleted:
					// Deletions will be tracked elsewhere
					break
				default:
					if (typeof segmentChanges !== 'object')
						throw new Error(`Unexpected segment change for "${segment.externalId}": ${segmentChanges}`)

					// Something changed, this will cause the necessary propogation
					partChanges.add(part.externalId)

					break
			}
		}
	}

	return partChanges
}

function calculateSegmentChanges(
	oldCombinedIngestRundown: IngestRundown,
	combinedIngestRundown: IngestRundown,
	allPartWithChanges: Set<string>
): Record<string, NrcsIngestSegmentChangeDetails> {
	const oldIngestSegments = normalizeArrayToMap(oldCombinedIngestRundown.segments, 'externalId')

	const segmentChanges: Record<string, NrcsIngestSegmentChangeDetails> = {}

	// Track any segment changes
	for (const segment of combinedIngestRundown.segments) {
		const oldIngestSegment = oldIngestSegments.get(segment.externalId)

		if (!oldIngestSegment) {
			segmentChanges[segment.externalId] = NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated
		} else {
			const segmentPartChanges: Record<string, NrcsIngestPartChangeDetails> = {}

			const newPartIds = new Set(segment.parts.map((p) => p.externalId))
			const oldPartMap = normalizeArrayToMap(oldIngestSegment.parts, 'externalId')

			for (const part of segment.parts) {
				const oldPart = oldPartMap.get(part.externalId)
				if (!oldPart) {
					segmentPartChanges[part.externalId] = NrcsIngestPartChangeDetails.Inserted
				} else if (allPartWithChanges.has(part.externalId)) {
					segmentPartChanges[part.externalId] = NrcsIngestPartChangeDetails.Updated
				}
			}
			for (const oldPart of oldIngestSegment.parts) {
				if (!newPartIds.has(oldPart.externalId)) {
					segmentPartChanges[oldPart.externalId] = NrcsIngestPartChangeDetails.Deleted
				}
			}

			const partOrderChanged = hasPartOrderChanged(segment.parts, oldIngestSegment.parts)
			if (partOrderChanged || Object.keys(segmentPartChanges).length > 0) {
				segmentChanges[segment.externalId] = {
					partChanges: segmentPartChanges,
					partOrderChanged,
				}
			}
		}
	}

	// Track any segment deletions
	if (oldCombinedIngestRundown) {
		const newSegmentIds = new Set(combinedIngestRundown.segments.map((s) => s.externalId))
		for (const oldSegment of oldCombinedIngestRundown.segments) {
			if (!newSegmentIds.has(oldSegment.externalId)) {
				segmentChanges[oldSegment.externalId] = NrcsIngestSegmentChangeDetailsEnum.Deleted
			}
		}
	}

	return segmentChanges
}

function hasSegmentOrderChanged(ingestSegments: IngestSegment[], oldIngestSegments: IngestSegment[]): boolean {
	if (ingestSegments.length !== oldIngestSegments.length) return true

	for (let i = 0; i < ingestSegments.length; i++) {
		if (ingestSegments[i].externalId !== oldIngestSegments[i].externalId) return true
	}

	return false
}

function hasPartOrderChanged(ingestParts: IngestPart[], oldIngestParts: IngestPart[]): boolean {
	if (ingestParts.length !== oldIngestParts.length) return true

	for (let i = 0; i < ingestParts.length; i++) {
		if (ingestParts[i].externalId !== oldIngestParts[i].externalId) return true
	}

	return false
}

function groupPartsIntoNewIngestRundown(
	ingestRundown: IngestRundown,
	groupPartsIntoIngestSements: (ingestSegments: IngestSegment[]) => IngestSegment[]
): IngestRundown {
	return {
		...ingestRundown,
		segments: groupPartsIntoIngestSements(ingestRundown.segments),
	}
}

function calculateSegmentExternalIdChanges(
	oldIngestRundown: IngestRundown,
	newIngestRundown: IngestRundown
): Record<string, string> {
	const segmentExternalIdChanges: Record<string, string> = {}

	const oldIngestSegmentMap = normalizeArrayToMap(oldIngestRundown.segments, 'externalId')
	const newIngestSegmentMap = normalizeArrayToMap(newIngestRundown.segments, 'externalId')

	const removedSegments = oldIngestRundown.segments.filter((s) => !newIngestSegmentMap.has(s.externalId))
	let addedSegments = newIngestRundown.segments.filter((s) => !oldIngestSegmentMap.has(s.externalId))

	if (removedSegments.length === 0 || addedSegments.length === 0) return {}

	for (const removedSegment of removedSegments) {
		let newSegmentExternalId: string | undefined

		// try finding "it" in the added, using name
		// Future: this may not be particularly accurate, as multiple could have been formed
		newSegmentExternalId = addedSegments.find((se) => se.name === removedSegment.name)?.externalId

		if (!newSegmentExternalId) {
			// second try, match with any parts:
			newSegmentExternalId = addedSegments.find((se) => {
				for (const part of removedSegment.parts) {
					if (se.parts.find((p) => p.externalId === part.externalId)) {
						return true
					}
				}

				return false
			})?.externalId
		}
		if (newSegmentExternalId) {
			segmentExternalIdChanges[removedSegment.externalId] = newSegmentExternalId

			// Ensure the same id doesn't get used multiple times
			addedSegments = addedSegments.filter((s) => s.externalId !== newSegmentExternalId)
		}
	}

	return segmentExternalIdChanges
}