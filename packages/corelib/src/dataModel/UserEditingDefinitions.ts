import type {
	UserEditingType,
	JSONBlob,
	JSONSchema,
	UserEditingSourceLayer,
	UserEditingButtonType,
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
	currentValues: Record<string, any>
}
