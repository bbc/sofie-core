import { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import type { ITranslatableMessage } from './translations'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'

export type UserEditingDefinition = UserEditingDefinitionAction | UserEditingDefinitionForm

export interface UserEditingDefinitionAction {
	type: UserEditingType.ACTION
	id: string
	label: ITranslatableMessage
}

export interface UserEditingDefinitionForm {
	type: UserEditingType.FORM
	id: string
	label: ITranslatableMessage
	schema: JSONBlob<JSONSchema>
	currentValues: Record<string, any>
}

export enum UserEditingType {
	/** Action */
	ACTION = 'action',
	/** Form of selections */
	FORM = 'form',
}
