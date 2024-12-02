import type { RundownId } from '../core/model/Ids'

export interface IngestRundownStatus {
	_id: RundownId

	/** Rundown external id */
	externalId: string

	segments: IngestSegmentStatus[]

	// Future: the rundown could have a status that we report?
}

export interface IngestSegmentStatus {
	/** Segment external id */
	externalId: string

	parts: IngestPartStatus[]
}

export interface IngestPartStatus {
	/** Part external id */
	externalId: string

	isReady: boolean | null

	playbackStatus: IngestPartPlaybackStatus
}

export enum IngestPartPlaybackStatus {
	UNKNOWN = 'unknown',
	PLAY = 'play',
	STOP = 'stop',
}
