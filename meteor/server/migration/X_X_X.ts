import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../collections'
import { convertObjectIntoOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioRouteSet, StudioRouteSetExclusivityGroup } from '@sofie-automation/corelib/dist/dataModel/Studio'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add your migration here

	{
		id: `convert routesets to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				if (studio.routeSets) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				if (!studio.routeSets) continue
				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				const oldRouteSets = studio.routeSets as any as Record<string, StudioRouteSet>

				const newRouteSets = convertObjectIntoOverrides(oldRouteSets)

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetsWithOverrides: newRouteSets,
					},
					$unset: {
						routeSets: 1,
					},
				})
			}
		},
	},
	{
		id: `add abPlayers object`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				const routeSetsDefaults = studio.routeSetsWithOverrides.defaults as any as Record<
					string,
					StudioRouteSet
				>
				for (const key of Object.keys(routeSetsDefaults)) {
					if (!routeSetsDefaults[key].abPlayers) {
						return 'AB players must be added to routeSetsWithOverrides'
					}
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				const newRouteSetswithOverrides = studio.routeSetsWithOverrides
				for (const key of Object.keys(newRouteSetswithOverrides.defaults)) {
					if (!newRouteSetswithOverrides.defaults[key].abPlayers) {
						newRouteSetswithOverrides.defaults[key].abPlayers = []
					}
				}

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetsWithOverrides: newRouteSetswithOverrides,
					},
				})
			}
		},
	},
	{
		id: `convert routeSetExclusivityGroups to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetExclusivityGroups: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error routeSetExclusivityGroups is not typed as ObjectWithOverrides
				if (studio.routeSetExclusivityGroups) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetExclusivityGroups: { $exists: true } })

			for (const studio of studios) {
				//@ts-expect-error routeSetExclusivityGroups is not typed as ObjectWithOverrides
				if (!studio.routeSetExclusivityGroups) return
				//@ts-expect-error routeSetExclusivityGroups is not typed as ObjectWithOverrides
				const oldRouteSetExclusivityGroups = studio.routeSetExclusivityGroups as any as Record<
					string,
					StudioRouteSetExclusivityGroup
				>

				const newRouteSetExclusivityGroups = convertObjectIntoOverrides(oldRouteSetExclusivityGroups)

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetExclusivityGroupsWithOverrides: newRouteSetExclusivityGroups,
					},
					$unset: {
						routeSetExclusivityGroups: 1,
					},
				})
			}
		},
	},
])
