import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MappingExt, MappingsExt, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ReadonlyDeep } from 'type-fest'
import { getActiveRoutes, getRoutedMappings } from '../../../../lib/collections/Studios'
import { ObjectWithOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { getAllCurrentAndDeletedItemsFromOverrides } from '../../../../lib/collections/OverrideOpHelper'

type MappingExtWithOriginalName = MappingExt & { originalLayerName: string }
type MappingsExtWithOriginalName = {
	[layerName: string]: MappingExtWithOriginalName
}
export function buildMappingsToDeviceIdMap(
	routeSets: ObjectWithOverrides<Record<string, StudioRouteSet>>,
	studioMappings: ReadonlyDeep<MappingsExt>
): Map<string, PeripheralDeviceId[]> {
	// Map the expectedPackages onto their specified layer:
	const mappingsWithPackages: MappingsExtWithOriginalName = {}
	for (const [layerName, mapping] of Object.entries<MappingExt>(studioMappings)) {
		mappingsWithPackages[layerName] = {
			...mapping,
			originalLayerName: layerName,
		}
	}

	// Route the mappings
	const routes = getActiveRoutes(getAllCurrentAndDeletedItemsFromOverrides(routeSets, null))
	const routedMappings = getRoutedMappings(mappingsWithPackages, routes)

	// Compile the result
	const result = new Map<string, PeripheralDeviceId[]>()
	for (const item of Object.values<MappingExtWithOriginalName>(routedMappings)) {
		const key = item.originalLayerName
		const existing = result.get(key)
		if (existing) {
			existing.push(item.deviceId)
		} else {
			result.set(key, [item.deviceId])
		}
	}

	return result
}
