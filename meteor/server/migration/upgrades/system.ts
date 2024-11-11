import { Meteor } from 'meteor/meteor'
import { logger } from '../../logging'
import { Blueprints, CoreSystem } from '../../collections'
import { BlueprintManifestType, SystemBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { evalBlueprint } from '../../api/blueprints/cache'
import { CommonContext } from './context'
import { updateTriggeredActionsForShowStyleBaseId } from './lib'
import { CoreSystemId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export async function runUpgradeForCoreSystem(coreSystemId: CoreSystemId): Promise<void> {
	logger.info(`Running upgrade for CoreSystem`)

	const { coreSystem, blueprint, blueprintManifest } = await loadCoreSystemAndBlueprint(coreSystemId)

	if (typeof blueprintManifest.applyConfig !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'applyConfig',
		`coreSystem:${coreSystem._id},blueprint:${blueprint.blueprintId}`
	)

	const result = blueprintManifest.applyConfig(blueprintContext)

	await CoreSystem.updateAsync(coreSystemId, {
		$set: {
			// 'sourceLayersWithOverrides.defaults': normalizeArray(result.sourceLayers, '_id'),
			// 'outputLayersWithOverrides.defaults': normalizeArray(result.outputLayers, '_id'),
			lastBlueprintConfig: {
				blueprintHash: blueprint.blueprintHash,
				blueprintId: blueprint._id,
				blueprintConfigPresetId: undefined,
				config: {},
			},
		},
	})

	await updateTriggeredActionsForShowStyleBaseId(null, result.triggeredActions)
}

async function loadCoreSystemAndBlueprint(coreSystemId: CoreSystemId) {
	const coreSystem = await CoreSystem.findOneAsync(coreSystemId)
	if (!coreSystem) throw new Meteor.Error(404, `CoreSystem "${coreSystemId}" not found!`)

	// if (!showStyleBase.blueprintConfigPresetId) throw new Meteor.Error(500, 'ShowStyleBase is missing config preset')

	const blueprint = coreSystem.blueprintId
		? await Blueprints.findOneAsync({
				_id: coreSystem.blueprintId,
				blueprintType: BlueprintManifestType.SYSTEM,
		  })
		: undefined
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${coreSystem.blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Meteor.Error(500, 'Blueprint is not valid')

	const blueprintManifest = evalBlueprint(blueprint) as SystemBlueprintManifest

	return {
		coreSystem,
		blueprint,
		blueprintManifest,
	}
}
