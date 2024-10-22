import { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import type { ITranslatableMessage } from './translations'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'

/**
 * Description of a user performed editing operation allowed on an document
 */
export type UserEditingDefinition = UserEditingDefinitionAction | UserEditingDefinitionForm

/**
 * A simple 'action' that can be performed
 */
export interface UserEditingDefinitionAction {
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
	/** Button Type */
	buttonType?: UserEditingButtonType
}

/**
 * A simple form based operation
 */
export interface UserEditingDefinitionForm {
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
}

export enum UserEditingType {
	/** Action */
	ACTION = 'action',
	/** Form of selections */
	FORM = 'form',
}

/**
 * Grouping of schemas
 */
export interface UserEditingGroupingType {
	filter?: string
	label?: string
	color?: string
	svgIcon?: string
}

export enum UserEditingButtonType {
	/** Button */
	BUTTON = 'button',
	/** Icon */
	SWITCH = 'switch',
	/** Hidden */
	HIDDEN = 'hidden',
}
