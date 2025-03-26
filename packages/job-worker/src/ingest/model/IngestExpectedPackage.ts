import type { ExpectedPackage, Time } from '@sofie-automation/blueprints-integration'
import type {
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

	ingestSources: Array<ExpectedPackageIngestSourcePart | ExpectedPackageIngestSourceRundownBaseline>
}
