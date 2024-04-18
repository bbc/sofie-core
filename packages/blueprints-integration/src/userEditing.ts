import type { ITranslatableMessage } from './translations'

export type UserEditingDefinition = UserEditingDefinitionAction // TODO: form based and more types

export interface UserEditingDefinitionAction {
	type: 'action'
	id: string
	label: ITranslatableMessage
}
