import type { ExpectedPackage, Time } from '@sofie-automation/blueprints-integration'
import type {
	ExpectedPackageDBNew,
	ExpectedPackageIngestSourcePart,
	ExpectedPackageIngestSourceRundownBaseline,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import type { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { ReadonlyDeep } from 'type-fest'

export interface IngestExpectedPackage {
	_id: ExpectedPackageId

	/** Hash that changes whenever the content or version changes. See getContentVersionHash() */
	contentVersionHash: string

	created: Time

	package: ReadonlyDeep<ExpectedPackage.Any>

	// HACK: Temporary single item
	ingestSources: [ExpectedPackageIngestSourcePart | ExpectedPackageIngestSourceRundownBaseline]
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
