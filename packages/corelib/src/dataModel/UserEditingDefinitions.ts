import type {
	UserEditingType,
	UserEditingGroupingType,
	JSONBlob,
	JSONSchema,
	UserEditingButtonType,
} from '@sofie-automation/blueprints-integration'
import type { ITranslatableMessage } from '../TranslatableMessage'

export type CoreUserEditingDefinition = CoreUserEditingDefinitionAction | CoreUserEditingDefinitionForm

export interface CoreUserEditingDefinitionAction {
	type: UserEditingType.ACTION
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** Icon to show when this action is 'active' */
	svgIcon?: string
	/** Icon to show when this action is 'disabled' */
	svgIconDisabled?: string
	/** Whether this action should be indicated as being active */
	isActive?: boolean
	//** Button Type */
	buttonType?: UserEditingButtonType
}

export interface CoreUserEditingDefinitionForm {
	type: UserEditingType.FORM
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** Used to group the schemas and filter them */
	grouping?: UserEditingGroupingType[]
	/** The json schemas describing the form to display */
	schemas: Record<string, JSONBlob<JSONSchema>>

	/** Current values to populate the form with */
	currentValues: Record<string, any>
	/** Translation namespaces to use when rendering this form */
	translationNamespaces: string[]
}
