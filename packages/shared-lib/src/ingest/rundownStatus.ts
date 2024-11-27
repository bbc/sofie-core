import type { RundownId } from '../core/model/Ids'

export interface IngestRundownStatus {
	_id: RundownId

	/** Rundown external id */
	id: string

	segments: IngestSegmentStatus[]

	// Future: the rundown could have a status that we report?
}

export interface IngestSegmentStatus {
	/** Segment external id */
	id: string

	parts: IngestPartStatus[]
}

export interface IngestPartStatus {
	/** Part external id */
	id: string

	isReady: boolean | null

	playbackStatus: IngestPartPlaybackStatus
}

export enum IngestPartPlaybackStatus {
	UNKNOWN = 'unknown',
	PLAYING = 'playing',
	STOPPED = 'stopped',
}
