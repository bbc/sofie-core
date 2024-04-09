import { JobContext } from '../../jobs'
import { IngestJobs, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import {
	handleMosDeleteStory,
	handleMosFullStory,
	handleMosInsertStories,
	handleMosMoveStories,
	handleMosSwapStories,
} from '../../ingest/mosDevice/mosStoryJobs'
import {
	handleMosRundownData,
	handleMosRundownMetadata,
	handleMosRundownReadyToAir,
	handleMosRundownStatus,
} from '../../ingest/mosDevice/mosRundownJobs'
import {
	handleRegenerateRundown,
	handleRemovedRundown,
	handleUpdatedRundown,
	handleUpdatedRundownMetaData,
	handleUserRemoveRundown,
	handleUserUnsyncRundown,
} from '../../ingest/ingestRundownJobs'
import { handleRemovedPart, handleUpdatedPart } from '../../ingest/ingestPartJobs'
import {
	handleRegenerateSegment,
	handleRemovedSegment,
	handleRemoveOrphanedSegemnts,
	handleUpdatedSegment,
	handleUpdatedSegmentRanks,
} from '../../ingest/ingestSegmentJobs'
import { handleExpectedPackagesRegenerate, handleUpdatedPackageInfoForRundown } from '../../ingest/packageInfo'
import {
	handleBucketActionModify,
	handleBucketActionRegenerateExpectedPackages,
	handleBucketEmpty,
	handleBucketPieceModify,
	handleBucketRemoveAdlibAction,
	handleBucketRemoveAdlibPiece,
} from '../../ingest/bucket/bucketAdlibs'
import { handleBucketItemImport, handleBucketItemRegenerate } from '../../ingest/bucket/import'
import { wrapMosIngestJob } from '../../ingest/mosDevice/lib'
import { handleUserExecuteChangeOperation } from '../../ingest/userOperation'

type ExecutableFunction<T extends keyof IngestJobFunc> = (
	context: JobContext,
	data: Parameters<IngestJobFunc[T]>[0]
) => Promise<ReturnType<IngestJobFunc[T]>>

export type IngestJobHandlers = {
	[T in keyof IngestJobFunc]: ExecutableFunction<T>
}

export const ingestJobHandlers: IngestJobHandlers = {
	[IngestJobs.RemoveRundown]: handleRemovedRundown,
	[IngestJobs.UpdateRundown]: handleUpdatedRundown,
	[IngestJobs.UpdateRundownMetaData]: handleUpdatedRundownMetaData,
	[IngestJobs.RemoveSegment]: handleRemovedSegment,
	[IngestJobs.UpdateSegment]: handleUpdatedSegment,
	[IngestJobs.UpdateSegmentRanks]: handleUpdatedSegmentRanks,
	[IngestJobs.RemovePart]: handleRemovedPart,
	[IngestJobs.UpdatePart]: handleUpdatedPart,
	[IngestJobs.RegenerateRundown]: handleRegenerateRundown,
	[IngestJobs.RegenerateSegment]: handleRegenerateSegment,

	[IngestJobs.RemoveOrphanedSegments]: handleRemoveOrphanedSegemnts,

	[IngestJobs.MosRundown]: handleMosRundownData,
	[IngestJobs.MosRundownMetadata]: handleMosRundownMetadata,
	[IngestJobs.MosRundownStatus]: handleMosRundownStatus,
	[IngestJobs.MosRundownReadyToAir]: handleMosRundownReadyToAir,
	[IngestJobs.MosFullStory]: wrapMosIngestJob(handleMosFullStory),
	[IngestJobs.MosDeleteStory]: wrapMosIngestJob(handleMosDeleteStory),
	[IngestJobs.MosInsertStory]: wrapMosIngestJob(handleMosInsertStories),
	[IngestJobs.MosMoveStory]: wrapMosIngestJob(handleMosMoveStories),
	[IngestJobs.MosSwapStory]: wrapMosIngestJob(handleMosSwapStories),

	[IngestJobs.ExpectedPackagesRegenerate]: handleExpectedPackagesRegenerate,
	[IngestJobs.PackageInfosUpdatedRundown]: handleUpdatedPackageInfoForRundown,

	[IngestJobs.UserRemoveRundown]: handleUserRemoveRundown,
	[IngestJobs.UserUnsyncRundown]: handleUserUnsyncRundown,
	[IngestJobs.UserExecuteChangeOperation]: handleUserExecuteChangeOperation,

	[IngestJobs.BucketItemImport]: handleBucketItemImport,
	[IngestJobs.BucketItemRegenerate]: handleBucketItemRegenerate,
	[IngestJobs.BucketActionRegenerateExpectedPackages]: handleBucketActionRegenerateExpectedPackages,
	[IngestJobs.BucketActionModify]: handleBucketActionModify,
	[IngestJobs.BucketPieceModify]: handleBucketPieceModify,
	[IngestJobs.BucketRemoveAdlibPiece]: handleBucketRemoveAdlibPiece,
	[IngestJobs.BucketRemoveAdlibAction]: handleBucketRemoveAdlibAction,
	[IngestJobs.BucketEmpty]: handleBucketEmpty,
}
