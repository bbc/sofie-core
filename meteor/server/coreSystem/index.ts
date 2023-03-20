import { SYSTEM_ID, parseVersion, GENESIS_SYSTEM_VERSION } from '../../lib/collections/CoreSystem'
import { getCurrentTime, MeteorStartupAsync } from '../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { prepareMigration, runMigration } from '../migration/databaseMigration'
import { CURRENT_SYSTEM_VERSION } from '../migration/currentSystemVersion'
import { Blueprints, CoreSystem } from '../collections'
import { getEnvLogLevel, logger, LogLevel, setLogLevel } from '../logging'
const PackageInfo = require('../../package.json')
import Agent from 'meteor/julusian:meteor-elastic-apm'
import { profiler } from '../api/profiler'
import { TMP_TSR_VERSION } from '@sofie-automation/blueprints-integration'
import { getAbsolutePath } from '../lib'
import * as fs from 'fs/promises'
import path from 'path'
import { checkDatabaseVersions } from './checkDatabaseVersions'
import PLazy from 'p-lazy'
import { getCoreSystem, getCoreSystemAsync, getCoreSystemCursor } from './collection'

export { PackageInfo }

/** Get the store path used to be used for storing snapshots  */
export function getSystemStorePath(): string {
	if (isRunningInJest()) {
		// Override the variable when invoked through Jest
		return '/dev/null'
	}

	const storePath = process.env.SOFIE_STORE_PATH
	if (storePath) return path.resolve(storePath)

	if (Meteor.isDevelopment) {
		// For development, fallback to inside the .meteor folder
		return getAbsolutePath() + '/.meteor/local/sofie-store'
	}

	throw new Meteor.Error(500, 'SOFIE_STORE_PATH must be defined to launch Sofie')
}

export function isRunningInJest(): boolean {
	return !!process.env.JEST_WORKER_ID
}

async function initializeCoreSystem() {
	const system = await getCoreSystemAsync()
	if (!system) {
		// At this point, we probably have a system that is as fresh as it gets

		const version = parseVersion(GENESIS_SYSTEM_VERSION)
		await CoreSystem.insertAsync({
			_id: SYSTEM_ID,
			created: getCurrentTime(),
			modified: getCurrentTime(),
			version: version,
			previousVersion: null,
			serviceMessages: {},
			apm: {
				enabled: false,
				transactionSampleRate: -1,
			},
			cron: {
				casparCGRestart: {
					enabled: true,
				},
			},
		})

		if (!isRunningInJest()) {
			// Check what migration has to provide:
			const migration = prepareMigration(true)
			if (migration.migrationNeeded && migration.manualStepCount === 0 && migration.chunks.length <= 1) {
				// Since we've determined that the migration can be done automatically, and we have a fresh system, just do the migration automatically:
				runMigration(migration.chunks, migration.hash, [])
			}
		}
	}

	// Monitor database changes:
	const systemCursor = getCoreSystemCursor()
	systemCursor.observeChanges({
		added: onCoreSystemChanged,
		changed: onCoreSystemChanged,
		removed: onCoreSystemChanged,
	})

	const observeBlueprintChanges = () => {
		checkDatabaseVersions()
	}

	Blueprints.observeChanges(
		{},
		{
			added: observeBlueprintChanges,
			changed: observeBlueprintChanges,
			removed: observeBlueprintChanges,
		},
		{ fields: { code: 0 } }
	)

	checkDatabaseVersions()
}

function onCoreSystemChanged() {
	checkDatabaseVersions()
	updateLoggerLevel(false)
}

export const RelevantSystemVersions = PLazy.from(async () => {
	const versions: { [name: string]: string } = {}

	const dependencies: any = PackageInfo.dependencies
	if (dependencies) {
		const libNames: string[] = ['@mos-connection/helper', 'superfly-timeline']

		const getRealVersion = async (name: string, fallback: string): Promise<string> => {
			try {
				const pkgInfo = require(name + '/package.json')
				return pkgInfo.version
			} catch (e) {
				logger.warn(`Failed to read version of package "${name}": ${e}`)
				return parseVersion(fallback)
			}
		}

		await Promise.all([
			...libNames.map(async (name) => {
				versions[name] = await getRealVersion(name, dependencies[name])
			}),
		])
		versions['core'] = PackageInfo.versionExtended || PackageInfo.version // package version
		versions['timeline-state-resolver-types'] = TMP_TSR_VERSION
	} else {
		logger.error(`Core package dependencies missing`)
	}

	return versions
})

async function startupMessage() {
	if (!Meteor.isTest) {
		console.log('process started') // This is a message all Sofie processes log upon startup

		logger.info(`Core starting up`)
		logger.info(`Core system version: "${CURRENT_SYSTEM_VERSION}"`)

		// @ts-expect-error Its not always defined
		if (global.gc) {
			logger.info(`Manual garbage-collection is enabled`)
		} else {
			logger.warn(
				`Enable garbage-collection by passing --expose_gc to node in prod or set SERVER_NODE_OPTIONS=--expose_gc in dev`
			)
		}

		const versions = await RelevantSystemVersions
		for (const [name, version] of Object.entries<string>(versions)) {
			logger.info(`Core package ${name} version: "${version}"`)
		}
	}
}

async function startInstrumenting() {
	if (Meteor.isTest) {
		return
	}

	// attempt init elastic APM
	const system = await getCoreSystemAsync()
	const { APM_HOST, APM_SECRET, KIBANA_INDEX, APP_HOST } = process.env

	if (APM_HOST && system && system.apm) {
		logger.info(`APM agent starting up`)
		Agent.start({
			serviceName: KIBANA_INDEX || 'tv-automation-server-core',
			hostname: APP_HOST,
			serverUrl: APM_HOST,
			secretToken: APM_SECRET,
			active: system.apm.enabled,
			transactionSampleRate: system.apm.transactionSampleRate,
			disableMeteorInstrumentations: ['methods', 'http-out', 'session', 'async', 'metrics'],
		})
		profiler.setActive(system.apm.enabled || false)
	} else {
		logger.info(`APM agent inactive`)
		Agent.start({
			serviceName: 'tv-automation-server-core',
			active: false,
			disableMeteorInstrumentations: ['methods', 'http-out', 'session', 'async', 'metrics'],
		})
	}
}
function updateLoggerLevel(startup: boolean) {
	if (Meteor.isTest) return // ignore this when running in tests
	const coreSystem = getCoreSystem()

	if (coreSystem) {
		setLogLevel(coreSystem.logLevel ?? getEnvLogLevel() ?? LogLevel.SILLY, startup)
	} else {
		logger.error('updateLoggerLevel: CoreSystem not found')
	}
}

MeteorStartupAsync(async () => {
	if (Meteor.isServer) {
		await startupMessage()
		updateLoggerLevel(true)
		await initializeCoreSystem()
		await startInstrumenting()

		if (!isRunningInJest()) {
			// Ensure the storepath exists
			const storePath = getSystemStorePath()
			logger.info(`Using storePath: ${storePath}`)
			await fs.mkdir(storePath, { recursive: true })
		}
	}
})
