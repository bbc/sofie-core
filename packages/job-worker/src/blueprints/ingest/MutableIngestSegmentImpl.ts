import type {
	IngestPart,
	IngestSegment,
	MutableIngestPart,
	MutableIngestSegment,
} from '@sofie-automation/blueprints-integration'
import { Complete, clone, omit } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { MutableIngestPartImpl } from './MutableIngestPartImpl'
import { RundownIngestDataCacheGenerator } from '../../ingest/ingestCache'
import { SofieIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { getSegmentId } from '../../ingest/lib'
import { IngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface MutableIngestSegmentChanges {
	ingestParts: IngestPart[]
	changedCacheObjects: SofieIngestDataCacheObj[]
	allCacheObjectIds: IngestDataCacheObjId[]
	segmentHasChanges: boolean
	partIdsWithChanges: string[]
	partOrderHasChanged: boolean
	originalExternalId: string
}

export class MutableIngestSegmentImpl<TSegmentPayload = unknown, TPartPayload = unknown>
	implements MutableIngestSegment<TSegmentPayload, TPartPayload>
{
	readonly #ingestSegment: Omit<IngestSegment, 'rank' | 'parts'>
	#originalExternalId: string
	#segmentHasChanges = false
	#partOrderHasChanged = false

	readonly #parts: MutableIngestPartImpl<TPartPayload>[]

	get originalExternalId(): string | undefined {
		if (this.#originalExternalId !== this.externalId) {
			return this.#originalExternalId
		} else {
			return undefined
		}
	}

	constructor(ingestSegment: Omit<IngestSegment, 'rank'>, hasChanges = false) {
		this.#originalExternalId = ingestSegment.externalId
		this.#ingestSegment = omit(ingestSegment, 'parts')
		this.#parts = ingestSegment.parts
			.slice() // shallow copy
			.sort((a, b) => a.rank - b.rank)
			.map((part) => new MutableIngestPartImpl<TPartPayload>(part, hasChanges))
		this.#segmentHasChanges = hasChanges
	}

	get parts(): MutableIngestPart<TPartPayload>[] {
		return this.#parts.slice() // shallow copy
	}

	get externalId(): string {
		return this.#ingestSegment.externalId
	}

	get name(): string {
		return this.#ingestSegment.name
	}

	get payload(): ReadonlyDeep<TSegmentPayload> | undefined {
		return this.#ingestSegment.payload
	}

	get userEditStates(): Record<string, boolean> | undefined {
		return this.#ingestSegment.userEditStates
	}

	getPart(partExternalId: string): MutableIngestPart<TPartPayload> | undefined {
		return this.#parts.find((part) => part.externalId === partExternalId)
	}

	movePartBefore(partExternalId: string, beforePartExternalId: string | null): void {
		if (partExternalId === beforePartExternalId) throw new Error('Cannot move Part before itself')

		const part = this.#parts.find((p) => p.externalId === partExternalId)
		if (!part) throw new Error(`Part "${partExternalId}" not found`)

		this.#removePart(partExternalId)

		if (beforePartExternalId) {
			const beforeIndex = this.#parts.findIndex((p) => p.externalId === beforePartExternalId)
			if (beforeIndex === -1) throw new Error(`Part "${beforePartExternalId}" not found`)

			this.#parts.splice(beforeIndex, 0, part)
		} else {
			this.#parts.push(part)
		}

		this.#partOrderHasChanged = true
	}

	movePartAfter(partExternalId: string, afterPartExternalId: string | null): void {
		if (partExternalId === afterPartExternalId) throw new Error('Cannot move Part after itself')

		const part = this.#parts.find((p) => p.externalId === partExternalId)
		if (!part) throw new Error(`Part "${partExternalId}" not found`)

		this.#removePart(partExternalId)

		if (afterPartExternalId) {
			const beforeIndex = this.#parts.findIndex((p) => p.externalId === afterPartExternalId)
			if (beforeIndex === -1) throw new Error(`Part "${afterPartExternalId}" not found`)

			this.#parts.splice(beforeIndex + 1, 0, part)
		} else {
			this.#parts.unshift(part)
		}

		this.#partOrderHasChanged = true
	}

	replacePart(
		ingestPart: Omit<IngestPart, 'rank'>,
		beforePartExternalId: string | null
	): MutableIngestPart<TPartPayload> {
		if (ingestPart.externalId === beforePartExternalId) throw new Error('Cannot insert Part before itself')

		this.#removePart(ingestPart.externalId)

		const newPart = new MutableIngestPartImpl<TPartPayload>(ingestPart, true)

		if (beforePartExternalId) {
			const beforeIndex = this.#parts.findIndex((s) => s.externalId === beforePartExternalId)
			if (beforeIndex === -1) throw new Error(`Part "${beforePartExternalId}" not found`)

			this.#parts.splice(beforeIndex, 0, newPart)
		} else {
			this.#parts.push(newPart)
		}

		this.#partOrderHasChanged = true

		return newPart
	}

	/**
	 * Remove a part
	 * Note: this is separate from the removePart method to allow for internal use when methods are overridden in tests
	 */
	#removePart(partExternalId: string): boolean {
		const index = this.#parts.findIndex((part) => part.externalId === partExternalId)
		if (index === -1) {
			return false
		}

		this.#parts.splice(index, 1)
		this.#partOrderHasChanged = true

		return true
	}

	removePart(partExternalId: string): boolean {
		return this.#removePart(partExternalId)
	}

	forceRegenerate(): void {
		this.#segmentHasChanges = true
	}

	#setUserEditState(key: string, protect: boolean): boolean {
		console.log('setProtectFromNrcsUpdates', protect)
		if (this.#ingestSegment.userEditStates !== undefined) {
			this.#ingestSegment.userEditStates[key] = protect
			this.#segmentHasChanges = true
		}
		return true
	}

	setUserEditState(key: string, protect: boolean): boolean {
		return this.#setUserEditState(key, protect)
	}

	/**
	 * Note: This is not exposed to blueprints
	 */
	setExternalId(newSegmentExternalId: string): void {
		this.#ingestSegment.externalId = newSegmentExternalId
	}
	/**
	 * Note: This is not exposed to blueprints
	 */
	setOriginalExternalId(oldSegmentExternalId: string): void {
		this.#originalExternalId = oldSegmentExternalId
	}

	setName(name: string): void {
		if (this.#ingestSegment.name !== name) {
			this.#ingestSegment.name = name
			this.#segmentHasChanges = true
		}
	}

	replacePayload(payload: ReadonlyDeep<TSegmentPayload> | TSegmentPayload): void {
		if (this.#segmentHasChanges || !_.isEqual(this.#ingestSegment.payload, payload)) {
			this.#ingestSegment.payload = clone(payload)
			this.#segmentHasChanges = true
		}
	}

	setPayloadProperty<TKey extends keyof TSegmentPayload>(key: TKey, value: TSegmentPayload[TKey]): void {
		if (!this.#ingestSegment.payload) {
			throw new Error('Segment payload is not set')
		}

		if (this.#segmentHasChanges || !_.isEqual(this.#ingestSegment.payload[key], value)) {
			this.#ingestSegment.payload[key] = clone(value)
			this.#segmentHasChanges = true
		}
	}

	/**
	 * setUserEditState
	 */
	setPartUserEditState(segmentExternalId: string, key: string, protect: boolean): void {
		const part = this.#parts.find((s) => s.externalId === segmentExternalId)
		if (!part) throw new Error(`Segment "${segmentExternalId}" not found`)
		part.setUserEditState(key, protect)
	}

	intoChangesInfo(generator: RundownIngestDataCacheGenerator): MutableIngestSegmentChanges {
		const ingestParts: IngestPart[] = []
		const changedCacheObjects: SofieIngestDataCacheObj[] = []
		const allCacheObjectIds: IngestDataCacheObjId[] = []
		const partIdsWithChanges: string[] = []

		const segmentId = getSegmentId(generator.rundownId, this.#ingestSegment.externalId)

		this.#parts.forEach((part, rank) => {
			const ingestPart: Complete<IngestPart> = {
				externalId: part.externalId,
				rank,
				name: part.name,
				payload: part.payload,
				userEditStates: {},
			}

			allCacheObjectIds.push(generator.getPartObjectId(ingestPart.externalId))
			ingestParts.push(ingestPart)

			if (part.checkAndClearChangesFlags()) {
				changedCacheObjects.push(generator.generatePartObject(segmentId, ingestPart))
				partIdsWithChanges.push(ingestPart.externalId)
			}
		})

		const segmentHasChanges = this.#segmentHasChanges
		const partOrderHasChanged = this.#partOrderHasChanged
		const originalExternalId = this.#originalExternalId

		// clear flags
		this.#segmentHasChanges = false
		this.#partOrderHasChanged = false
		this.#originalExternalId = this.#ingestSegment.externalId

		return {
			ingestParts,
			changedCacheObjects,
			allCacheObjectIds,
			segmentHasChanges,
			partIdsWithChanges,
			partOrderHasChanged,
			originalExternalId,
		}
	}
}
