import { SofieIngestRundown, SofieIngestSegment, SofieIngestPart } from '@sofie-automation/blueprints-integration'
import { SofieIngestDataCacheObjId, RundownId, SegmentId, PartId } from './Ids'
import { RundownSource } from './Rundown'

export enum SofieIngestCacheType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}
export type SofieIngestCacheData = SofieIngestRundown | SofieIngestSegment | SofieIngestPart

export interface SofieIngestRundownWithSource extends SofieIngestRundown {
	rundownSource: RundownSource
}

interface SofieIngestDataCacheBase {
	_id: SofieIngestDataCacheObjId
	modified: number
	type: SofieIngestCacheType

	/** Id of the Rundown */
	rundownId: RundownId
	segmentId?: SegmentId
	partId?: PartId

	data: SofieIngestCacheData
}

export interface SofieIngestDataCacheObjRundown extends SofieIngestDataCacheBase {
	type: SofieIngestCacheType.RUNDOWN
	rundownId: RundownId
	data: SofieIngestRundownWithSource
}

export interface SofieIngestDataCacheObjSegment extends SofieIngestDataCacheBase {
	type: SofieIngestCacheType.SEGMENT
	rundownId: RundownId
	segmentId: SegmentId
	data: SofieIngestSegment
}

export interface SofieIngestDataCacheObjPart extends SofieIngestDataCacheBase {
	type: SofieIngestCacheType.PART
	rundownId: RundownId
	segmentId: SegmentId
	partId: PartId
	data: SofieIngestPart
}

export type SofieIngestDataCacheObj =
	| SofieIngestDataCacheObjRundown
	| SofieIngestDataCacheObjSegment
	| SofieIngestDataCacheObjPart
