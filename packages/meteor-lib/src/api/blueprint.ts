import type { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'

export interface NewBlueprintAPI {
	insertBlueprint(): Promise<BlueprintId>
	removeBlueprint(blueprintId: BlueprintId): Promise<void>
	assignSystemBlueprint(blueprintId?: BlueprintId): Promise<void>
}

export enum BlueprintAPIMethods {
	'insertBlueprint' = 'showstyles.insertBlueprint',
	'removeBlueprint' = 'showstyles.removeBlueprint',
	'assignSystemBlueprint' = 'blueprint.assignSystem',
}
