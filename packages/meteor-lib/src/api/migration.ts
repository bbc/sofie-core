import type { MigrationStepInput, MigrationStepInputResult } from '@sofie-automation/blueprints-integration'
import type {
	BlueprintId,
	ShowStyleBaseId,
	SnapshotId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids.js'
import type { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage.js'
import type { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio.js'

export interface BlueprintFixUpConfigMessage {
	message: ITranslatableMessage
	path: string
}

export interface NewMigrationAPI {
	getMigrationStatus(): Promise<GetMigrationStatusResult>
	runMigration(
		chunks: Array<MigrationChunk>,
		hash: string,
		inputResults: Array<MigrationStepInputResult>,
		isFirstOfPartialMigrations?: boolean
	): Promise<RunMigrationResult>
	forceMigration(chunks: Array<MigrationChunk>): Promise<void>
	resetDatabaseVersions(): Promise<void>

	/**
	 * Run `fixupConfig` on the blueprint for a Studio
	 * @param studioId Id of the Studio
	 */
	fixupConfigForStudio(studioId: StudioId): Promise<BlueprintFixUpConfigMessage[]>

	/**
	 * Ignore that `fixupConfig` needs to be run for a Studio
	 * @param studioId Id of the Studio
	 */
	ignoreFixupConfigForStudio(studioId: StudioId): Promise<void>

	/**
	 * Run `validateConfig` on the blueprint for a Studio
	 * @param studioId Id of the Studio
	 * @returns List of messages to display to the user
	 */
	validateConfigForStudio(studioId: StudioId): Promise<BlueprintValidateConfigForStudioResult>

	/**
	 * Run `applyConfig` on the blueprint for a Studio, and store the results into the db
	 * @param studioId Id of the Studio
	 */
	runUpgradeForStudio(studioId: StudioId): Promise<void>

	/**
	 * Run `fixupConfig` on the blueprint for a ShowStyleBase
	 * @param showStyleBaseId Id of the ShowStyleBase
	 */
	fixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<BlueprintFixUpConfigMessage[]>

	/**
	 * Ignore that `fixupConfig` needs to be run for a ShowStyleBase
	 * @param showStyleBaseId Id of the ShowStyleBase
	 */
	ignoreFixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>

	/**
	 * Run `validateConfig` on the blueprint for a ShowStyleBase
	 * @param showStyleBaseId Id of the ShowStyleBase
	 * @returns List of messages to display to the user
	 */
	validateConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<BlueprintValidateConfigForStudioResult>

	/**
	 * Run `applyConfig` on the blueprint for a Studio, and store the results into the db
	 * @param studioId Id of the Studio
	 */
	runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
}

export enum MigrationAPIMethods {
	'getMigrationStatus' = 'migration.getMigrationStatus',
	'runMigration' = 'migration.runMigration',
	'forceMigration' = 'migration.forceMigration',
	'resetDatabaseVersions' = 'migration.resetDatabaseVersions',

	'getUpgradeStatus' = 'migration.getUpgradeStatus',
	'fixupConfigForStudio' = 'migration.fixupConfigForStudio',
	'ignoreFixupConfigForStudio' = 'migration.ignoreFixupConfigForStudio',
	'validateConfigForStudio' = 'migration.validateConfigForStudio',
	'runUpgradeForStudio' = 'migration.runUpgradeForStudio',
	'fixupConfigForShowStyleBase' = 'migration.fixupConfigForShowStyleBase',
	'ignoreFixupConfigForShowStyleBase' = 'migration.ignoreFixupConfigForShowStyleBase',
	'validateConfigForShowStyleBase' = 'migration.validateConfigForShowStyleBase',
	'runUpgradeForShowStyleBase' = 'migration.runUpgradeForShowStyleBase',
}

export interface GetMigrationStatusResult {
	migrationNeeded: boolean

	migration: {
		canDoAutomaticMigration: boolean
		manualInputs: Array<MigrationStepInput>
		hash: string
		automaticStepCount: number
		manualStepCount: number
		ignoredStepCount: number
		partialMigration: boolean
		chunks: Array<MigrationChunk>
	}
}
export interface RunMigrationResult {
	migrationCompleted: boolean
	partialMigration: boolean
	warnings: Array<string>
	snapshot: SnapshotId
}
export enum MigrationStepType {
	CORE = 'core',
	SYSTEM = 'system',
	STUDIO = 'studio',
	SHOWSTYLE = 'showstyle',
}
export interface MigrationChunk {
	sourceType: MigrationStepType
	sourceName: string
	blueprintId?: BlueprintId // blueprint id
	sourceId?: ShowStyleBaseId | StudioId | 'system' // id in blueprint databaseVersions
	_dbVersion: string // database version
	_targetVersion: string // target version
	_steps: Array<string> // ref to step that use it
}
