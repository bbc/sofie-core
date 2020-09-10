import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'
import { Studios } from '../../lib/collections/Studios'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Pieces } from '../../lib/collections/Pieces'
import { Part, Parts } from '../../lib/collections/Parts'
import { Piece as Piece_1_11_0 } from './deprecatedDataTypes/1_11_0'
import { unprotectString, ProtectedString, objectPathSet } from '../../lib/lib'
import { TransformedCollection } from '../../lib/typings/meteor'
import { IBlueprintConfig } from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Timeline, TimelineObjGeneric } from '../../lib/collections/Timeline'
import { ensureCollectionProperty } from './lib'
import { getCoreSystem } from '../../lib/collections/CoreSystem'
import * as semver from 'semver'
import { getDeprecatedDatabases, dropDeprecatedDatabases } from './deprecatedDatabases/X_X_X'
import * as _ from 'underscore'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */
// Release X
addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	//                     ^--- To be set to an absolute version number when doing the release
	// add steps here:
	// {
	// 	id: 'my fancy step',
	// 	canBeRunAutomatically: true,
	// 	validate: () => {
	// 		return false
	// 	},
	// 	migrate: () => {
	// 		//
	// 	}
	// },
	{
		id: 'Add new routeSets property to studio where missing',
		canBeRunAutomatically: true,
		validate: () => {
			return (
				Studios.find({
					routeSets: { $exists: false },
				}).count() > 0
			)
		},
		migrate: () => {
			Studios.find({
				routeSets: { $exists: false },
			}).forEach((studio) => {
				Studios.update(studio._id, { $set: { routeSets: {} } })
			})
		},
	},
	{
		id: 'Studios: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (
				Studios.findOne({
					organizationId: { $exists: false },
				})
			)
				return 'Studio without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			Studios.update(
				{
					organizationId: { $exists: false },
				},
				{
					$set: {
						organizationId: null,
					},
				},
				{ multi: true }
			)
		},
	},
	{
		id: 'PeripheralDevices: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (
				PeripheralDevices.findOne({
					organizationId: { $exists: false },
				})
			)
				return 'PeripheralDevice without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			PeripheralDevices.update(
				{
					organizationId: { $exists: false },
				},
				{
					$set: {
						organizationId: null,
					},
				},
				{ multi: true }
			)
		},
	},
	{
		id: 'ShowStyleBases: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (
				ShowStyleBases.findOne({
					organizationId: { $exists: false },
				})
			)
				return 'ShowStyleBase without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			ShowStyleBases.update(
				{
					organizationId: { $exists: false },
				},
				{
					$set: {
						organizationId: null,
					},
				},
				{ multi: true }
			)
		},
	},

	{
		id: 'Remove runtimeArguments from ShowStyleBase',
		canBeRunAutomatically: true,
		validate: () => {
			const studio = ShowStyleBases.find().fetch()
			let result: string | boolean = false
			studio.forEach((siItem) => {
				if ((siItem as any).runtimeArguments) {
					result = `Rundown Arguments set in a Studio Installation "${siItem._id}"`
				}
			})
			return result
		},
		migrate: () => {
			ShowStyleBases.update(
				{},
				{
					$unset: {
						runtimeArguments: 1,
					},
				},
				{ multi: true }
			)
		},
	},
	{
		id: 'Pieces properties',
		canBeRunAutomatically: true,
		validate: () => {
			const pieceCount = Pieces.find({
				rundownId: { $exists: true },
				partId: { $exists: true },
			}).count()
			let result: string | boolean = false
			if (pieceCount > 0) result = `${pieceCount} pieces need to be migrated`

			return result
		},
		migrate: () => {
			const parts: { [partId: string]: Part } = {}
			Pieces.find({
				rundownId: { $exists: true },
				partId: { $exists: true },
			}).forEach((piece0) => {
				const piece = (piece0 as any) as Piece_1_11_0

				let part: Part | undefined = parts[unprotectString(piece.partId)]
				if (!part) {
					part = Parts.findOne(piece.partId)
					if (part) {
						parts[unprotectString(piece.partId)] = part
					}
				}
				if (part) {
					Pieces.update(piece._id, {
						$set: {
							startRundownId: piece.rundownId,
							startPartId: piece.partId,
							startSegmentId: part.segmentId,
						},
						$unset: {
							rundownId: 1,
							partId: 1,
						},
					})
				} else {
					// If the Piece has no part, it's an orphan and should be removed
					Pieces.remove(piece._id)
				}
			})
		},
	},
	migrateConfigToBlueprintConfig('Migrate config to blueprintConfig in Studios', Studios),
	migrateConfigToBlueprintConfig('Migrate config to blueprintConfig in ShowStyleBases', ShowStyleBases),
	migrateConfigToBlueprintConfig('Migrate config to blueprintConfig in ShowStyleVariants', ShowStyleVariants),
	{
		id: 'Single timeline object',
		canBeRunAutomatically: true,
		validate: () => {
			const badCount = Timeline.find({
				timeline: { $exists: false },
			}).count()
			if (badCount > 0) {
				return `${badCount} timeline objects need to be deleted`
			}
			return false
		},
		migrate: () => {
			Timeline.remove({
				timeline: { $exists: false },
			})
		},
	},
	//
	//
	// setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.0.0'),

	{
		id: 'Drop Studio Recording config',
		canBeRunAutomatically: true,
		validate: () => {
			const badCount = Studios.find({
				'testToolsConfig.recording': { $exists: true },
			}).count()
			if (badCount > 0) {
				return `${badCount} studio need to be updated`
			}
			return false
		},
		migrate: () => {
			Timeline.update(
				{
					'testToolsConfig.recording': { $exists: true },
				},
				{
					$unset: {
						'testToolsConfig.recording': 1,
					},
				}
			)
		},
	},
	{
		id: 'Drop removed collections',
		canBeRunAutomatically: true,
		validate: () => {
			let databaseSystem = getCoreSystem()

			// Only run this if version is under 0.25.0, in order to not create the deprecated databases
			if (databaseSystem && semver.satisfies(databaseSystem.version, '<1.12.0')) {
				// =======================================================   ^^^^^ TODO: change this, to Release 25 version
				const dbs = getDeprecatedDatabases()

				if (dbs) {
					let foundAnything: string | null = null
					_.find(_.keys(dbs), (collectionName) => {
						const collection = dbs[collectionName]
						if (collection.findOne()) {
							foundAnything = collectionName
							return true
						}
					})
					if (foundAnything) return `Deprecated collection "${foundAnything}" is not empty`
				}
			}
			return false
		},
		migrate: () => {
			const dbs = getDeprecatedDatabases()

			if (dbs) {
				dropDeprecatedDatabases()
			}
		},
	},
])

function migrateConfigToBlueprintConfig<
	T extends DBInterface,
	DBInterface extends { _id: ProtectedString<any>; blueprintConfig: IBlueprintConfig }
>(id: string, collection: TransformedCollection<T, DBInterface>) {
	return {
		id,
		canBeRunAutomatically: true,
		validate: () => {
			const documents = collection.find({ config: { $exists: true } }).fetch()
			if (documents.length) {
				return true
			}
			return false
		},
		migrate: () => {
			const documents = collection.find({ config: { $exists: true } }).fetch() as Array<
				T & { config: Array<{ _id: string; value: any }> }
			>
			for (const document of documents) {
				document.blueprintConfig = {}
				for (const item of document.config) {
					objectPathSet(document.blueprintConfig, item._id, item.value)
				}
				delete document.config
				collection.update(document._id, document)
			}
		},
	}
}
