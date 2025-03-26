import { JobContext } from '../../jobs'
import {
	ExpectedPackageDBNew,
	ExpectedPackageDBType,
	ExpectedPackageIngestSource,
	getContentVersionHash,
	getExpectedPackageIdTmp,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { saveIntoDb } from '../../db/changes'
import { ReadonlyDeep } from 'type-fest'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'

export class StudioBaselineHelper {
	readonly #context: JobContext

	#pendingExpectedPackages: ExpectedPackageDBNew[] | undefined
	#pendingExpectedPlayoutItems: ExpectedPlayoutItemStudio[] | undefined

	constructor(context: JobContext) {
		this.#context = context
	}

	hasChanges(): boolean {
		return !!this.#pendingExpectedPackages || !!this.#pendingExpectedPlayoutItems
	}

	setExpectedPackages(packages: ReadonlyDeep<ExpectedPackage.Any>[]): void {
		const source: ExpectedPackageIngestSource = { fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS }
		this.#pendingExpectedPackages = packages.map((expectedPackage) => ({
			_id: getExpectedPackageIdTmp(this.#context.studioId, source, expectedPackage._id),

			studioId: this.#context.studioId,
			rundownId: null,

			contentVersionHash: getContentVersionHash(expectedPackage),

			created: Date.now(), // nocommit - avoid churn on this?

			package: expectedPackage,

			ingestSources: [source],
		}))
	}
	setExpectedPlayoutItems(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#pendingExpectedPlayoutItems = playoutItems
	}

	async saveAllToDatabase(): Promise<void> {
		await Promise.all([
			this.#pendingExpectedPlayoutItems
				? saveIntoDb(
						this.#context,
						this.#context.directCollections.ExpectedPlayoutItems,
						{ studioId: this.#context.studioId, baseline: 'studio' },
						this.#pendingExpectedPlayoutItems
				  )
				: undefined,
			this.#pendingExpectedPackages
				? saveIntoDb<ExpectedPackageDBNew>(
						this.#context,
						this.#context.directCollections.ExpectedPackages,
						{
							studioId: this.#context.studioId,
							rundownId: null,
						},
						this.#pendingExpectedPackages,
						{
							// nocommit - preserve created timestamps
						}
				  )
				: undefined,
		])

		this.#pendingExpectedPlayoutItems = undefined
		this.#pendingExpectedPackages = undefined
	}
}
