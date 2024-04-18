import { clone, literal, objectPathSet } from './lib'
import {
	SomeObjectOverrideOp,
	ObjectWithOverrides,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	applyAndValidateOverrides,
	filterOverrideOpsForPrefix,
	findParentOpToUpdate,
} from './settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'

export interface WrappedOverridableItemDeleted<T extends object> {
	type: 'deleted'
	id: string
	computed: undefined
	defaults: ReadonlyDeep<T>
	overrideOps: ReadonlyDeep<SomeObjectOverrideOp[]>
}
export interface WrappedOverridableItemNormal<T extends object> {
	type: 'normal'
	id: string
	computed: T
	defaults: ReadonlyDeep<T> | undefined
	overrideOps: ReadonlyDeep<SomeObjectOverrideOp[]>
}

export type WrappedOverridableItem<T extends object> =
	| WrappedOverridableItemDeleted<T>
	| WrappedOverridableItemNormal<T>

/**
 * Compile a sorted array of all the items currently in the ObjectWithOverrides, and those that have been deleted
 * @param rawObject The ObjectWithOverrides to look at
 * @param comparitor Comparitor for sorting the items
 * @returns Sorted items, with sorted deleted items at the end
 */
export function getAllCurrentAndDeletedItemsFromOverrides<T extends object>(
	rawObject: ReadonlyDeep<ObjectWithOverrides<Record<string, T | undefined>>>,
	comparitor:
		| ((a: [id: string, obj: T | ReadonlyDeep<T>], b: [id: string, obj: T | ReadonlyDeep<T>]) => number)
		| null
): WrappedOverridableItem<T>[] {
	const resolvedObject = applyAndValidateOverrides(rawObject).obj

	// Convert the items into an array
	const validItems: Array<[id: string, obj: T]> = []
	for (const [id, obj] of Object.entries<T | undefined>(resolvedObject)) {
		if (obj) validItems.push([id, obj])
	}

	if (comparitor) validItems.sort((a, b) => comparitor(a, b))

	// Sort and wrap in the return type
	const sortedItems = validItems.map(([id, obj]) =>
		literal<WrappedOverridableItemNormal<T>>({
			type: 'normal',
			id: id,
			computed: obj,
			defaults: rawObject.defaults[id],
			overrideOps: filterOverrideOpsForPrefix(rawObject.overrides, id).opsForPrefix,
		})
	)

	const removedOutputLayers: WrappedOverridableItemDeleted<T>[] = []

	// Find the items which have been deleted with an override
	const computedOutputLayerIds = new Set(sortedItems.map((l) => l.id))
	for (const [id, output] of Object.entries<ReadonlyDeep<T | undefined>>(rawObject.defaults)) {
		if (!computedOutputLayerIds.has(id) && output) {
			removedOutputLayers.push(
				literal<WrappedOverridableItemDeleted<T>>({
					type: 'deleted',
					id: id,
					computed: undefined,
					defaults: output,
					overrideOps: filterOverrideOpsForPrefix(rawObject.overrides, id).opsForPrefix,
				})
			)
		}
	}

	if (comparitor) removedOutputLayers.sort((a, b) => comparitor([a.id, a.defaults], [b.id, b.defaults]))

	return [...sortedItems, ...removedOutputLayers]
}

/**
 * Compile a sorted array of all the items currently active in the ObjectWithOverrides
 * @param rawObject The ObjectWithOverrides to look at
 * @param comparitor Comparitor for sorting the items
 * @returns Sorted items, with sorted deleted items at the end
 */
export function getAllCurrentItemsFromOverrides<T extends object>(
	rawObject: ReadonlyDeep<ObjectWithOverrides<Record<string, T | undefined>>>,
	comparitor:
		| ((a: [id: string, obj: T | ReadonlyDeep<T>], b: [id: string, obj: T | ReadonlyDeep<T>]) => number)
		| null
): WrappedOverridableItemNormal<T>[] {
	const allCurrentAndDeleted = getAllCurrentAndDeletedItemsFromOverrides(rawObject, comparitor)
	return allCurrentAndDeleted.filter((item) => item.type !== 'deleted') as WrappedOverridableItemNormal<T>[]
}

type SaveOverridesFunction = (newOps: SomeObjectOverrideOp[]) => void

export interface OverrideOpHelperForItemContents {
	/**
	 * Clear all of the overrides for an value inside of an item
	 * This acts as a reset of property of its child properties
	 * Has no effect if there are no `overrideOps` on the `WrappedOverridableItemNormal`
	 */
	clearItemOverrides(itemId: string, subPath: string): void

	/**
	 * Set the value of a property of an item.
	 * Note: the id cannot be changed in this way
	 */
	setItemValue(itemId: string, subPath: string, value: unknown): void
}

export interface OverrideOpHelper extends OverrideOpHelperForItemContents {
	/**
	 * Clear all of the overrides for an item
	 * This acts as a reset to defaults or undelete
	 * Has no effect if there are no `overrideOps` on the `WrappedOverridableItemNormal`
	 */
	resetItem(itemId: string): void

	/**
	 * Delete an item from the object
	 */
	deleteItem(itemId: string): void

	/**
	 * Change the id of an item.
	 * This is only possible for ones which were created by an override, and does not exist in the defaults
	 * Only possible when the item being renamed does not exist in the defaults
	 */
	changeItemId(oldItemId: string, newItemId: string): void

	/**
	 * Replace a whole item with a new object
	 * Note: the id cannot be changed in this way
	 */
	replaceItem(itemId: string, value: any): void
}
export class OverrideOpHelperImpl implements OverrideOpHelper {
	readonly #saveOverrides: SaveOverridesFunction
	readonly #objectWithOverrides: ObjectWithOverrides<any>

	constructor(saveOverrides: SaveOverridesFunction, objectWithOverridesRef: ObjectWithOverrides<any>) {
		this.#saveOverrides = saveOverrides
		this.#objectWithOverrides = objectWithOverridesRef
	}

	clearItemOverrides = (itemId: string, subPath: string): void => {
		if (!this.#objectWithOverrides) return

		const opPath = `${itemId}.${subPath}`

		const newOps = this.#objectWithOverrides.overrides.filter((op) => op.path !== opPath)

		this.#saveOverrides(newOps)
	}

	resetItem = (itemId: string): void => {
		if (!this.#objectWithOverrides) return

		const newOps = filterOverrideOpsForPrefix(this.#objectWithOverrides.overrides, itemId).otherOps

		this.#saveOverrides(newOps)
	}

	deleteItem = (itemId: string): void => {
		const newOps = filterOverrideOpsForPrefix(this.#objectWithOverrides.overrides, itemId).otherOps
		if (this.#objectWithOverrides.defaults[itemId]) {
			// If it was from the defaults, we need to mark it deleted
			newOps.push(
				literal<ObjectOverrideDeleteOp>({
					op: 'delete',
					path: itemId,
				})
			)
		}

		this.#saveOverrides(newOps)
	}

	changeItemId = (oldItemId: string, newItemId: string): void => {
		if (!this.#objectWithOverrides) return

		const { otherOps: newOps, opsForPrefix: opsForId } = filterOverrideOpsForPrefix(
			this.#objectWithOverrides.overrides,
			oldItemId
		)

		if (!newItemId || newOps.find((op) => op.path === newItemId) || this.#objectWithOverrides.defaults[newItemId]) {
			throw new Error('Id is invalid or already in use')
		}

		if (this.#objectWithOverrides.defaults[oldItemId]) {
			// Future: should we be able to handle this?
			throw new Error("Can't change id of object with defaults")
		} else {
			// Change the id prefix of the ops
			for (const op of opsForId) {
				const newPath = `${newItemId}${op.path.substring(oldItemId.length)}`

				const newOp = {
					...op,
					path: newPath,
				}
				newOps.push(newOp)

				if (newOp.path === newItemId && newOp.op === 'set') {
					newOp.value._id = newItemId
				}
			}

			this.#saveOverrides(newOps)
		}
	}

	setItemValue = (itemId: string, subPath: string, value: unknown): void => {
		if (!this.#objectWithOverrides) return

		if (subPath === '_id') {
			throw new Error('Item id cannot be changed through this helper')
		} else {
			// Set a property
			const { otherOps: newOps, opsForPrefix: opsForId } = filterOverrideOpsForPrefix(
				this.#objectWithOverrides.overrides,
				itemId
			)

			const setRootOp = opsForId.find((op) => op.path === itemId)
			if (setRootOp && setRootOp.op === 'set') {
				// This is as its base an override, so modify that instead
				const newOp = clone(setRootOp)

				objectPathSet(newOp.value, subPath, value)

				newOps.push(newOp)
			} else {
				// Look for a op which encompasses this new value
				const parentOp = findParentOpToUpdate(opsForId, subPath)
				if (parentOp) {
					// Found an op at a higher level that can be modified instead
					objectPathSet(parentOp.op.value, parentOp.newSubPath, value)
				} else {
					// Insert new op
					const newOp = literal<ObjectOverrideSetOp>({
						op: 'set',
						path: `${itemId}.${subPath}`,
						value: value,
					})

					const newOpAsPrefix = `${newOp.path}.`

					// Preserve any other overrides
					for (const op of opsForId) {
						if (op.path === newOp.path || op.path.startsWith(newOpAsPrefix)) {
							// ignore, as op has been replaced by the one at a higher path
						} else {
							// Retain unrelated op
							newOps.push(op)
						}
					}
					// Add the new override
					newOps.push(newOp)
				}
			}

			this.#saveOverrides(newOps)
		}
	}

	replaceItem = (itemId: string, value: unknown): void => {
		if (!this.#objectWithOverrides) return

		// Set a property
		const { otherOps: newOps } = filterOverrideOpsForPrefix(this.#objectWithOverrides.overrides, itemId)

		// TODO - is this too naive?

		newOps.push(
			literal<ObjectOverrideSetOp>({
				op: 'set',
				path: `${itemId}`,
				value: value,
			})
		)

		this.#saveOverrides(newOps)
	}
}

/**
 * A helper to work with modifying an ObjectWithOverrides<T>
 */
export function useOverrideOpHelperBackend<T extends object>(
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void,
	objectWithOverrides: ObjectWithOverrides<T>
): OverrideOpHelper {
	return new OverrideOpHelperImpl(saveOverrides, objectWithOverrides)
}