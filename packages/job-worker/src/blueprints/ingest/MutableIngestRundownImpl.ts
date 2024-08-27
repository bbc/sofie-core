import type {
	IngestSegment,
	MutableIngestRundown,
	MutableIngestSegment,
	MutableIngestPart,
} from '@sofie-automation/blueprints-integration'
import { Complete, clone, omit } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { MutableIngestSegmentImpl } from './MutableIngestSegmentImpl'
import { IngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownIngestDataCacheGenerator } from '../../ingest/ingestCache'
import {
	IngestRundownWithSource,
	NrcsIngestDataCacheObj,
} from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import type { ComputedIngestChangeObject } from '../../ingest/runOperation'
import { RundownSource } from '@sofie-automation/corelib/dist/dataModel/Rundown'

export interface MutableIngestRundownChanges {
	// define what needs regenerating
	computedChanges: ComputedIngestChangeObject

	// define what portions of the ingestRundown need saving
	changedCacheObjects: NrcsIngestDataCacheObj[]
	allCacheObjectIds: IngestDataCacheObjId[]
}

export class MutableIngestRundownImpl<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown>
	implements MutableIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>
{
	readonly ingestRundown: Omit<IngestRundownWithSource, 'segments'>
	#hasChangesToRundown = false
	// #segmentOrderChanged = false

	readonly #segments: MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>[]

	readonly #originalSegmentRanks = new Map<string, number>()

	constructor(ingestRundown: IngestRundownWithSource, isExistingRundown: boolean) {
		this.ingestRundown = omit(ingestRundown, 'segments')
		this.#segments = ingestRundown.segments
			.slice() // shallow copy
			.sort((a, b) => a.rank - b.rank)
			.map((segment) => new MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>(segment, !isExistingRundown))
		this.#hasChangesToRundown = !isExistingRundown

		for (const segment of ingestRundown.segments) {
			this.#originalSegmentRanks.set(segment.externalId, segment.rank)
		}
	}

	get segments(): MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>[] {
		return this.#segments.slice() // shallow copy
	}

	get externalId(): string {
		return this.ingestRundown.externalId
	}

	get type(): string {
		return this.ingestRundown.type
	}

	get name(): string {
		return this.ingestRundown.name
	}

	get payload(): ReadonlyDeep<TRundownPayload> | undefined {
		return this.ingestRundown.payload
	}

	/**
	 * Internal method to propogate the rundown source
	 */
	updateRundownSource(source: RundownSource): void {
		if (!_.isEqual(source, this.ingestRundown.rundownSource)) {
			this.ingestRundown.rundownSource = source
			this.#hasChangesToRundown = true
		}
	}

	setName(name: string): void {
		if (this.ingestRundown.name !== name) {
			this.ingestRundown.name = name
			this.#hasChangesToRundown = true
		}
	}

	forceFullRegenerate(): void {
		this.#hasChangesToRundown = true
	}

	replacePayload(payload: ReadonlyDeep<TRundownPayload> | TRundownPayload): void {
		if (this.#hasChangesToRundown || !_.isEqual(this.ingestRundown.payload, payload)) {
			this.ingestRundown.payload = clone(payload)
			this.#hasChangesToRundown = true
		}
	}

	setPayloadProperty<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void {
		if (!this.ingestRundown.payload) {
			throw new Error('Rundown payload is not set')
		}

		if (this.#hasChangesToRundown || !_.isEqual(this.ingestRundown.payload[key], value)) {
			this.ingestRundown.payload[key] = clone(value)
			this.#hasChangesToRundown = true
		}
	}

	findPart(partExternalId: string): MutableIngestPart<TPartPayload> | undefined {
		for (const segment of this.#segments) {
			const part = segment.getPart(partExternalId)
			if (part) return part
		}

		return undefined
	}

	findPartAndSegment(partExternalId: string):
		| {
				part: MutableIngestPart<TPartPayload>
				segment: MutableIngestSegment<TSegmentPayload, TPartPayload>
		  }
		| undefined {
		for (const segment of this.#segments) {
			const part = segment.getPart(partExternalId)
			if (part) return { part, segment }
		}
		return undefined
	}

	getSegment(segmentExternalId: string): MutableIngestSegment<TSegmentPayload, TPartPayload> | undefined {
		return this.#segments.find((s) => s.externalId === segmentExternalId)
	}

	moveSegmentBefore(segmentExternalId: string, beforeSegmentExternalId: string | null): void {
		if (segmentExternalId === beforeSegmentExternalId) throw new Error('Cannot move Segment before itself')

		const segment = this.#segments.find((s) => s.externalId === segmentExternalId)
		if (!segment) throw new Error(`Segment "${segmentExternalId}" not found`)

		this.#removeSegment(segmentExternalId)

		if (beforeSegmentExternalId) {
			const beforeIndex = this.#segments.findIndex((s) => s.externalId === beforeSegmentExternalId)
			if (beforeIndex === -1) throw new Error(`Segment "${beforeSegmentExternalId}" not found`)

			this.#segments.splice(beforeIndex, 0, segment)
		} else {
			this.#segments.push(segment)
		}

		// this.#segmentOrderChanged = true
	}

	moveSegmentAfter(segmentExternalId: string, afterSegmentExternalId: string | null): void {
		if (segmentExternalId === afterSegmentExternalId) throw new Error('Cannot move Segment after itself')

		const segment = this.#segments.find((s) => s.externalId === segmentExternalId)
		if (!segment) throw new Error(`Segment "${segmentExternalId}" not found`)

		this.#removeSegment(segmentExternalId)

		if (afterSegmentExternalId) {
			const beforeIndex = this.#segments.findIndex((s) => s.externalId === afterSegmentExternalId)
			if (beforeIndex === -1) throw new Error(`Segment "${afterSegmentExternalId}" not found`)

			this.#segments.splice(beforeIndex + 1, 0, segment)
		} else {
			this.#segments.unshift(segment)
		}

		// this.#segmentOrderChanged = true
	}

	replaceSegment(
		segment: Omit<IngestSegment, 'rank'>,
		beforeSegmentExternalId: string | null
	): MutableIngestSegment<TSegmentPayload, TPartPayload> {
		if (segment.externalId === beforeSegmentExternalId) throw new Error('Cannot insert Segment before itself')

		const newSegment = new MutableIngestSegmentImpl<TSegmentPayload, TPartPayload>(segment, true)

		const oldSegment = this.#segments.find((s) => s.externalId === segment.externalId)
		if (oldSegment?.originalExternalId) {
			newSegment.setOriginalExternalId(oldSegment.originalExternalId)
		}

		this.#removeSegment(segment.externalId)

		if (beforeSegmentExternalId) {
			const beforeIndex = this.#segments.findIndex((s) => s.externalId === beforeSegmentExternalId)
			if (beforeIndex === -1) throw new Error(`Segment "${beforeSegmentExternalId}" not found`)

			this.#segments.splice(beforeIndex, 0, newSegment)
		} else {
			this.#segments.push(newSegment)
		}

		// this.#segmentOrderChanged = true

		return newSegment
	}

	changeSegmentExternalId(
		oldSegmentExternalId: string,
		newSegmentExternalId: string
	): MutableIngestSegment<TSegmentPayload, TPartPayload> {
		const segment = this.#segments.find((s) => s.externalId === oldSegmentExternalId)
		if (!segment) throw new Error(`Segment "${oldSegmentExternalId}" not found`)

		const targetSegment = this.#segments.find((s) => s.externalId === newSegmentExternalId)
		if (targetSegment) throw new Error(`Segment "${newSegmentExternalId}" already exists`)

		segment.setExternalId(newSegmentExternalId)

		return segment
	}

	changeSegmentOriginalExternalId(
		segmentExternalId: string,
		originalSegmentExternalId: string
	): MutableIngestSegment<TSegmentPayload, TPartPayload> {
		const segment = this.#segments.find((s) => s.externalId === segmentExternalId)
		if (!segment) throw new Error(`Segment "${segmentExternalId}" not found`)

		const targetSegment = this.#segments.find((s) => s.externalId === originalSegmentExternalId)
		if (targetSegment) throw new Error(`Segment "${originalSegmentExternalId}" exists`)

		segment.setOriginalExternalId(originalSegmentExternalId)

		return segment
	}

	/**
	 * Remove a segment
	 * Note: this is separate from the removeSegment method to allow for internal use when methods are overridden in tests
	 */
	#removeSegment(segmentExternalId: string): boolean {
		const existingIndex = this.#segments.findIndex((s) => s.externalId === segmentExternalId)
		if (existingIndex !== -1) {
			this.#segments.splice(existingIndex, 1)

			// this.#segmentOrderChanged = true

			return true
		} else {
			return false
		}
	}

	removeSegment(segmentExternalId: string): boolean {
		return this.#removeSegment(segmentExternalId)
	}

	removeAllSegments(): void {
		this.#segments.length = 0

		// this.#segmentOrderChanged = true
	}

	/**
	 * getUserEditState
	 */
	getSegmentUserEditState(segmentExternalId: string, key: string): boolean {
		const segment = this.#segments.find((s) => s.externalId === segmentExternalId)
		if (!segment) throw new Error(`Segment "${segmentExternalId}" not found`)
		return segment.userEditStates?.[key] ?? false
	}
	/**
	 * setUserEditState
	 */
	setSegmentUserEditState(segmentExternalId: string, key: string, protect: boolean): void {
		const segment = this.#segments.find((s) => s.externalId === segmentExternalId)
		if (!segment) throw new Error(`Segment "${segmentExternalId}" not found`)
		segment.setUserEditState(key, protect)
	}

	/** Note: This is NOT exposed to blueprints */
	intoIngestRundown(ingestObjectGenerator: RundownIngestDataCacheGenerator): MutableIngestRundownChanges {
		const ingestSegments: IngestSegment[] = []
		const changedCacheObjects: NrcsIngestDataCacheObj[] = []
		const allCacheObjectIds: IngestDataCacheObjId[] = []

		const segmentsToRegenerate: IngestSegment[] = []
		const segmentExternalIdChanges: Record<string, string> = {}
		const segmentsUpdatedRanks: Record<string, number> = {}

		const usedSegmentIds = new Set<string>()
		const usedPartIds = new Set<string>()

		this.#segments.forEach((segment, rank) => {
			if (usedSegmentIds.has(segment.externalId)) {
				throw new Error(`Segment "${segment.externalId}" is used more than once`)
			}
			usedSegmentIds.add(segment.externalId)

			const segmentInfo = segment.intoChangesInfo(ingestObjectGenerator)

			for (const part of segmentInfo.ingestParts) {
				if (usedPartIds.has(part.externalId)) {
					throw new Error(`Part "${part.externalId}" is used more than once`)
				}
				usedPartIds.add(part.externalId)
			}

			const ingestSegment: Complete<IngestSegment> = {
				externalId: segment.externalId,
				rank,
				name: segment.name,
				payload: segment.payload,
				parts: segmentInfo.ingestParts,
				userEditStates: { ...segment.userEditStates },
			}

			ingestSegments.push(ingestSegment)
			allCacheObjectIds.push(ingestObjectGenerator.getSegmentObjectId(ingestSegment.externalId))

			changedCacheObjects.push(...segmentInfo.changedCacheObjects)
			allCacheObjectIds.push(...segmentInfo.allCacheObjectIds)

			// Check for any changes to the rank
			const oldRank =
				(segment.originalExternalId ? this.#originalSegmentRanks.get(segment.originalExternalId) : null) ??
				this.#originalSegmentRanks.get(segment.externalId)
			const rankChanged = ingestSegment.rank !== oldRank
			if (rankChanged) {
				segmentsUpdatedRanks[segment.externalId] = ingestSegment.rank
			}

			// Check for any changes to the externalId
			const externalIdChanged = segmentInfo.originalExternalId !== segment.externalId
			if (externalIdChanged) {
				segmentExternalIdChanges[segmentInfo.originalExternalId] = segment.externalId
			}

			// Update ingest cache if there are changes
			if (segmentInfo.segmentHasChanges || rankChanged || externalIdChanged) {
				changedCacheObjects.push(ingestObjectGenerator.generateSegmentObject(ingestSegment))
			}

			// Regenerate the segment if there are substantial changes
			if (
				segmentInfo.segmentHasChanges ||
				segmentInfo.partOrderHasChanged ||
				segmentInfo.partIdsWithChanges.length > 0
			) {
				segmentsToRegenerate.push(ingestSegment)
			}
		})

		// Find any removed segments
		const newSegmentIds = new Set(ingestSegments.map((s) => s.externalId))
		const removedSegmentIds = Array.from(this.#originalSegmentRanks.keys()).filter(
			(id) => !newSegmentIds.has(id) && !segmentExternalIdChanges[id]
		)

		// Check if this rundown object has changed
		if (this.#hasChangesToRundown) {
			changedCacheObjects.push(ingestObjectGenerator.generateRundownObject(this.ingestRundown))
		}
		allCacheObjectIds.push(ingestObjectGenerator.getRundownObjectId())

		const regenerateRundown = this.#hasChangesToRundown

		this.#hasChangesToRundown = false
		// this.#segmentOrderChanged = false

		// Reset this.#originalSegmentRanks
		this.#originalSegmentRanks.clear()
		this.#segments.forEach((segment, rank) => {
			this.#originalSegmentRanks.set(segment.externalId, rank)
		})

		const result: MutableIngestRundownChanges = {
			computedChanges: {
				ingestRundown: {
					...this.ingestRundown,
					segments: ingestSegments,
				},

				segmentsToRemove: removedSegmentIds,
				segmentsUpdatedRanks,
				segmentsToRegenerate,
				regenerateRundown,
				segmentExternalIdChanges: segmentExternalIdChanges,
			},

			changedCacheObjects,
			allCacheObjectIds,
		}

		return result
	}
}