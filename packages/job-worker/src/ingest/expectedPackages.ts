import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import {
	ExpectedPackageDBType,
	getContentVersionHash,
	ExpectedPackageDBNew,
	getExpectedPackageIdFromIngestSource,
	ExpectedPackageIngestSource,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { AdLibActionId, PieceId, BucketId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { saveIntoDb } from '../db/changes'
import { PlayoutModel } from '../playout/model/PlayoutModel'
import { StudioPlayoutModel } from '../studio/model/StudioPlayoutModel'
import { ReadonlyDeep } from 'type-fest'
import { ExpectedPackage, BlueprintResultBaseline } from '@sofie-automation/blueprints-integration'
import { updateExpectedMediaItemsForPartModel, updateExpectedMediaItemsForRundownBaseline } from './expectedMediaItems'
import {
	updateBaselineExpectedPlayoutItemsOnStudio,
	updateExpectedPlayoutItemsForPartModel,
	updateExpectedPlayoutItemsForRundownBaseline,
} from './expectedPlayoutItems'
import { JobContext, JobStudio } from '../jobs'
import { IngestModel } from './model/IngestModel'
import { IngestPartModel } from './model/IngestPartModel'
import { clone } from '@sofie-automation/corelib/dist/lib'

export function updateExpectedMediaAndPlayoutItemsForPartModel(context: JobContext, part: IngestPartModel): void {
	updateExpectedMediaItemsForPartModel(context, part)
	updateExpectedPlayoutItemsForPartModel(context, part)
}

export async function updateExpectedMediaAndPlayoutItemsForRundownBaseline(
	context: JobContext,
	ingestModel: IngestModel,
	baseline: BlueprintResultBaseline | undefined
): Promise<void> {
	await updateExpectedMediaItemsForRundownBaseline(context, ingestModel)
	await updateExpectedPlayoutItemsForRundownBaseline(context, ingestModel, baseline)
}

function generateExpectedPackagesForBucketAdlib(studio: ReadonlyDeep<JobStudio>, adlib: BucketAdLib) {
	const packages: ExpectedPackageDBNew[] = []

	if (adlib.expectedPackages) {
		packages.push(
			...generateBucketExpectedPackages(
				studio,
				adlib.bucketId,
				{
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
					pieceId: adlib._id,
					pieceExternalId: adlib.externalId,
				},
				adlib.expectedPackages
			)
		)
	}

	return packages
}
function generateExpectedPackagesForBucketAdlibAction(studio: ReadonlyDeep<JobStudio>, action: BucketAdLibAction) {
	const packages: ExpectedPackageDBNew[] = []

	if (action.expectedPackages) {
		packages.push(
			...generateBucketExpectedPackages(
				studio,
				action.bucketId,
				{
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
					pieceId: action._id,
					pieceExternalId: action.externalId,
				},
				action.expectedPackages
			)
		)
	}

	return packages
}
function generateBucketExpectedPackages(
	studio: ReadonlyDeep<JobStudio>,
	bucketId: BucketId,
	source: ExpectedPackageIngestSource,
	expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>
): ExpectedPackageDBNew[] {
	const bases: ExpectedPackageDBNew[] = []

	for (let i = 0; i < expectedPackages.length; i++) {
		const expectedPackage = expectedPackages[i]
		const id = expectedPackage._id || '__unnamed' + i

		bases.push({
			_id: getExpectedPackageIdFromIngestSource(bucketId, source, id),
			package: {
				...clone<ExpectedPackage.Any>(expectedPackage),
				_id: id,
			},
			contentVersionHash: getContentVersionHash(expectedPackage),
			studioId: studio._id,
			rundownId: null,
			bucketId: bucketId,
			created: Date.now(), // This will be preserved during the `saveIntoDb`
			ingestSources: [source],
		})
	}

	return bases
}

export async function updateExpectedPackagesForBucketAdLibPiece(
	context: JobContext,
	adlib: BucketAdLib
): Promise<void> {
	const packages = generateExpectedPackagesForBucketAdlib(context.studio, adlib)

	await saveIntoDb(
		context,
		context.directCollections.ExpectedPackages,
		{
			studioId: context.studioId,
			bucketId: adlib.bucketId,
			// Note: This assumes that there is only one ingest source for each piece
			ingestSources: {
				$elemMatch: {
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
					pieceId: adlib._id,
				},
			},
		},
		packages,
		{
			beforeDiff: (obj, oldObj) => {
				return {
					...obj,
					// Preserve old created timestamp
					created: oldObj.created,
				}
			},
		}
	)
}

export async function updateExpectedPackagesForBucketAdLibAction(
	context: JobContext,
	action: BucketAdLibAction
): Promise<void> {
	const packages = generateExpectedPackagesForBucketAdlibAction(context.studio, action)

	await saveIntoDb(
		context,
		context.directCollections.ExpectedPackages,
		{
			studioId: context.studioId,
			bucketId: action.bucketId,
			// Note: This assumes that there is only one ingest source for each piece
			ingestSources: {
				$elemMatch: {
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
					pieceId: action._id,
				},
			},
		},
		packages,
		{
			beforeDiff: (obj, oldObj) => {
				return {
					...obj,
					// Preserve old created timestamp
					created: oldObj.created,
				}
			},
		}
	)
}

export async function cleanUpExpectedPackagesForBucketAdLibs(context: JobContext, adLibIds: PieceId[]): Promise<void> {
	if (adLibIds.length > 0) {
		await context.directCollections.ExpectedPackages.remove({
			studioId: context.studioId,
			// Note: This assumes that there is only one ingest source for each piece
			ingestSources: {
				$elemMatch: {
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
					pieceId: { $in: adLibIds },
				},
			},
		})
	}
}
export async function cleanUpExpectedPackagesForBucketAdLibsActions(
	context: JobContext,
	adLibIds: AdLibActionId[]
): Promise<void> {
	if (adLibIds.length > 0) {
		await context.directCollections.ExpectedPackages.remove({
			studioId: context.studioId,
			// Note: This assumes that there is only one ingest source for each piece
			ingestSources: {
				$elemMatch: {
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
					pieceId: { $in: adLibIds },
				},
			},
		})
	}
}

export function updateBaselineExpectedPackagesOnStudio(
	context: JobContext,
	playoutModel: StudioPlayoutModel | PlayoutModel,
	baseline: BlueprintResultBaseline
): void {
	updateBaselineExpectedPlayoutItemsOnStudio(context, playoutModel, baseline.expectedPlayoutItems ?? [])

	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(baseline.expectedPackages)

	playoutModel.setExpectedPackagesForStudioBaseline(baseline.expectedPackages ?? [])
}

export function setDefaultIdOnExpectedPackages(expectedPackages: ExpectedPackage.Any[] | undefined): void {
	// Fill in ids of unnamed expectedPackage
	if (expectedPackages) {
		for (let i = 0; i < expectedPackages.length; i++) {
			const expectedPackage = expectedPackages[i]
			if (!expectedPackage._id) {
				expectedPackage._id = `__index${i}`
			}
		}
	}
}
