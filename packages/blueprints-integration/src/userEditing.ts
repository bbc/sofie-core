import { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import type { ITranslatableMessage } from './translations'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SourceLayerType } from './content'

/**
 * Description of a user performed editing operation allowed on an document
 */
export type UserEditingDefinition =
	| UserEditingDefinitionAction
	| UserEditingDefinitionForm
	| UserEditingDefinitionSourceLayerForm

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
	svgIconInactive?: string
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
	/** The json schema describing the form to display */
	schema: JSONBlob<JSONSchema>
	/** Current values to populate the form with */
	currentValues: Record<string, any>
}

/**
 * A form based operation where the user first selects the type
 * of form they want to use (i.e. Camera form vs VT form)
 */
export interface UserEditingDefinitionSourceLayerForm {
	type: UserEditingType.SOURCE_LAYER_FORM
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** The json schemas describing the form to display */
	schemas: Record<string, UserEditingSourceLayer>
	/** Current values to populate the form with */
	currentValues: Record<string, any>
}

export enum UserEditingType {
	/** Action */
	ACTION = 'action',
	/** Form */
	FORM = 'form',
	/** Forms that the user has to select a sourceLayerType first */
	SOURCE_LAYER_FORM = 'sourceLayerForm',
}

export interface UserEditingSourceLayer {
	sourceLayerLabel: string
	sourceLayerType: SourceLayerType
	schema: JSONBlob<JSONSchema>
}

export enum UserEditingButtonType {
	/** Button */
	BUTTON = 'button',
	/** Icon */
	SWITCH = 'switch',
	/** Hidden */
	HIDDEN = 'hidden',
}
