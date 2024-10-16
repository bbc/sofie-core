import {
	setupDefaultRundown,
	setupDefaultRundownPlaylist,
	setupMockShowStyleCompound,
} from '../../../../__mocks__/presetCollections'
import { MockJobContext, setupDefaultJobEnvironment } from '../../../../__mocks__/context'
import { ProcessedShowStyleCompound } from '../../../../jobs'
import { ReadonlyDeep } from 'type-fest'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { loadPlayoutModelPreInit } from '../LoadPlayoutModel'
import { runWithPlaylistLock } from '../../../../playout/lock'

describe('LoadPlayoutModel', () => {
	let context: MockJobContext
	let showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>

	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		showStyleCompound = await setupMockShowStyleCompound(context)
	})

	describe('loadPlayoutModelPreInit', () => {
		afterEach(async () =>
			Promise.all([
				context.mockCollections.RundownBaselineAdLibPieces.remove({}),
				context.mockCollections.RundownBaselineAdLibActions.remove({}),
				context.mockCollections.RundownBaselineObjects.remove({}),
				context.mockCollections.AdLibActions.remove({}),
				context.mockCollections.AdLibPieces.remove({}),
				context.mockCollections.Pieces.remove({}),
				context.mockCollections.Parts.remove({}),
				context.mockCollections.Segments.remove({}),
				context.mockCollections.Rundowns.remove({}),
				context.mockCollections.RundownPlaylists.remove({}),
			])
		)

		test('Rundowns are in order specified in RundownPlaylist', async () => {
			// Set up a playlist:
			const { rundownId: rundownId00, playlistId: playlistId0 } = await setupDefaultRundownPlaylist(
				context,
				showStyleCompound,
				protectString('rundown00')
			)
			const rundownId01 = protectString('rundown01')
			await setupDefaultRundown(context, showStyleCompound, playlistId0, rundownId01)
			const rundownId02 = protectString('rundown02')
			await setupDefaultRundown(context, showStyleCompound, playlistId0, rundownId02)

			const playlist0 = await context.mockCollections.RundownPlaylists.findOne(playlistId0)
			expect(playlist0).toBeTruthy()

			if (!playlist0) throw new Error(`Playlist "${playlistId0}" not found!`)

			const rundownIdsInOrder = [rundownId01, rundownId02, rundownId00]

			await context.mockCollections.RundownPlaylists.update(playlistId0, {
				rundownIdsInOrder,
			})

			await runWithPlaylistLock(context, playlistId0, async (lock) => {
				const model = await loadPlayoutModelPreInit(context, lock, playlist0)
				expect(model.rundowns.map((r) => r._id)).toMatchObject([rundownId01, rundownId02, rundownId00])
			})
		})

		test('Rundowns not ordered in RundownPlaylist are at the end', async () => {
			// Set up a playlist:
			const { rundownId: rundownId00, playlistId: playlistId0 } = await setupDefaultRundownPlaylist(
				context,
				showStyleCompound,
				protectString('rundown00')
			)
			const rundownId01 = protectString('rundown01')
			await setupDefaultRundown(context, showStyleCompound, playlistId0, rundownId01)
			const rundownId02 = protectString('rundown02')
			await setupDefaultRundown(context, showStyleCompound, playlistId0, rundownId02)

			const playlist0 = await context.mockCollections.RundownPlaylists.findOne(playlistId0)
			expect(playlist0).toBeTruthy()

			if (!playlist0) throw new Error(`Playlist "${playlistId0}" not found!`)

			const rundownIdsInOrder = [rundownId01]

			await context.mockCollections.RundownPlaylists.update(playlistId0, {
				rundownIdsInOrder,
			})

			await runWithPlaylistLock(context, playlistId0, async (lock) => {
				const model = await loadPlayoutModelPreInit(context, lock, playlist0)
				expect(model.rundowns.map((r) => r._id)).toMatchObject([rundownId01, rundownId00, rundownId02])
			})
		})
	})
})
