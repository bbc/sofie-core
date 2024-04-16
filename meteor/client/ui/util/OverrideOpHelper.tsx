import { clone, literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import {
	SomeObjectOverrideOp,
	ObjectWithOverrides,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	filterOverrideOpsForPrefix,
	findParentOpToUpdate,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useRef, useMemo, useEffect, MutableRefObject } from 'react'
import {
	getAllCurrentAndDeletedItemsFromOverrides,
	getAllCurrentItemsFromOverrides,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
} from '@sofie-automation/corelib/dist/overrideOpHelperBackend'
export {
	getAllCurrentAndDeletedItemsFromOverrides,
	getAllCurrentItemsFromOverrides,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
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
class OverrideOpHelperImpl implements OverrideOpHelper {
	readonly #saveOverrides: SaveOverridesFunction
	readonly #objectWithOverridesRef: MutableRefObject<ObjectWithOverrides<any>>

	constructor(
		saveOverrides: SaveOverridesFunction,
		objectWithOverridesRef: MutableRefObject<ObjectWithOverrides<any>>
	) {
		this.#saveOverrides = saveOverrides
		this.#objectWithOverridesRef = objectWithOverridesRef
	}

	clearItemOverrides = (itemId: string, subPath: string): void => {
		if (!this.#objectWithOverridesRef.current) return

		const opPath = `${itemId}.${subPath}`

		const newOps = this.#objectWithOverridesRef.current.overrides.filter((op) => op.path !== opPath)

		this.#saveOverrides(newOps)
	}

	resetItem = (itemId: string): void => {
		if (!this.#objectWithOverridesRef.current) return

		const newOps = filterOverrideOpsForPrefix(this.#objectWithOverridesRef.current.overrides, itemId).otherOps

		this.#saveOverrides(newOps)
	}

	deleteItem = (itemId: string): void => {
		const newOps = filterOverrideOpsForPrefix(this.#objectWithOverridesRef.current.overrides, itemId).otherOps
		if (this.#objectWithOverridesRef.current.defaults[itemId]) {
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
		if (!this.#objectWithOverridesRef.current) return

		const { otherOps: newOps, opsForPrefix: opsForId } = filterOverrideOpsForPrefix(
			this.#objectWithOverridesRef.current.overrides,
			oldItemId
		)

		if (
			!newItemId ||
			newOps.find((op) => op.path === newItemId) ||
			this.#objectWithOverridesRef.current.defaults[newItemId]
		) {
			throw new Error('Id is invalid or already in use')
		}

		if (this.#objectWithOverridesRef.current.defaults[oldItemId]) {
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
		if (!this.#objectWithOverridesRef.current) return

		if (subPath === '_id') {
			throw new Error('Item id cannot be changed through this helper')
		} else {
			// Set a property
			const { otherOps: newOps, opsForPrefix: opsForId } = filterOverrideOpsForPrefix(
				this.#objectWithOverridesRef.current.overrides,
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
		if (!this.#objectWithOverridesRef.current) return

		// Set a property
		const { otherOps: newOps } = filterOverrideOpsForPrefix(this.#objectWithOverridesRef.current.overrides, itemId)

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
export function useOverrideOpHelper<T extends object>(
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void,
	objectWithOverrides: ObjectWithOverrides<T>
): OverrideOpHelper {
	const objectWithOverridesRef = useRef(objectWithOverrides)

	const helper = useMemo(
		() => new OverrideOpHelperImpl(saveOverrides, objectWithOverridesRef),
		[saveOverrides, objectWithOverridesRef]
	)

	// Use a ref to minimise reactivity when it changes
	useEffect(() => {
		objectWithOverridesRef.current = objectWithOverrides
	}, [objectWithOverrides])

	return helper
}
