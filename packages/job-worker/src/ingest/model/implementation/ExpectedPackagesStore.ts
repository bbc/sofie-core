import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import {
	ExpectedMediaItemId,
	ExpectedPlayoutItemId,
	PartId,
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { diffAndReturnLatestObjects, DocumentChanges, getDocumentChanges, setValuesAndTrackChanges } from './utils.js'
import type { IngestExpectedPackage } from '../IngestExpectedPackage.js'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'

export class ExpectedPackagesStore<TPackageSource extends { fromPieceType: ExpectedPackageDBType }> {
	#expectedMediaItems: ExpectedMediaItemRundown[]
	#expectedPlayoutItems: ExpectedPlayoutItemRundown[]
	#expectedPackages: IngestExpectedPackage<TPackageSource>[]

	#expectedMediaItemsWithChanges = new Set<ExpectedMediaItemId>()
	#expectedPlayoutItemsWithChanges = new Set<ExpectedPlayoutItemId>()
	#expectedPackagesHasChanges = false

	get expectedMediaItems(): ReadonlyDeep<ExpectedMediaItemRundown[]> {
		return this.#expectedMediaItems
	}
	get expectedPlayoutItems(): ReadonlyDeep<ExpectedPlayoutItemRundown[]> {
		return this.#expectedPlayoutItems
	}
	get expectedPackages(): ReadonlyDeep<IngestExpectedPackage<TPackageSource>[]> {
		// Typescript is not happy because of the generic
		return this.#expectedPackages as any
	}

	get hasChanges(): boolean {
		return (
			this.#expectedMediaItemsWithChanges.size > 0 ||
			this.#expectedPlayoutItemsWithChanges.size > 0 ||
			this.#expectedPackagesHasChanges
		)
	}

	get expectedMediaItemsChanges(): DocumentChanges<ExpectedMediaItemRundown> {
		return getDocumentChanges(this.#expectedMediaItemsWithChanges, this.#expectedMediaItems)
	}
	get expectedPlayoutItemsChanges(): DocumentChanges<ExpectedPlayoutItemRundown> {
		return getDocumentChanges(this.#expectedPlayoutItemsWithChanges, this.#expectedPlayoutItems)
	}
	// get expectedPackagesChanges(): DocumentChanges<IngestExpectedPackage<TPackageSource>> {
	// 	return getDocumentChanges(this.#expectedPackagesWithChanges, this.#expectedPackages)
	// }

	clearChangedFlags(): void {
		this.#expectedMediaItemsWithChanges.clear()
		this.#expectedPlayoutItemsWithChanges.clear()
		this.#expectedPackagesHasChanges = false
	}

	#rundownId: RundownId
	#partId: PartId | undefined

	constructor(
		isBeingCreated: boolean,
		rundownId: RundownId,
		partId: PartId | undefined,
		expectedMediaItems: ExpectedMediaItemRundown[],
		expectedPlayoutItems: ExpectedPlayoutItemRundown[],
		expectedPackages: IngestExpectedPackage<TPackageSource>[]
	) {
		this.#rundownId = rundownId
		this.#partId = partId

		this.#expectedMediaItems = expectedMediaItems
		this.#expectedPlayoutItems = expectedPlayoutItems
		this.#expectedPackages = expectedPackages

		if (isBeingCreated) {
			// Everything contained currently is a new document, track the ids as having changed
			for (const expectedPlayoutItem of this.#expectedPlayoutItems) {
				this.#expectedPlayoutItemsWithChanges.add(expectedPlayoutItem._id)
			}
			for (const expectedMediaItem of this.#expectedMediaItems) {
				this.#expectedMediaItemsWithChanges.add(expectedMediaItem._id)
			}
			this.#expectedPackagesHasChanges = true
		}
	}

	setOwnerIds(
		rundownId: RundownId,
		partId: PartId | undefined,
		updatePackageSource: (source: TPackageSource) => boolean
	): void {
		this.#rundownId = rundownId
		this.#partId = partId

		setValuesAndTrackChanges(this.#expectedPlayoutItemsWithChanges, this.#expectedPlayoutItems, {
			rundownId,
			partId,
		})
		setValuesAndTrackChanges(this.#expectedMediaItemsWithChanges, this.#expectedMediaItems, {
			rundownId,
			partId,
		})
		for (const expectedPackage of this.#expectedPackages) {
			const mutatorChanged = updatePackageSource(expectedPackage.source)

			// The doc changed, track it as such
			if (mutatorChanged) this.#expectedPackagesHasChanges = true
		}
	}

	compareToPreviousData(oldStore: ExpectedPackagesStore<TPackageSource>): void {
		// Diff the objects, but don't update the stored copies
		diffAndReturnLatestObjects(
			this.#expectedPlayoutItemsWithChanges,
			oldStore.#expectedPlayoutItems,
			this.#expectedPlayoutItems
		)
		diffAndReturnLatestObjects(
			this.#expectedMediaItemsWithChanges,
			oldStore.#expectedMediaItems,
			this.#expectedMediaItems
		)
		this.#expectedPackagesHasChanges = true
	}

	setExpectedPlayoutItems(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void {
		const newExpectedPlayoutItems: ExpectedPlayoutItemRundown[] = expectedPlayoutItems.map((item) => ({
			...item,
			partId: this.#partId,
			rundownId: this.#rundownId,
		}))

		this.#expectedPlayoutItems = diffAndReturnLatestObjects(
			this.#expectedPlayoutItemsWithChanges,
			this.#expectedPlayoutItems,
			newExpectedPlayoutItems
		)
	}
	setExpectedMediaItems(expectedMediaItems: ExpectedMediaItemRundown[]): void {
		const newExpectedMediaItems: ExpectedMediaItemRundown[] = expectedMediaItems.map((item) => ({
			...item,
			partId: this.#partId,
			rundownId: this.#rundownId,
		}))

		this.#expectedMediaItems = diffAndReturnLatestObjects(
			this.#expectedMediaItemsWithChanges,
			this.#expectedMediaItems,
			newExpectedMediaItems
		)
	}
	setExpectedPackages(expectedPackages: IngestExpectedPackage<TPackageSource>[]): void {
		this.#expectedPackagesHasChanges = true
		this.#expectedPackages = [...expectedPackages]
	}
}
