import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { ExpectedPackages } from '../collections'
import * as PackagesPreR53 from '@sofie-automation/corelib/dist/dataModel/Old/ExpectedPackagesR52'
import {
	ExpectedPackageDB,
	ExpectedPackageIngestSource,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { assertNever, Complete } from '../lib/tempLib'
import { BucketId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add your migration here

	{
		id: `convert ExpectedPackages to new format`,
		canBeRunAutomatically: true,
		validate: async () => {
			const packages = await ExpectedPackages.findFetchAsync({
				fromPieceType: { $exists: true },
			})

			if (packages.length > 0) {
				return 'ExpectedPackages must be converted to new format'
			}

			return false
		},
		migrate: async () => {
			const packages = (await ExpectedPackages.findFetchAsync({
				fromPieceType: { $exists: true },
			})) as unknown as PackagesPreR53.ExpectedPackageDB[]

			for (const pkg of packages) {
				let rundownId: RundownId | null = null
				let bucketId: BucketId | null = null
				let ingestSource: ExpectedPackageIngestSource | undefined

				switch (pkg.fromPieceType) {
					case PackagesPreR53.ExpectedPackageDBType.PIECE:
					case PackagesPreR53.ExpectedPackageDBType.ADLIB_PIECE:
						rundownId = pkg.rundownId
						ingestSource = {
							fromPieceType: pkg.fromPieceType,
							pieceId: pkg.pieceId,
							partId: pkg.partId,
							segmentId: pkg.segmentId,
							blueprintPackageId: pkg.blueprintPackageId,
							listenToPackageInfoUpdates: pkg.listenToPackageInfoUpdates,
						}
						break
					case PackagesPreR53.ExpectedPackageDBType.ADLIB_ACTION:
						rundownId = pkg.rundownId
						ingestSource = {
							fromPieceType: pkg.fromPieceType,
							pieceId: pkg.pieceId,
							partId: pkg.partId,
							segmentId: pkg.segmentId,
							blueprintPackageId: pkg.blueprintPackageId,
							listenToPackageInfoUpdates: pkg.listenToPackageInfoUpdates,
						}
						break
					case PackagesPreR53.ExpectedPackageDBType.BASELINE_ADLIB_PIECE:
						rundownId = pkg.rundownId
						ingestSource = {
							fromPieceType: pkg.fromPieceType,
							pieceId: pkg.pieceId,
							blueprintPackageId: pkg.blueprintPackageId,
							listenToPackageInfoUpdates: pkg.listenToPackageInfoUpdates,
						}
						break
					case PackagesPreR53.ExpectedPackageDBType.BASELINE_ADLIB_ACTION:
						rundownId = pkg.rundownId
						ingestSource = {
							fromPieceType: pkg.fromPieceType,
							pieceId: pkg.pieceId,
							blueprintPackageId: pkg.blueprintPackageId,
							listenToPackageInfoUpdates: pkg.listenToPackageInfoUpdates,
						}
						break
					case PackagesPreR53.ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS:
						rundownId = pkg.rundownId
						ingestSource = {
							fromPieceType: pkg.fromPieceType,
							blueprintPackageId: pkg.blueprintPackageId,
							listenToPackageInfoUpdates: pkg.listenToPackageInfoUpdates,
						}
						break
					case PackagesPreR53.ExpectedPackageDBType.BUCKET_ADLIB:
						bucketId = pkg.bucketId
						ingestSource = {
							fromPieceType: pkg.fromPieceType,
							pieceId: pkg.pieceId,
							pieceExternalId: pkg.pieceExternalId,
							blueprintPackageId: pkg.blueprintPackageId,
							listenToPackageInfoUpdates: pkg.listenToPackageInfoUpdates,
						}
						break
					case PackagesPreR53.ExpectedPackageDBType.BUCKET_ADLIB_ACTION:
						bucketId = pkg.bucketId
						ingestSource = {
							fromPieceType: pkg.fromPieceType,
							pieceId: pkg.pieceId,
							pieceExternalId: pkg.pieceExternalId,
							blueprintPackageId: pkg.blueprintPackageId,
							listenToPackageInfoUpdates: pkg.listenToPackageInfoUpdates,
						}
						break
					case PackagesPreR53.ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS:
						ingestSource = {
							fromPieceType: pkg.fromPieceType,
							blueprintPackageId: pkg.blueprintPackageId,
							listenToPackageInfoUpdates: pkg.listenToPackageInfoUpdates,
						}
						break
					default:
						assertNever(pkg)
						break
				}

				await ExpectedPackages.mutableCollection.removeAsync(pkg._id)

				if (ingestSource) {
					await ExpectedPackages.mutableCollection.insertAsync({
						_id: pkg._id, // Preserve the old id to ensure references aren't broken. This will be 'corrected' upon first ingest operation
						studioId: pkg.studioId,
						rundownId: rundownId,
						bucketId: bucketId,
						package: {
							...(pkg as any), // Some fields should be pruned off this, but this is fine
							_id: pkg.blueprintPackageId,
						},
						created: pkg.created,
						ingestSources: [ingestSource],
					} satisfies Complete<ExpectedPackageDB>)
				}
			}
		},
	},
])
