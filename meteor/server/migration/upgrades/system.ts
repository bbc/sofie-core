import { Meteor } from 'meteor/meteor'
import { getCoreSystemAsync } from '../../coreSystem/collection'
import { logger } from '../../logging'
import { Blueprints, CoreSystem } from '../../collections'
import { BlueprintManifestType, SystemBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { evalBlueprint } from '../../api/blueprints/cache'
import { CommonContext } from './context'
import { updateTriggeredActionsForShowStyleBaseId } from './lib'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'

export async function runUpgradeForCoreSystem(): Promise<void> {
	logger.info(`Running upgrade for CoreSystem`)

	const { coreSystem, blueprint, blueprintManifest } = await loadCoreSystemAndBlueprint()

	if (typeof blueprintManifest.applyConfig !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'applyConfig',
		`coreSystem:${coreSystem._id},blueprint:${blueprint.blueprintId}`
	)

	const result = blueprintManifest.applyConfig(blueprintContext)

	await CoreSystem.updateAsync(SYSTEM_ID, {
		$set: {
			// 'sourceLayersWithOverrides.defaults': normalizeArray(result.sourceLayers, '_id'),
			// 'outputLayersWithOverrides.defaults': normalizeArray(result.outputLayers, '_id'),
			lastBlueprintConfig: {
				blueprintHash: blueprint.blueprintHash,
				blueprintId: blueprint._id,
			},
		},
	})

	await updateTriggeredActionsForShowStyleBaseId(null, result.triggeredActions)
}

async function loadCoreSystemAndBlueprint() {
	const coreSystem = await getCoreSystemAsync()
	if (!coreSystem) throw new Meteor.Error(404, `CoreSystem not found!`)

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
