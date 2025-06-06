import { LogLevel, protectString } from '../lib'
import { Meteor } from 'meteor/meteor'
import * as semver from 'semver'
import _ from 'underscore'
import { CoreSystemId, BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { StatusCode } from '@sofie-automation/blueprints-integration'

export const SYSTEM_ID: CoreSystemId = protectString('core')

/**
 * Criticality level for service messages. Specification of criticality in server
 * messages from sofie-monitor:
 * https://github.com/nrkno/sofie-monitor/blob/main/src/data/serviceMessages/ServiceMessage.ts
 *
 * @export
 * @enum {number}
 */
export enum Criticality {
	/** Subject matter will affect operations. */
	CRITICAL = 1,
	/** Operations will not be affected, but non-critical functions may be affected or the result may be undesirable. */
	WARNING = 2,
	/** General information */
	NOTIFICATION = 3,
}

export interface ServiceMessage {
	id: string
	criticality: Criticality
	message: string
	sender?: string
	timestamp: number
}

export interface ExternalServiceMessage extends Omit<ServiceMessage, 'timestamp'> {
	timestamp: Date
}

export enum SofieLogo {
	Default = 'default',
	Pride = 'pride',
	Norway = 'norway',
	Christmas = 'christmas',
}

export interface ICoreSystem {
	_id: CoreSystemId // always is 'core'
	/** Timestamp of creation, (ie the time the database was created) */
	created: number
	/** Last modified time */
	modified: number
	/** Database version, on the form x.y.z */
	version: string
	/** Previous version, on the form x.y.z */
	previousVersion: string | null

	/** Id of the blueprint used by this system */
	blueprintId?: BlueprintId

	/** Support info */
	support?: {
		message: string
	}

	systemInfo?: {
		message: string
		enabled: boolean
	}

	evaluations?: {
		enabled: boolean
		heading: string
		message: string
	}

	/** A user-defined name for the installation */
	name?: string

	/** What log-level to set. Defaults to SILLY */
	logLevel?: LogLevel

	/** Service messages currently valid for this instance */
	serviceMessages: {
		[index: string]: ServiceMessage
	}

	/** elastic APM (application performance monitoring) settings */
	apm?: {
		enabled?: boolean
		/**
		 * How many of the transactions to monitor.
		 * Set to:
		 * -1 to log nothing (max performance),
		 * 0.5 to log 50% of the transactions,
		 * 1 to log all transactions
		 */
		transactionSampleRate?: number
	}
	enableMonitorBlockedThread?: boolean

	/** Cron jobs running nightly */
	cron?: {
		casparCGRestart?: {
			enabled: boolean
		}
		storeRundownSnapshots?: {
			enabled: boolean
			rundownNames?: string[]
		}
	}

	logo?: SofieLogo
}

/** In the beginning, there was the database, and the database was with Sofie, and the database was Sofie.
 * And Sofie said: The version of the database is to be GENESIS_SYSTEM_VERSION so that the migration scripts will run.
 */
export const GENESIS_SYSTEM_VERSION = '0.0.0'

export type Version = string
export type VersionRange = string

function isReferenceOrUndefined(v: string | undefined): boolean {
	return !v || v.startsWith('http') || v.startsWith('git') || v.startsWith('file')
}

export function stripVersion(v: string): string {
	if (isReferenceOrUndefined(v)) {
		return '0.0.0'
	} else {
		const valid = semver.parse(v)
		if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)

		return `${valid.major}.${valid.minor}.${valid.patch}`
	}
}
export function parseRange(r: string | VersionRange | undefined): VersionRange {
	if (isReferenceOrUndefined(r)) {
		return '^0.0.0' // anything goes..
	}
	const range = semver.validRange(r)
	if (!range) throw new Meteor.Error(500, `Invalid range: "${r}"`)
	return range
}
export function parseVersion(v: string | Version | undefined): Version {
	if (isReferenceOrUndefined(v)) {
		return '0.0.0' // fallback
	}
	const valid = semver.valid(v)
	if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)
	return valid
}

export function isPrerelease(v: string): boolean {
	if (isReferenceOrUndefined(v)) {
		return true
	} else {
		const valid = semver.parse(v)
		if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)

		return valid.prerelease.length > 0
	}
}
export function parseCoreIntegrationCompatabilityRange(v: string): string {
	if (isReferenceOrUndefined(v)) {
		return '0.0'
	} else {
		const valid = semver.parse(v)
		if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)

		// patch releases shouldn't break things, so we always want to accept an older patch
		valid.patch = 0

		return `~${valid.format()}`
	}
}
/**
 * Compares two versions and returns a system Status
 * @param currentVersion
 * @param targetRange
 */
export function compareSemverVersions(
	currentVersion: Version | null,
	targetRange: VersionRange,
	allowPrerelease: boolean,
	fixMessage: string,
	meName: string,
	theyName: string
): { statusCode: StatusCode; messages: string[] } {
	if (currentVersion) currentVersion = semver.clean(currentVersion)

	if (currentVersion) {
		if (
			semver.satisfies(currentVersion, targetRange, {
				includePrerelease: allowPrerelease,
			})
		) {
			return {
				statusCode: StatusCode.GOOD,
				messages: [`${meName} version: ${currentVersion}`],
			}
		} else {
			try {
				const currentV = new semver.SemVer(currentVersion, { includePrerelease: true })
				const expectV = new semver.SemVer(stripVersion(targetRange), { includePrerelease: true })

				const message =
					`Version mismatch: ${meName} version: "${currentVersion}" does not satisfy expected version of ${theyName}: "${targetRange}"` +
					(fixMessage ? ` (${fixMessage})` : '')

				if (!expectV || !currentV) {
					return {
						statusCode: StatusCode.BAD,
						messages: [message],
					}
				} else if (expectV.major !== currentV.major) {
					return {
						statusCode: StatusCode.BAD,
						messages: [message],
					}
				} else if (expectV.minor !== currentV.minor) {
					return {
						statusCode: StatusCode.WARNING_MAJOR,
						messages: [message],
					}
				} else if (expectV.patch !== currentV.patch) {
					return {
						statusCode: StatusCode.WARNING_MINOR,
						messages: [message],
					}
				} else if (!_.isEqual(expectV.prerelease, currentV.prerelease)) {
					return {
						statusCode: StatusCode.WARNING_MINOR,
						messages: [message],
					}
				} else {
					return {
						statusCode: StatusCode.BAD,
						messages: [message],
					}
				}
				// the expectedVersion may be a proper range, in which case the new semver.SemVer will throw an error, even though the semver.satisfies check would work.
			} catch (e) {
				const message =
					`Version mismatch: ${meName} version: "${currentVersion}" does not satisfy expected version range of ${theyName}: "${targetRange}"` +
					(fixMessage ? ` (${fixMessage})` : '')

				return {
					statusCode: StatusCode.BAD,
					messages: [message],
				}
			}
		}
	} else {
		return {
			statusCode: StatusCode.FATAL,
			messages: [`Current ${meName} version missing (when comparing with ${theyName})`],
		}
	}
}
