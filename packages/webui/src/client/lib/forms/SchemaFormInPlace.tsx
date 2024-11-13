import { literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import { useCallback, useMemo, useState } from 'react'
import {
	WrappedOverridableItemNormal,
	OverrideOpHelperForItemContentsBatcher,
} from '../../ui/Settings/util/OverrideOpHelper'
import { SchemaFormCommonProps } from './schemaFormUtil'
import { SchemaFormWithOverrides } from './SchemaFormWithOverrides'
import './SchemaFormInPlace.scss'

interface SchemaFormInPlaceProps extends Omit<SchemaFormCommonProps, 'isRequired'> {
	/** The object to be modified in place */
	object: any
}
export function SchemaFormInPlace({ object, ...commonProps }: Readonly<SchemaFormInPlaceProps>): JSX.Element {
	// This is a hack to avoid issues with the UI re-rendering as 'nothing' changed
	const [editCount, setEditCount] = useState(0)
	const forceRender = useCallback(() => setEditCount((v) => v + 1), [])

	const helper = useCallback(() => new OverrideOpHelperInPlace(object, forceRender), [object, forceRender])

	const wrappedItem = useMemo(
		() =>
			literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: 'not-used' + editCount,
				computed: object,
				defaults: undefined,
				overrideOps: [],
			}),
		[object, editCount]
	)

	return <SchemaFormWithOverrides {...commonProps} attr={''} item={wrappedItem} overrideHelper={helper} isRequired />
}

interface StyledSchemaFormInPlaceProps extends Omit<SchemaFormCommonProps, 'isRequired'> {
	/** The object to be modified in place */
	object: any
	/** Optional CSS class to apply to the form wrapper */
	/** This may or may not work, as there's different styling in the sub components */
	className?: string
	/** Whether to use compact styling */
	compact?: boolean
	/** Width for the form (e.g., '300px', '100%') */
	width?: string
}

export function StyledSchemaFormInPlace({
	object,
	className = '',
	compact = false,
	width = '',
	...commonProps
}: Readonly<StyledSchemaFormInPlaceProps>): JSX.Element {
	// This is a hack to avoid issues with the UI re-rendering as 'nothing' changed
	const [editCount, setEditCount] = useState(0)
	const forceRender = useCallback(() => setEditCount((v) => v + 1), [])

	const helper = useCallback(() => new OverrideOpHelperInPlace(object, forceRender), [object, forceRender])

	const wrappedItem = useMemo(
		() =>
			literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: 'not-used' + editCount,
				computed: object,
				defaults: undefined,
				overrideOps: [],
			}),
		[object, editCount]
	)

	const style = {
		width: width || '300px',
		maxWidth: width || '300px',
		minWidth: width || '300px',
	}

	const formClasses = ['styled-schema-form', compact ? 'space-y-2' : 'space-y-4', className].filter(Boolean).join(' ')

	return (
		<div className={formClasses} style={style}>
			<SchemaFormWithOverrides {...commonProps} attr={''} item={wrappedItem} overrideHelper={helper} isRequired />
		</div>
	)
}

/**
 * An alternate OverrideOpHelper designed to directly mutate an object, instead of using the `ObjectWithOverrides` system.
 * This allows us to have one SchemaForm implementation that can handle working with `ObjectWithOverrides`, and simpler options
 */
class OverrideOpHelperInPlace implements OverrideOpHelperForItemContentsBatcher {
	readonly #object: any
	readonly #forceRender: () => void

	constructor(object: any, forceRender: () => void) {
		this.#object = object
		this.#forceRender = forceRender
	}

	clearItemOverrides(_itemId: string, _subPath: string): this {
		// Not supported as this is faking an item with overrides

		return this
	}
	setItemValue(_itemId: string, subPath: string, value: any): this {
		objectPathSet(this.#object, subPath, value)

		return this
	}

	commit(): void {
		this.#forceRender()
	}
}
