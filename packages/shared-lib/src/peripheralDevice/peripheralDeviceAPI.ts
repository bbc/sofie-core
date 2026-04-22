import { DeviceConfigManifest } from '../core/deviceConfigManifest.js'
import { PeripheralDeviceId, RundownPlaylistId, PartInstanceId, PieceInstanceId } from '../core/model/Ids.js'
import { StatusCode } from '../lib/status.js'

export interface PartPlaybackCallbackData {
	rundownPlaylistId: RundownPlaylistId
	partInstanceId: PartInstanceId
}
export interface PiecePlaybackCallbackData {
	rundownPlaylistId: RundownPlaylistId
	partInstanceId: PartInstanceId
	pieceInstanceId: PieceInstanceId
	dynamicallyInserted?: boolean
}

export type TimelineTriggerTimeResult = Array<{ id: string; time: number }>

export interface PartPlaybackStartedResult extends PartPlaybackCallbackData {
	time: number
}
export type PartPlaybackStoppedResult = PartPlaybackStartedResult
export interface PiecePlaybackStartedResult extends PiecePlaybackCallbackData {
	time: number
}
export type PiecePlaybackStoppedResult = PiecePlaybackStartedResult

export interface TriggerRegenerationCallbackData {
	rundownPlaylistId: RundownPlaylistId
	regenerationToken: string
}

export type PlayoutChangedResults = {
	rundownPlaylistId: RundownPlaylistId
	changes: PlayoutChangedResult[]
}
export enum PlayoutChangedType {
	PART_PLAYBACK_STARTED = 'partPlaybackStarted',
	PART_PLAYBACK_STOPPED = 'partPlaybackStopped',
	PIECE_PLAYBACK_STARTED = 'piecePlaybackStarted',
	PIECE_PLAYBACK_STOPPED = 'piecePlaybackStopped',
	TRIGGER_REGENERATION = 'triggerRegeneration',
}
export type PlayoutChangedResult = {
	objId: string
	type:
		| PlayoutChangedType.PART_PLAYBACK_STARTED
		| PlayoutChangedType.PART_PLAYBACK_STOPPED
		| PlayoutChangedType.PIECE_PLAYBACK_STARTED
		| PlayoutChangedType.PIECE_PLAYBACK_STOPPED
		| PlayoutChangedType.TRIGGER_REGENERATION
} & (
	| {
			type: PlayoutChangedType.PART_PLAYBACK_STARTED
			data: Omit<PartPlaybackStartedResult, 'rundownPlaylistId'>
	  }
	| {
			type: PlayoutChangedType.PART_PLAYBACK_STOPPED
			data: Omit<PartPlaybackStoppedResult, 'rundownPlaylistId'>
	  }
	| {
			type: PlayoutChangedType.PIECE_PLAYBACK_STARTED
			data: Omit<PiecePlaybackStartedResult, 'rundownPlaylistId'>
	  }
	| {
			type: PlayoutChangedType.PIECE_PLAYBACK_STOPPED
			data: Omit<PiecePlaybackStoppedResult, 'rundownPlaylistId'>
	  }
	| {
			type: PlayoutChangedType.TRIGGER_REGENERATION
			data: Omit<TriggerRegenerationCallbackData, 'rundownPlaylistId'>
	  }
)

// Note The actual type of a device is determined by the Category, Type and SubType

/**
 * A TSR device state event as reported over the wire from a gateway.
 *
 * This is intentionally loose: `deviceType` is a plain `string` rather than `TSR.DeviceType` because
 * TSR plugins can define custom device types that are not in the built-in enum, and because
 * shared-lib deliberately avoids a hard dependency on TSR types here.
 */
export interface PeripheralDeviceExternalTSREvent {
	type: 'tsr'
	/** The id of the playout device, e.g. `'atem0'` */
	deviceId: string
	/**
	 * The type of the playout device, e.g. `'ATEM'`.
	 * Typed as `string` rather than `TSR.DeviceType` to accommodate custom plugin device types.
	 */
	deviceType: string
	/** The event key, e.g. `'me.0.programInput'` */
	event: string
	/** The event payload. Opaque on the wire; cast to the appropriate type in the job-worker. */
	payload: unknown
}

/**
 * An external event received from a gateway over the DDP wire.
 *
 * This is a discriminated union so that additional event sources can be added in future
 * without breaking existing consumers.
 */
export type PeripheralDeviceExternalEvent = PeripheralDeviceExternalTSREvent

export interface PeripheralDeviceStatusObject {
	statusCode: StatusCode
	messages?: Array<string>
}
// Note The actual type of a device is determined by the Category, Type and SubType
export enum PeripheralDeviceCategory {
	INGEST = 'ingest',
	PLAYOUT = 'playout',
	PACKAGE_MANAGER = 'package_manager',
	LIVE_STATUS = 'live_status',
	TRIGGER_INPUT = 'trigger_input',
}
export enum PeripheralDeviceType {
	// Ingest devices:
	MOS = 'mos',
	SPREADSHEET = 'spreadsheet',
	INEWS = 'inews',
	// Playout devices:
	PLAYOUT = 'playout',
	// Package_manager devices:
	PACKAGE_MANAGER = 'package_manager',
	// API devices:
	LIVE_STATUS = 'live_status',
	// Trigger input and feedback devices:
	INPUT = 'input',
}
export type PeripheralDeviceSubType = PERIPHERAL_SUBTYPE_PROCESS | string | number // @future remove numbers from here once TSR no longer needs it

/** SUBTYPE_PROCESS means that the device is NOT a sub-device, but a (parent) process. */
export type PERIPHERAL_SUBTYPE_PROCESS = '_process'
export const PERIPHERAL_SUBTYPE_PROCESS: PERIPHERAL_SUBTYPE_PROCESS = '_process'

export interface PeripheralDeviceInitOptions {
	/**
	 * Category of the Device
	 */
	category: PeripheralDeviceCategory
	/**
	 * Type of the Device
	 */
	type: PeripheralDeviceType
	/**
	 * SubType of the connection
	 */
	subType: PeripheralDeviceSubType

	/**
	 * Name of the device
	 * eg 'MOS Gateway'
	 */
	name: string
	connectionId: string
	parentDeviceId?: PeripheralDeviceId
	versions?: {
		[libraryName: string]: string
	}
	configManifest?: DeviceConfigManifest

	documentationUrl: string
}

export interface TimeDiff {
	currentTime: number
	systemRawTime: number
	diff: number
	stdDev: number
	good: boolean
}
export interface DiffTimeResult {
	mean: number
	stdDev: number
}
