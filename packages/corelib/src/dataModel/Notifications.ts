import type { NoteSeverity } from '@sofie-automation/blueprints-integration'
import type {
	NotificationId,
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	StudioId,
} from './Ids'
import type { ITranslatableMessage } from '../TranslatableMessage'

export interface DBNotificationObj {
	_id: NotificationId

	/**
	 * Used to group a certain group of notifications
	 * Each source of these notifications should use its own value, so that it can find and cleanup after itself when appropriate
	 */
	category: string

	/**
	 * Unique id for this notification within the category
	 */
	localId: string

	// /**
	//  * Source of the notification
	//  * This is a stricter ???
	//  */
	// source: 'system' | 'ingest' | 'playout'

	severity: NoteSeverity
	message: ITranslatableMessage
	// type: 'event' | 'persistent'

	/** Description of what the notification is related to */
	relatedTo: DBNotificationTarget

	created: number // unix timestamp
	modified: number // unix timestamp

	// /**
	//  * When set, the notification will be automatically dismissed after this time
	//  * For events, this is typically set to less than a minute
	//  * For persistent notifications, this is never set
	//  */
	// autoTimeout?: number // unix timestamp
}

export type DBNotificationTarget =
	| DBNotificationTargetEverywhere
	| DBNotificationTargetStudio
	| DBNotificationTargetRundown
	| DBNotificationTargetSegment
	| DBNotificationTargetPart
	| DBNotificationTargetPiece
	| DBNotificationTargetRundownPlaylist
	| DBNotificationTargetPartInstance
	| DBNotificationTargetPieceInstance

export enum DBNotificationTargetType {
	EVERYWHERE = 'everywhere',
	STUDIO = 'studio',
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
	PIECE = 'piece',
	PLAYLIST = 'playlist',
	PARTINSTANCE = 'partInstance',
	PIECEINSTANCE = 'pieceInstance',
}

export interface DBNotificationTargetEverywhere {
	type: DBNotificationTargetType.EVERYWHERE
}

export interface DBNotificationTargetStudio {
	type: DBNotificationTargetType.STUDIO
	studioId: StudioId
}

export interface DBNotificationTargetRundown {
	type: DBNotificationTargetType.RUNDOWN
	studioId: StudioId
	rundownId: RundownId
}

export interface DBNotificationTargetSegment {
	type: DBNotificationTargetType.SEGMENT
	studioId: StudioId
	rundownId: RundownId
	segmentId: SegmentId
}

export interface DBNotificationTargetPart {
	type: DBNotificationTargetType.PART
	studioId: StudioId
	rundownId: RundownId
	// segmentId: SegmentId
	partId: PartId
}

export interface DBNotificationTargetPiece {
	type: DBNotificationTargetType.PIECE
	studioId: StudioId
	rundownId: RundownId
	// segmentId: SegmentId
	partId: PartId
	pieceId: PieceId
}

export interface DBNotificationTargetRundownPlaylist {
	type: DBNotificationTargetType.PLAYLIST
	studioId: StudioId
	playlistId: RundownPlaylistId
}

export interface DBNotificationTargetPartInstance {
	type: DBNotificationTargetType.PARTINSTANCE
	studioId: StudioId
	rundownId: RundownId
	partInstanceId: PartInstanceId
}

export interface DBNotificationTargetPieceInstance {
	type: DBNotificationTargetType.PIECEINSTANCE
	studioId: StudioId
	rundownId: RundownId
	partInstanceId: PartInstanceId
	pieceInstanceId: PieceInstanceId
}
