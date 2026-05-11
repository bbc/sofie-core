import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { PartInstances, Parts, RundownPlaylists } from '../collections'
import { ContainerIdsToObjectWithOverridesMigrationStep } from './steps/X_X_X/ContainerIdsToObjectWithOverridesMigrationStep'

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
	{
		id: `Rename previousPersistentState to privatePlayoutPersistentState`,
		canBeRunAutomatically: true,
		validate: async () => {
			const playlists = await RundownPlaylists.countDocuments({
				previousPersistentState: { $exists: true },
				privatePlayoutPersistentState: { $exists: false },
			})
			if (playlists > 0) {
				return 'One or more Playlists has previousPersistentState field that needs to be renamed to privatePlayoutPersistentState'
			}

			return false
		},
		migrate: async () => {
			const playlists = await RundownPlaylists.findFetchAsync(
				{
					previousPersistentState: { $exists: true },
					privatePlayoutPersistentState: { $exists: false },
				},
				{
					projection: {
						_id: 1,
						// @ts-expect-error - This field is being renamed, so it won't exist on the type anymore
						previousPersistentState: 1,
					},
				}
			)

			for (const playlist of playlists) {
				// @ts-expect-error - This field is being renamed, so it won't exist on the type anymore
				const previousPersistentState = playlist.previousPersistentState

				await RundownPlaylists.mutableCollection.updateAsync(playlist._id, {
					$set: {
						privatePlayoutPersistentState: previousPersistentState,
					},
					$unset: {
						previousPersistentState: 1,
					},
				})
			}
		},
	},
	new ContainerIdsToObjectWithOverridesMigrationStep(),
	{
		id: 'Add T-timers to RundownPlaylist',
		canBeRunAutomatically: true,
		validate: async () => {
			const playlistCount = await RundownPlaylists.countDocuments({ tTimers: { $exists: false } })
			if (playlistCount > 0) return `There are ${playlistCount} RundownPlaylists without T-timers`
			return false
		},
		migrate: async () => {
			await RundownPlaylists.mutableCollection.updateAsync(
				{ tTimers: { $exists: false } },
				{
					$set: {
						tTimers: [
							{ index: 1, label: '', mode: null, state: null },
							{ index: 2, label: '', mode: null, state: null },
							{ index: 3, label: '', mode: null, state: null },
						],
					},
				},
				{ multi: true }
			)
		},
	},
	{
		id: 'Adjust part expectedDuration',
		canBeRunAutomatically: true,
		validate: async () => {
			const partCount = await Parts.countDocuments({
				durations: { $exists: false },
			})
			if (partCount > 0) return `There are ${partCount} Parts without new durations property`
			return false
		},
		migrate: async () => {
			const parts = await Parts.findFetchAsync(
				{
					durations: { $exists: false },
				},
				{
					projection: {
						_id: 1,
						// @ts-expect-error Old property name
						expectedDuration: 1,
						expectedDurationWithTransition: 1,
					},
				}
			)

			for (const part of parts) {
				// @ts-expect-error Old property name
				const oldDuration = part.expectedDuration
				// @ts-expect-error Old property name
				const oldDurationWithTransition = part.expectedDurationWithTransition

				await Parts.mutableCollection.updateAsync(part._id, {
					$set: {
						durations: {
							expectedDuration: oldDuration,
							transitionOverlap:
								oldDurationWithTransition !== undefined
									? oldDuration - oldDurationWithTransition
									: undefined,
						},
					},
					$unset: {
						expectedDuration: 1,
						expectedDurationWithTransition: 1,
					},
				})
			}
		},
	},
	{
		id: 'Adjust partInstance part expectedDuration',
		canBeRunAutomatically: true,
		validate: async () => {
			const partInstanceCount = await PartInstances.countDocuments({
				'part.durations': { $exists: false },
			})
			if (partInstanceCount > 0)
				return `There are ${partInstanceCount} PartInstances without new part.durations property`
			return false
		},
		migrate: async () => {
			const partInstances = await PartInstances.findFetchAsync(
				{
					'part.durations': { $exists: false },
				},
				{
					projection: {
						_id: 1,
						// @ts-expect-error Old property name
						'part.expectedDuration': 1,
						'part.expectedDurationWithTransition': 1,
					},
				}
			)

			for (const partInstance of partInstances) {
				// @ts-expect-error Old property name
				const oldDuration = partInstance.part.expectedDuration
				// @ts-expect-error Old property name
				const oldDurationWithTransition = partInstance.part.expectedDurationWithTransition

				await PartInstances.mutableCollection.updateAsync(partInstance._id, {
					$set: {
						'part.durations': {
							expectedDuration: oldDuration,
							transitionOverlap:
								oldDurationWithTransition !== undefined
									? oldDuration - oldDurationWithTransition
									: undefined,
						},
					},
					$unset: {
						'part.expectedDuration': 1,
						'part.expectedDurationWithTransition': 1,
					},
				})
			}
		},
	},
	// Add your migration here
])
