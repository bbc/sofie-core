import type {
	UserEditingType,
	JSONBlob,
	JSONSchema,
	UserEditingSourceLayer,
	UserEditingButtonType,
	SourceLayerType,
} from '@sofie-automation/blueprints-integration'
import type { ITranslatableMessage } from '../TranslatableMessage'

export type CoreUserEditingDefinition =
	| CoreUserEditingDefinitionAction
	| CoreUserEditingDefinitionForm
	| CoreUserEditingDefinitionSourceLayerForm

export interface CoreUserEditingDefinitionAction {
	type: UserEditingType.ACTION
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** Icon to show when this action is 'active' */
	svgIcon?: string
	/** Icon to show when this action is 'disabled' */
	svgIconInactive?: string
	/** Whether this action should be indicated as being active */
	isActive?: boolean
	//** Button Type */
	buttonType?: UserEditingButtonType
}

/**
 * A simple form based operation
 */
export interface CoreUserEditingDefinitionForm {
	type: UserEditingType.FORM
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** The json schema describing the form to display */
	schema: JSONBlob<JSONSchema>
	/** Current values to populate the form with */
	currentValues: Record<string, any>
	/** Translation namespaces to use when rendering this form */
	translationNamespaces: string[]
}

/**
 * A form based operation where the user first selects the type
 * of form they want to use (i.e. Camera form vs VT form)
 */
export interface CoreUserEditingDefinitionSourceLayerForm {
	type: UserEditingType.SOURCE_LAYER_FORM
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** Sourcelayer Type */
	schemas: Record<string, UserEditingSourceLayer>
	/** Translation namespaces to use when rendering this form */
	translationNamespaces: string[]
	/** Current values to populate the form with */
	currentValues: {
		type: SourceLayerType
		value: Record<string, any>
	}
}

export interface CoreUserEditingProperties {
	/**
	 * These properties are dependent on the (primary) piece type, the user will get the option
	 * to select the type of piece (from the SourceLayerTypes i.e. Camera or Split etc.) and then
	 * be presented the corresponding form
	 *
	 * example:
	 * {
	 * 	 schema: {
	 * 	   camera: '{ "type": "object", "properties": { "input": { "type": "number" } } }',
	 * 	   split: '{ "type": "object", ... }',
	 * 	 },
	 *   currentValue: {
	 *     type: 'camera',
	 *     value: {
	 *       input: 3
	 *     },
	 *   }
	 * }
	 */
	pieceTypeProperties?: {
		schema: Record<string, UserEditingSourceLayer>
		currentValue: { type: string; value: Record<string, any> }
	}

	/**
	 * These are properties that are available to edit regardless of the piece type, examples
	 * could be whether it an element is locked from NRCS updates
	 *
	 * if you do not want the piece type to be changed, then use only this field.
	 */
	globalProperties?: { schema: JSONBlob<JSONSchema>; currentValue: Record<string, any> }

	/**
	 * A list of id's of operations to be exposed on the properties panel as buttons. These operations
	 * must be available on the element
	 *
	 * note - perhaps these should have their own full definitions?
	 */
	operations?: CoreUserEditingDefinitionAction[]

	/** Translation namespaces to use when rendering this form */
	translationNamespaces: string[]
}
