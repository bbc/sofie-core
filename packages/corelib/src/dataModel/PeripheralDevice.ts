import { Time, TSR } from '@sofie-automation/blueprints-integration'
import { DeviceConfigManifest } from '../deviceConfig'
import { PeripheralDeviceId, OrganizationId, StudioId } from './Ids'
import { IngestDeviceSettings, IngestDeviceSecretSettings } from './PeripheralDeviceSettings/ingestDevice'
import { PlayoutDeviceSettings } from './PeripheralDeviceSettings/playoutDevice'

export interface PeripheralDevice {
	_id: PeripheralDeviceId

	/** If set, this device is owned by that organization */
	organizationId: OrganizationId | null

	/** Name of the device (set by the device, modifiable by user) */
	name: string

	/** Name of the device (set by the device) */
	deviceName?: string

	category: PeripheralDeviceCategory
	type: PeripheralDeviceType
	subType: PeripheralDeviceSubType

	/** The studio this device is assigned to. Will be undefined for sub-devices */
	studioId?: StudioId
	parentDeviceId?: PeripheralDeviceId
	/** Versions reported from the device */
	versions?: {
		[libraryName: string]: string
	}
	/** Whether version checks should be disabled for this version */
	disableVersionChecks?: boolean

	created: Time
	status: PeripheralDeviceStatusObject
	lastSeen: Time // Updated continously while connected
	lastConnected: Time // Updated upon connection, not continously

	/** A list of last reported latencies */
	latencies?: number[]

	connected: boolean
	connectionId: string | null // Id of the current ddp-Connection

	token: string

	settings?: PlayoutDeviceSettings | IngestDeviceSettings | { [key: string]: any }

	secretSettings?: IngestDeviceSecretSettings | { [key: string]: any }

	/** Ignore this device when computing status in the GUI (other status reports are unaffected) */
	ignore?: boolean

	configManifest: DeviceConfigManifest

	/** If this is an ingest gateway, the last tiem data was received */
	lastDataReceived?: Time

	/** If an ingest device performing an oauth flow */
	accessTokenUrl?: string
}

export enum PeripheralDeviceStatusCode {
	UNKNOWN = 0, // Status unknown
	GOOD = 1, // All good and green
	WARNING_MINOR = 2, // Everything is not OK, operation is not affected
	WARNING_MAJOR = 3, // Everything is not OK, operation might be affected
	BAD = 4, // Operation affected, possible to recover
	FATAL = 5, // Operation affected, not possible to recover without manual interference
}

// Note The actual type of a device is determined by the Category, Type and SubType

export interface PeripheralDeviceStatusObject {
	statusCode: PeripheralDeviceStatusCode
	messages?: Array<string>
}
// Note The actual type of a device is determined by the Category, Type and SubType
export enum PeripheralDeviceCategory {
	INGEST = 'ingest',
	PLAYOUT = 'playout',
	MEDIA_MANAGER = 'media_manager',
	PACKAGE_MANAGER = 'package_manager',
}
export enum PeripheralDeviceType {
	// Ingest devices:
	MOS = 'mos',
	SPREADSHEET = 'spreadsheet',
	INEWS = 'inews',
	// Playout devices:
	PLAYOUT = 'playout',
	// Media-manager devices:
	MEDIA_MANAGER = 'media_manager',
	// Package_manager devices:
	PACKAGE_MANAGER = 'package_manager',
}
export type PeripheralDeviceSubType =
	| PERIPHERAL_SUBTYPE_PROCESS
	| TSR.DeviceType
	| MOS_DeviceType
	| Spreadsheet_DeviceType

/** SUBTYPE_PROCESS means that the device is NOT a sub-device, but a (parent) process. */
export type PERIPHERAL_SUBTYPE_PROCESS = '_process'
export const PERIPHERAL_SUBTYPE_PROCESS: PERIPHERAL_SUBTYPE_PROCESS = '_process'
export type MOS_DeviceType = 'mos_connection'
export type Spreadsheet_DeviceType = 'spreadsheet_connection'
