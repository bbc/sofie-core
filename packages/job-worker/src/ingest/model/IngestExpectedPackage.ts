import type { ExpectedPackage, Time } from '@sofie-automation/blueprints-integration'
import type {
	ExpectedPackageDBNew,
	ExpectedPackageDBType,
	ExpectedPackageIngestSourcePart,
	ExpectedPackageIngestSourceRundownBaseline,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import type { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { ReadonlyDeep } from 'type-fest'

export interface IngestExpectedPackage<
	TPackageSource extends { fromPieceType: ExpectedPackageDBType } =
		| ExpectedPackageIngestSourcePart
		| ExpectedPackageIngestSourceRundownBaseline
> {
	_id: ExpectedPackageId

	/** Hash that changes whenever the content or version changes. See getContentVersionHash() */
	contentVersionHash: string

	/** The time this expectedPackage was created. This can be null when it has not yet been written to mongodb */
	created: Time | null

	package: ReadonlyDeep<ExpectedPackage.Any>

	// HACK: Temporary single item
	ingestSources: [TPackageSource]
}

export function stripExpectedPackageDBToIngestExpectedPackage(
	expectedPackage: ExpectedPackageDBNew
): IngestExpectedPackage {
	return {
		_id: expectedPackage._id,
		contentVersionHash: expectedPackage.contentVersionHash,
		created: expectedPackage.created,
		package: expectedPackage.package,
		ingestSources: expectedPackage.ingestSources as any, // nocommit - avoid this cast?
	}
}
