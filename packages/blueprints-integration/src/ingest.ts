import { IngestPart, IngestRundown, IngestSegment } from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'
import { IBlueprintRundownDBData } from './documents'
import { ReadonlyDeep } from 'type-fest'

export {
	IngestPart,
	IngestPlaylist,
	IngestRundown,
	IngestSegment,
	IngestAdlib,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'

/** The IngesteRundown is extended with data from Core */
export interface ExtendedIngestRundown extends IngestRundown {
	coreData: IBlueprintRundownDBData | undefined
}

export enum IncomingIngestPartChange {
	Inserted = 'inserted',
	Deleted = 'deleted',
	Payload = 'payload',
	// Rank = 'rank',
}
export enum IncomingIngestSegmentChangeEnum {
	Inserted = 'inserted',
	Deleted = 'deleted',
	// Contents = 'contents',
	// ContentsOrder = 'contentsOrder',
	// Payload = 'payload',
	// Rank = 'rank',
}
export enum IncomingIngestRundownChange {
	// Deleted = 'deleted',
	Payload = 'payload',
	// CoreData = 'coreData',
	Regenerate = 'regenerate',
}

export interface IncomingIngestSegmentChangeObject {
	/**
	 * If set, this Segment has been renamed from the specified id
	 * @deprecated This is temporary for MOS compatibility
	 */
	oldExternalId?: string

	/**
	 * True when the payload of the segment has changed.
	 */
	payloadChanged?: boolean

	/**
	 * True when the rank of any part in the segment has changed.
	 */
	partOrderChanged?: boolean

	/**
	 * Descibes the changes to the parts in the rundown
	 */
	partsChanges?: Record<string, IncomingIngestPartChange>
}

export type IncomingIngestSegmentChange = IncomingIngestSegmentChangeEnum | IncomingIngestSegmentChangeObject

export interface IncomingIngestChange {
	/** Indicate that this change is from ingest operations */
	source: 'ingest'

	/**
	 * True when the rank of any segment in the rundown has changed.
	 * Expressing what exactly has changed non-trivial particularly how to represent that in this structure, so for now we just have a simple boolean.
	 */
	segmentOrderChanged?: boolean

	/**
	 * Describes the changes to the rundown itself
	 */
	rundownChanges?: IncomingIngestRundownChange | null

	/**
	 * Describes the changes to the segments in the rundown
	 */
	segmentChanges?: Record<string, IncomingIngestSegmentChange>
}

export interface UserOperationChange {
	/** Indicate that this change is from user operations */
	source: 'user'

	payload: any // TODO - define this
}

export interface MutableIngestRundown<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the rundown as reported by the ingest gateway. Must be unique for each rundown owned by the gateway */
	readonly externalId: string
	/** Name of the rundown */
	readonly name: string

	/** Something that identified the data source. eg "spreadsheet", "mos" */
	readonly type: string

	/** Payload of rundown metadata. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TRundownPayload> | undefined

	// TODO - split payload into 'private' and 'public'? ie, one for `getRundown` and one for `getSegment`, so that we can affect the rundown generation without regenerating all of the segments.
	// Or should we expect this blueprint stage to copy any needed properties into each of the segment/part payloads?

	/** Array of segments in this rundown */
	readonly segments: ReadonlyArray<MutableIngestSegment<TSegmentPayload, TPartPayload>>

	findPart(id: string): MutableIngestPart<TPartPayload> | undefined

	findPartAndSegment(partExternalId: string):
		| {
				part: MutableIngestPart<TPartPayload>
				segment: MutableIngestSegment<TSegmentPayload, TPartPayload>
		  }
		| undefined

	getSegment(id: string): MutableIngestSegment<TSegmentPayload, TPartPayload> | undefined

	moveSegmentBefore(id: string, beforeSegmentExternalId: string | null): void
	moveSegmentAfter(id: string, afterSegmentExternalId: string | null): void

	replaceSegment(
		segment: IngestSegment,
		beforeSegmentExternalId: string | null
	): MutableIngestSegment<TSegmentPayload, TPartPayload>

	renameSegment(oldId: string, newId: string): MutableIngestSegment<TSegmentPayload, TPartPayload>

	removeSegment(id: string): boolean

	removeAllSegments(): void

	forceFullRegenerate(): void

	setName(name: string): void

	replacePayload(payload: ReadonlyDeep<TRundownPayload> | TRundownPayload): void

	setPayloadProperty<TKey extends keyof TRundownPayload>(key: TKey, value: TRundownPayload[TKey]): void

	defaultApplyIngestChanges(
		ingestRundown: IngestRundown,
		changes: IncomingIngestChange,
		options?: IngestDefaultChangesOptions<TRundownPayload, TSegmentPayload, TPartPayload>
	): void
}

export interface MutableIngestSegment<TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the segment as reported by the ingest gateway. Must be unique for each segment in the rundown */
	readonly externalId: string
	/** Name of the segment */
	readonly name: string
	// /** Rank of the segment within the rundown */
	// readonly rank: number

	/** Payload of segment metadata. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TSegmentPayload> | undefined

	/** Array of parts in this segment */
	readonly parts: ReadonlyArray<MutableIngestPart<TPartPayload>>

	getPart(id: string): MutableIngestPart<TPartPayload> | undefined

	movePartBefore(id: string, beforePartExternalId: string | null): void
	movePartAfter(id: string, afterPartExternalId: string | null): void

	replacePart(part: IngestPart, beforePartExternalId: string | null): MutableIngestPart<TPartPayload>

	removePart(id: string): boolean

	setName(name: string): void

	replacePayload(payload: ReadonlyDeep<TSegmentPayload> | TSegmentPayload): void

	setPayloadProperty<TKey extends keyof TSegmentPayload>(key: TKey, value: TSegmentPayload[TKey]): void
}

export interface MutableIngestPart<TPartPayload = unknown> {
	/** Id of the part as reported by the ingest gateway. Must be unique for each part in the rundown */
	readonly externalId: string
	/** Name of the part */
	readonly name: string
	// /** Rank of the part within the segment */
	// readonly rank: number

	/** Payload of the part. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TPartPayload> | undefined

	setName(name: string): void

	replacePayload(payload: ReadonlyDeep<TPartPayload> | TPartPayload): void

	setPayloadProperty<TKey extends keyof TPartPayload>(key: TKey, value: TPartPayload[TKey]): void
}

export interface IngestDefaultChangesOptions<
	TRundownPayload = unknown,
	TSegmentPayload = unknown,
	TPartPayload = unknown
> {
	transformRundownPayload: (payload: any) => TRundownPayload
	transformSegmentPayload: (payload: any) => TSegmentPayload
	transformPartPayload: (payload: any) => TPartPayload
}
