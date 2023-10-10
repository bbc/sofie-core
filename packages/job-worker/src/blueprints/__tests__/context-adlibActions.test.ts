/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as _ from 'underscore'
import {
	IBlueprintPart,
	IBlueprintPiece,
	IBlueprintPieceType,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { ActionExecutionContext, ActionPartChange } from '../context/adlibActions'
import { isTooCloseToAutonext } from '../../playout/lib'
import { PlayoutModel } from '../../playout/model/PlayoutModel'
import { WatchedPackagesHelper } from '../context/watchedPackages'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { runJobWithPlayoutCache } from '../../playout/lock'
import { defaultRundownPlaylist } from '../../__mocks__/defaultCollectionObjects'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { clone, getRandomId, literal, normalizeArrayToMapFunc, omit } from '@sofie-automation/corelib/dist/lib'
import {
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupDefaultRundown, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { JobContext } from '../../jobs'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getCurrentTime } from '../../lib'
import {
	EmptyPieceTimelineObjectsBlob,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PlayoutPartInstanceModel } from '../../playout/model/PlayoutPartInstanceModel'
import { convertPartInstanceToBlueprints, convertPieceInstanceToBlueprints } from '../context/lib'
import { TimelineObjRundown, TimelineObjType } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { PlayoutPartInstanceModelImpl } from '../../playout/model/implementation/PlayoutPartInstanceModelImpl'
import { writePartInstancesAndPieceInstances } from '../../playout/model/implementation/SavePlayoutModel'

import * as PlayoutAdlib from '../../playout/adlibUtils'
type TinnerStopPieces = jest.MockedFunction<typeof PlayoutAdlib.innerStopPieces>
const innerStopPiecesMock = jest.spyOn(PlayoutAdlib, 'innerStopPieces') as TinnerStopPieces

const innerStartQueuedAdLibOrig = PlayoutAdlib.innerStartQueuedAdLib
type TinnerStartQueuedAdLib = jest.MockedFunction<typeof PlayoutAdlib.innerStartQueuedAdLib>
const innerStartQueuedAdLibMock = jest.spyOn(PlayoutAdlib, 'innerStartQueuedAdLib') as TinnerStartQueuedAdLib

jest.mock('../../playout/resolvedPieces')
import { getResolvedPiecesForCurrentPartInstance } from '../../playout/resolvedPieces'
type TgetResolvedPiecesForCurrentPartInstance = jest.MockedFunction<typeof getResolvedPiecesForCurrentPartInstance>
const getResolvedPiecesForCurrentPartInstanceMock =
	getResolvedPiecesForCurrentPartInstance as TgetResolvedPiecesForCurrentPartInstance

jest.mock('../postProcess')
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
const { postProcessPieces: postProcessPiecesOrig, postProcessTimelineObjects: postProcessTimelineObjectsOrig } =
	jest.requireActual('../postProcess')

type TpostProcessPieces = jest.MockedFunction<typeof postProcessPieces>
const postProcessPiecesMock = postProcessPieces as TpostProcessPieces
postProcessPiecesMock.mockImplementation(() => [])

type TpostProcessTimelineObjects = jest.MockedFunction<typeof postProcessTimelineObjects>
const postProcessTimelineObjectsMock = postProcessTimelineObjects as TpostProcessTimelineObjects
postProcessTimelineObjectsMock.mockImplementation(postProcessTimelineObjectsOrig)

// TODO: These should be rewritten to only test as far as the PartInstanceWithPieces interface
describe('Test blueprint api context', () => {
	async function generateSparsePieceInstances(
		context: MockJobContext,
		activationId: RundownPlaylistActivationId,
		rundownId: RundownId
	): Promise<PlayoutPartInstanceModel[]> {
		const parts = await context.mockCollections.Parts.findFetch({ rundownId })
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]

			// make into a partInstance
			await context.mockCollections.PartInstances.insertOne({
				_id: protectString(`${part._id}_instance`),
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				playlistActivationId: activationId,
				segmentPlayoutId: protectString(''),
				takeCount: i,
				rehearsal: false,
				part,
			})

			const pieces = await context.mockCollections.Pieces.findFetch({
				startPartId: part._id,
				startRundownId: rundownId,
			})
			for (const p of pieces) {
				await context.mockCollections.PieceInstances.insertOne({
					_id: protectString(`${part._id}_piece_${p._id}`),
					rundownId: rundownId,
					partInstanceId: protectString(`${part._id}_instance`),
					playlistActivationId: activationId,
					piece: p,
				})
			}

			const count = ((i + 2) % 4) + 1 // Some consistent randomness
			for (let o = 0; o < count; o++) {
				await context.mockCollections.PieceInstances.insertOne({
					_id: protectString(`${part._id}_piece${o}`),
					rundownId: rundownId,
					partInstanceId: protectString(`${part._id}_instance`),
					playlistActivationId: activationId,
					piece: {
						_id: protectString(`${part._id}_piece_inner${o}`),
						externalId: '-',
						enable: { start: 0 },
						name: 'mock',
						sourceLayerId: '',
						outputLayerId: '',
						startPartId: part._id,
						content: {
							index: o,
						} as any,
						timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						lifespan: PieceLifespan.WithinPart,
						pieceType: IBlueprintPieceType.Normal,
						invalid: false,
					},
				})
			}
		}

		const partInstances = await context.mockCollections.PartInstances.findFetch({ rundownId })
		return Promise.all(
			partInstances.map(async (partInstance) => {
				// This isn't performant, but that shouldn't matter here
				const pieceInstances = await context.mockCollections.PieceInstances.findFetch({
					partInstanceId: partInstance._id,
				})
				return new PlayoutPartInstanceModelImpl(partInstance, pieceInstances, false)
			})
		)
	}

	// let context: MockJobContext
	// beforeAll(async () => {
	// 	context = await setupDefaultJobEnvironment()
	// })

	async function getActionExecutionContext(jobContext: JobContext, cache: PlayoutModel) {
		const playlist = cache.Playlist
		expect(playlist).toBeTruthy()
		const rundown = cache.Rundowns[0]
		expect(rundown).toBeTruthy()

		const activationId = playlist.activationId as RundownPlaylistActivationId
		expect(activationId).toBeTruthy()

		const showStyle = await jobContext.getShowStyleCompound(
			rundown.Rundown.showStyleVariantId,
			rundown.Rundown.showStyleBaseId
		)
		const showStyleConfig = jobContext.getShowStyleBlueprintConfig(showStyle)

		const watchedPackages = WatchedPackagesHelper.empty(jobContext) // Not needed by the tests for now

		const context = new ActionExecutionContext(
			{
				name: 'fakeContext',
				identifier: 'action',
			},
			jobContext,
			cache,
			showStyle,
			showStyleConfig,
			rundown,
			watchedPackages
		)
		expect(context.studio).toBe(jobContext.studio)

		return {
			playlist,
			rundown,
			context,
			activationId,
		}
	}

	async function wrapWithCache<T>(
		context: JobContext,
		playlistId: RundownPlaylistId,
		fcn: (cache: PlayoutModel) => Promise<T>
	): Promise<T> {
		return runJobWithPlayoutCache(context, { playlistId }, null, fcn)
	}

	async function setupMyDefaultRundown(): Promise<{
		jobContext: MockJobContext
		playlistId: RundownPlaylistId
		rundownId: RundownId
		allPartInstances: PlayoutPartInstanceModel[]
	}> {
		const context = setupDefaultJobEnvironment()

		const playlistId: RundownPlaylistId = protectString('playlist0')
		const activationId: RundownPlaylistActivationId = getRandomId()

		await context.mockCollections.RundownPlaylists.insertOne({
			...defaultRundownPlaylist(playlistId, context.studioId),
			// Mark playlist as active
			activationId: activationId,
		})

		const showStyleCompound = await setupMockShowStyleCompound(context)
		expect(showStyleCompound).toBeTruthy()

		const rundownId: RundownId = getRandomId()

		await setupDefaultRundown(context, showStyleCompound, playlistId, rundownId)

		const allPartInstances = await generateSparsePieceInstances(context, activationId, rundownId)
		expect(allPartInstances).toHaveLength(5)

		return {
			jobContext: context,
			playlistId: playlistId,
			rundownId: rundownId,
			allPartInstances,
		}
	}

	async function saveAllToDatabase(
		context: JobContext,
		cache: PlayoutModel,
		allPartInstances: PlayoutPartInstanceModel[]
	) {
		// We need to push changes back to 'mongo' for these tests
		await Promise.all(
			writePartInstancesAndPieceInstances(
				context,
				normalizeArrayToMapFunc(allPartInstances as PlayoutPartInstanceModelImpl[], (p) => p.PartInstance._id)
			)
		)
		await cache.saveAllToDatabase()
	}

	async function setPartInstances(
		jobContext: MockJobContext,
		playlistId: RundownPlaylistId,
		currentPartInstance: PlayoutPartInstanceModel | DBPartInstance | PieceInstance | undefined | null,
		nextPartInstance: PlayoutPartInstanceModel | DBPartInstance | PieceInstance | undefined | null,
		previousPartInstance?: PlayoutPartInstanceModel | DBPartInstance | PieceInstance | null
	) {
		const convertInfo = (info: PlayoutPartInstanceModel | DBPartInstance | PieceInstance | null) => {
			if (!info) {
				return null
			} else if ('partInstanceId' in info) {
				return {
					partInstanceId: info.partInstanceId,
					rundownId: info.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				}
			} else if ('PartInstance' in info) {
				return {
					partInstanceId: info.PartInstance._id,
					rundownId: info.PartInstance.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				}
			} else {
				return {
					partInstanceId: info._id,
					rundownId: info.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				}
			}
		}

		if (currentPartInstance !== undefined) {
			await jobContext.mockCollections.RundownPlaylists.update(playlistId, {
				$set: {
					currentPartInfo: convertInfo(currentPartInstance),
				},
			})
		}

		if (nextPartInstance !== undefined) {
			await jobContext.mockCollections.RundownPlaylists.update(playlistId, {
				$set: {
					nextPartInfo: convertInfo(nextPartInstance),
				},
			})
		}

		if (previousPartInstance !== undefined) {
			await jobContext.mockCollections.RundownPlaylists.update(playlistId, {
				$set: {
					previousPartInfo: convertInfo(previousPartInstance),
				},
			})
		}
	}

	describe('ActionExecutionContext', () => {
		describe('getPartInstance', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getPartInstance()).rejects.toThrow('Unknown part "undefined"')
					// @ts-ignore
					await expect(context.getPartInstance('abc')).rejects.toThrow('Unknown part "abc"')
					// @ts-ignore
					await expect(context.getPartInstance(6)).rejects.toThrow('Unknown part "6"')
					// @ts-ignore
					await expect(context.getPartInstance('previous')).rejects.toThrow('Unknown part "previous"')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(0)

					await expect(context.getPartInstance('next')).resolves.toBeUndefined()
					await expect(context.getPartInstance('current')).resolves.toBeUndefined()
				})

				await setPartInstances(jobContext, playlistId, allPartInstances[1], undefined)
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(2)

					// Check the current part
					await expect(context.getPartInstance('next')).resolves.toBeUndefined()
					await expect(context.getPartInstance('current')).resolves.toMatchObject({
						_id: allPartInstances[1].PartInstance._id,
					})
				})

				await setPartInstances(jobContext, playlistId, null, allPartInstances[2])
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(3)

					// Now the next part
					await expect(context.getPartInstance('next')).resolves.toMatchObject({
						_id: allPartInstances[2].PartInstance._id,
					})
					await expect(context.getPartInstance('current')).resolves.toBeUndefined()
				})
			})
		})
		describe('getPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getPieceInstances()).rejects.toThrow('Unknown part "undefined"')
					// @ts-ignore
					await expect(context.getPieceInstances('abc')).rejects.toThrow('Unknown part "abc"')
					// @ts-ignore
					await expect(context.getPieceInstances(6)).rejects.toThrow('Unknown part "6"')
					// @ts-ignore
					await expect(context.getPieceInstances('previous')).rejects.toThrow('Unknown part "previous"')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(0)

					await expect(context.getPieceInstances('next')).resolves.toHaveLength(0)
					await expect(context.getPieceInstances('current')).resolves.toHaveLength(0)
				})

				await setPartInstances(jobContext, playlistId, allPartInstances[1], undefined)
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(2)

					// Check the current part
					await expect(context.getPieceInstances('next')).resolves.toHaveLength(0)
					await expect(context.getPieceInstances('current')).resolves.toHaveLength(5)
				})

				await setPartInstances(jobContext, playlistId, null, allPartInstances[2])
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(3)

					// Now the next part
					await expect(context.getPieceInstances('next')).resolves.toHaveLength(1)
					await expect(context.getPieceInstances('current')).resolves.toHaveLength(0)
				})
			})
		})
		describe('getResolvedPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getResolvedPieceInstances()).rejects.toThrow('Unknown part "undefined"')
					// @ts-ignore
					await expect(context.getResolvedPieceInstances('abc')).rejects.toThrow('Unknown part "abc"')
					// @ts-ignore
					await expect(context.getResolvedPieceInstances(6)).rejects.toThrow('Unknown part "6"')
					// @ts-ignore
					await expect(context.getResolvedPieceInstances('previous')).rejects.toThrow(
						'Unknown part "previous"'
					)
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(0)

					expect(getResolvedPiecesForCurrentPartInstanceMock).toHaveBeenCalledTimes(0)

					await expect(context.getResolvedPieceInstances('next')).resolves.toHaveLength(0)
					await expect(context.getResolvedPieceInstances('current')).resolves.toHaveLength(0)
					expect(getResolvedPiecesForCurrentPartInstanceMock).toHaveBeenCalledTimes(0)
				})

				let mockCalledIds: PartInstanceId[] = []
				getResolvedPiecesForCurrentPartInstanceMock.mockImplementation(
					(
						context2: JobContext,
						sourceLayers: SourceLayers,
						partInstance: PlayoutPartInstanceModel,
						now?: number
					) => {
						expect(context2).toBe(jobContext)
						expect(sourceLayers).toBeTruthy()
						expect(now).toBeFalsy()
						mockCalledIds.push(partInstance.PartInstance._id)
						return [
							{
								instance: {
									_id: 'abc',
									piece: {
										timelineObjectsString: EmptyPieceTimelineObjectsBlob,
									},
								} as any as PieceInstance,
								resolvedStart: 0,
								timelinePriority: 0,
							},
						]
					}
				)

				await setPartInstances(jobContext, playlistId, allPartInstances[1], undefined)
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(2)
					// Check the current part
					await expect(context.getResolvedPieceInstances('next')).resolves.toHaveLength(0)
					await expect(
						context.getResolvedPieceInstances('current').then((res) => res.map((p) => p._id))
					).resolves.toEqual(['abc'])
					expect(getResolvedPiecesForCurrentPartInstanceMock).toHaveBeenCalledTimes(1)
					expect(mockCalledIds).toEqual([allPartInstances[1].PartInstance._id])
				})

				mockCalledIds = []
				getResolvedPiecesForCurrentPartInstanceMock.mockClear()

				await setPartInstances(jobContext, playlistId, null, allPartInstances[2])
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(3)

					// Now the next part
					await expect(
						context.getResolvedPieceInstances('next').then((res) => res.map((p) => p._id))
					).resolves.toEqual(['abc'])
					await expect(context.getResolvedPieceInstances('current')).resolves.toHaveLength(0)
					expect(getResolvedPiecesForCurrentPartInstanceMock).toHaveBeenCalledTimes(1)
					expect(mockCalledIds).toEqual([allPartInstances[2].PartInstance._id])
				})
			})
		})
		describe('findLastPieceOnLayer', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					// @ts-ignore
					await expect(context.findLastPieceOnLayer()).resolves.toBeUndefined()
					// @ts-ignore
					await expect(context.findLastPieceOnLayer(9867, 'hi')).resolves.toBeUndefined()
				})
			})

			test('basic and original only', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					allPartInstances[0].setTaken(getCurrentTime(), 0)

					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, cache, allPartInstances)

					// const allPartInstances = cache.SortedLoadedPartInstances
					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = Object.keys(context.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toBeUndefined()
					await expect(context.findLastPieceOnLayer(sourceLayerIds[1])).resolves.toBeUndefined()

					// Insert a piece that is played
					const insertedPieceInstance = allPartInstances[0].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					allPartInstances[0].setPieceInstancedPlannedStartedPlayback(insertedPieceInstance._id, 1000)
					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, cache, allPartInstances)

					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: insertedPieceInstance._id,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { originalOnly: true })
					).resolves.toBeUndefined()

					// Insert another more recent piece that is played
					const insertedPieceInstance2 = allPartInstances[0].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					allPartInstances[0].setPieceInstancedPlannedStartedPlayback(insertedPieceInstance2._id, 2000)

					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, cache, allPartInstances)

					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: insertedPieceInstance2._id,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { originalOnly: true })
					).resolves.toBeUndefined()
				})
			})

			test('excludeCurrentPart', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, allPartInstances[2], undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					allPartInstances[0].setTaken(getCurrentTime(), 0)

					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, cache, allPartInstances)

					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = Object.keys(context.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toBeUndefined()
					await expect(context.findLastPieceOnLayer(sourceLayerIds[1])).resolves.toBeUndefined()

					// Insert a couple of pieces that are played
					const insertedPieceInstance = allPartInstances[0].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					allPartInstances[0].setPieceInstancedPlannedStartedPlayback(insertedPieceInstance._id, 1000)
					const insertedPieceInstance2 = allPartInstances[2].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					allPartInstances[2].setPieceInstancedPlannedStartedPlayback(insertedPieceInstance2._id, 2000)
					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, cache, allPartInstances)

					// Check it
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: insertedPieceInstance2._id,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { excludeCurrentPart: true })
					).resolves.toMatchObject({
						_id: insertedPieceInstance._id,
					})
				})
			})

			test('pieceMetaDataFilter', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, allPartInstances[2], undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					allPartInstances[0].setTaken(getCurrentTime(), 0)

					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, cache, allPartInstances)

					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = Object.keys(context.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toBeUndefined()
					await expect(context.findLastPieceOnLayer(sourceLayerIds[1])).resolves.toBeUndefined()

					// Insert a couple of pieces that are played
					const insertedPieceInstance = allPartInstances[0].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					allPartInstances[0].setPieceInstancedPlannedStartedPlayback(insertedPieceInstance._id, 1000)
					const insertedPieceInstance2 = allPartInstances[2].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							metaData: {
								prop1: 'hello',
								prop2: '5',
							},
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					allPartInstances[2].setPieceInstancedPlannedStartedPlayback(insertedPieceInstance2._id, 2000)
					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, cache, allPartInstances)

					// Check it
					await expect(context.findLastPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: insertedPieceInstance2._id,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { pieceMetaDataFilter: {} })
					).resolves.toMatchObject({
						_id: insertedPieceInstance2._id,
					})
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], { pieceMetaDataFilter: { prop1: 'hello' } })
					).resolves.toMatchObject({ _id: insertedPieceInstance2._id })
					await expect(
						context.findLastPieceOnLayer(sourceLayerIds[0], {
							pieceMetaDataFilter: { prop1: { $ne: 'hello' } },
						})
					).resolves.toMatchObject({ _id: insertedPieceInstance._id })
				})
			})
		})

		describe('findLastScriptedPieceOnLayer', () => {
			test('No Current Part', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// We need to push changes back to 'mongo' for these tests
					await cache.saveAllToDatabase()

					const sourceLayerIds = Object.keys(context.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[0])).resolves.toBeUndefined()
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[1])).resolves.toBeUndefined()
				})
			})

			test('First Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.mockCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.mockCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				const pieceInstances = await jobContext.mockCollections.PieceInstances.findFetch({
					partInstanceId: { $in: partInstances.map((p) => p._id) },
				})
				expect(pieceInstances).toHaveLength(10)

				// Set Part 1 as current part
				await setPartInstances(jobContext, playlistId, partInstances[0], undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const sourceLayerIds = Object.keys(context.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					const expectedPieceInstanceSourceLayer0 = pieceInstances.find(
						(p) =>
							p.partInstanceId === cache.Playlist.currentPartInfo?.partInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[0]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer0 = await jobContext.mockCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer0?.piece._id,
					})
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: expectedPieceSourceLayer0?._id,
					})

					const expectedPieceInstanceSourceLayer1 = pieceInstances.find(
						(p) =>
							p.partInstanceId === cache.Playlist.currentPartInfo?.partInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[1]
					)
					expect(expectedPieceInstanceSourceLayer1).not.toBeUndefined()

					const expectedPieceSourceLayer1 = await jobContext.mockCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer1?.piece._id,
					})
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[1])).resolves.toMatchObject({
						_id: expectedPieceSourceLayer1?._id,
					})
				})
			})

			test('First Part, Ignore Current Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.mockCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.mockCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				// Set Part 1 as current part
				await setPartInstances(jobContext, playlistId, partInstances[0], undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const sourceLayerIds = Object.keys(context.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					await expect(
						context.findLastScriptedPieceOnLayer(sourceLayerIds[0], { excludeCurrentPart: true })
					).resolves.toBeUndefined()
				})
			})

			test('Second Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.mockCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.mockCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				const pieceInstances = await jobContext.mockCollections.PieceInstances.findFetch({
					partInstanceId: { $in: partInstances.map((p) => p._id) },
				})
				expect(pieceInstances).toHaveLength(10)

				// Set Part 2 as current part
				await setPartInstances(jobContext, playlistId, partInstances[1], undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const sourceLayerIds = Object.keys(context.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					const expectedPieceInstanceSourceLayer0 = pieceInstances.find(
						(p) =>
							p.partInstanceId === cache.Playlist.currentPartInfo?.partInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[0]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer0 = await jobContext.mockCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer0?.piece._id,
					})
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[0])).resolves.toMatchObject({
						_id: expectedPieceSourceLayer0?._id,
					})

					// Part 2 does not have any pieces on this sourcelayer, so we should find the piece from part 1
					const expectedPieceInstanceSourceLayer1 = pieceInstances.find(
						(p) => p.partInstanceId === partInstances[0]._id && p.piece.sourceLayerId === sourceLayerIds[1]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer1 = await jobContext.mockCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer1?.piece._id,
					})
					await expect(context.findLastScriptedPieceOnLayer(sourceLayerIds[1])).resolves.toMatchObject({
						_id: expectedPieceSourceLayer1?._id,
					})
				})
			})
		})

		describe('getPartInstanceForPreviousPiece', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getPartInstanceForPreviousPiece()).rejects.toThrow(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					// @ts-ignore
					await expect(context.getPartInstanceForPreviousPiece({})).rejects.toThrow(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					// @ts-ignore
					await expect(context.getPartInstanceForPreviousPiece('abc')).rejects.toThrow(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					await expect(
						context.getPartInstanceForPreviousPiece({
							// @ts-ignore
							partInstanceId: 6,
						})
					).rejects.toThrow('Cannot find PartInstance for PieceInstance')
					await expect(
						// @ts-ignore
						context.getPartInstanceForPreviousPiece({
							partInstanceId: 'abc',
						})
					).rejects.toThrow('Cannot find PartInstance for PieceInstance')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				// Try with nothing in the cache
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(0)

					await expect(
						context.getPartInstanceForPreviousPiece({
							partInstanceId: allPartInstances[1].PartInstance._id,
						} as any)
					).resolves.toMatchObject({
						_id: allPartInstances[1].PartInstance._id,
					})

					await expect(
						context.getPartInstanceForPreviousPiece({
							partInstanceId: allPartInstances[4].PartInstance._id,
						} as any)
					).resolves.toMatchObject({
						_id: allPartInstances[4].PartInstance._id,
					})
				})

				// Again with stuff in the cache
				await setPartInstances(jobContext, playlistId, allPartInstances[1], undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(2)

					await expect(
						context.getPartInstanceForPreviousPiece({
							partInstanceId: allPartInstances[1].PartInstance._id,
						} as any)
					).resolves.toMatchObject({
						_id: allPartInstances[1].PartInstance._id,
					})

					await expect(
						context.getPartInstanceForPreviousPiece({
							partInstanceId: allPartInstances[4].PartInstance._id,
						} as any)
					).resolves.toMatchObject({
						_id: allPartInstances[4].PartInstance._id,
					})
				})
			})
		})

		describe('getPartForPreviousPiece', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// @ts-ignore
					await expect(context.getPartForPreviousPiece()).rejects.toThrow(
						'Cannot find Part from invalid Piece'
					)
					// @ts-ignore
					await expect(context.getPartForPreviousPiece({})).rejects.toThrow(
						'Cannot find Part from invalid Piece'
					)
					// @ts-ignore
					await expect(context.getPartForPreviousPiece('abc')).rejects.toThrow(
						'Cannot find Part from invalid Piece'
					)
					await expect(
						context.getPartForPreviousPiece({
							// @ts-ignore
							partInstanceId: 6,
						})
					).rejects.toThrow('Cannot find Part from invalid Piece')
					await expect(
						// @ts-ignore
						context.getPartForPreviousPiece({
							_id: 'abc',
						})
					).rejects.toThrow('Cannot find Piece abc')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				// Try with nothing in the cache
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					expect(cache.LoadedPartInstances).toHaveLength(0)

					const pieceInstance0 = (await jobContext.mockCollections.PieceInstances.findOne({
						partInstanceId: allPartInstances[0].PartInstance._id,
					})) as PieceInstance
					expect(pieceInstance0).not.toBeUndefined()

					await expect(
						context.getPartForPreviousPiece({ _id: unprotectString(pieceInstance0.piece._id) })
					).resolves.toMatchObject({
						_id: allPartInstances[0].PartInstance.part._id,
					})

					const pieceInstance1 = (await jobContext.mockCollections.PieceInstances.findOne({
						partInstanceId: allPartInstances[1].PartInstance._id,
					})) as PieceInstance
					expect(pieceInstance1).not.toBeUndefined()

					await expect(
						context.getPartForPreviousPiece({ _id: unprotectString(pieceInstance1.piece._id) })
					).resolves.toMatchObject({
						_id: allPartInstances[1].PartInstance.part._id,
					})
				})
			})
		})

		describe('insertPiece', () => {
			beforeEach(() => {
				postProcessPiecesMock.mockClear()
			})

			test('bad parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, allPartInstances[0], undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const currentPartInstance = cache.CurrentPartInstance!
					expect(currentPartInstance).toBeTruthy()
					currentPartInstance.setTaken(getCurrentTime(), 0)

					const insertSpy = jest.spyOn(currentPartInstance, 'insertAdlibbedPiece')

					// @ts-ignore
					await expect(context.insertPiece()).rejects.toThrow('Unknown part "undefined"')
					// @ts-ignore
					await expect(context.insertPiece('previous')).rejects.toThrow('Unknown part "previous"')
					// @ts-ignore
					await expect(context.insertPiece('next')).rejects.toThrow('Cannot insert piece when no active part')

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(insertSpy).toHaveBeenCalledTimes(0)

					postProcessPiecesMock.mockImplementationOnce(() => {
						throw new Error('Mock process error')
					})
					await expect(context.insertPiece('current', {} as any)).rejects.toThrow('Mock process error')
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(insertSpy).toHaveBeenCalledTimes(0)
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const partInstance = allPartInstances[0]

				await setPartInstances(jobContext, playlistId, partInstance, undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					postProcessPiecesMock.mockImplementationOnce(() => [
						{
							_id: 'fake4', // Should be ignored
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						} as any,
					])

					const currentPartInstance = cache.CurrentPartInstance!
					expect(currentPartInstance).toBeTruthy()
					currentPartInstance.setTaken(getCurrentTime(), 0)

					const insertSpy = jest.spyOn(currentPartInstance, 'insertAdlibbedPiece')

					const newPieceInstanceId = (await context.insertPiece('current', { externalId: 'input1' } as any))
						._id
					expect(newPieceInstanceId).toMatch(/randomId([0-9]+)_part0_0_instance_randomId([0-9]+)/)
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(postProcessPiecesMock).toHaveBeenCalledWith(
						expect.anything(),
						[{ externalId: 'input1' }],
						'blueprint0',
						partInstance.PartInstance.rundownId,
						partInstance.PartInstance.segmentId,
						partInstance.PartInstance.part._id,
						true
					)
					expect(insertSpy).toHaveBeenCalledTimes(1)

					// check some properties not exposed to the blueprints
					const newPieceInstance = cache.findPieceInstance(protectString(newPieceInstanceId))
						?.pieceInstance as PieceInstance
					expect(newPieceInstance).toBeTruthy()
					expect(newPieceInstance.dynamicallyInserted).toBeTruthy()
					expect(newPieceInstance.partInstanceId).toEqual(partInstance.PartInstance._id)
				})
			})
		})

		describe('updatePieceInstance', () => {
			test('bad parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const pieceInstance = (await jobContext.mockCollections.PieceInstances.findOne({
					partInstanceId: allPartInstances[0].PartInstance._id,
				})) as PieceInstance
				expect(pieceInstance).toBeTruthy()
				const pieceInstanceOther = (await jobContext.mockCollections.PieceInstances.findOne({
					partInstanceId: allPartInstances[1].PartInstance._id,
				})) as PieceInstance
				expect(pieceInstanceOther).toBeTruthy()

				await setPartInstances(jobContext, playlistId, undefined, undefined, allPartInstances[0])

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					await expect(context.updatePieceInstance('abc', {})).rejects.toThrow(
						'Some valid properties must be defined'
					)
					await expect(context.updatePieceInstance('abc', { _id: 'bad', nope: 'ok' } as any)).rejects.toThrow(
						'Some valid properties must be defined'
					)
					await expect(context.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrow(
						'PieceInstance could not be found'
					)
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).rejects.toThrow('Can only update piece instances in current or next part instance')
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrow('PieceInstance could not be found')
				})

				// Set a current part instance
				await setPartInstances(jobContext, playlistId, pieceInstance, undefined, pieceInstanceOther)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)
					await expect(context.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrow(
						'PieceInstance could not be found'
					)
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).resolves.toBeTruthy()
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrow('Can only update piece instances in current or next part instance')
				})

				// Set as next part instance
				await setPartInstances(jobContext, playlistId, null, pieceInstance, pieceInstanceOther)
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)
					await expect(context.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrow(
						'PieceInstance could not be found'
					)
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).resolves.toBeTruthy()
					await expect(
						context.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrow('Can only update piece instances in current or next part instance')
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				// Find a piece to modify
				const pieceInstance0 = (await jobContext.mockCollections.PieceInstances.findOne({
					rundownId,
				})) as PieceInstance
				expect(pieceInstance0).toBeTruthy()
				await setPartInstances(jobContext, playlistId, pieceInstance0, undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// Ensure there are no pending updates already
					for (const partInstance of cache.LoadedPartInstances) {
						expect((partInstance as PlayoutPartInstanceModelImpl).HasAnyChanges()).toBeFalsy()
					}

					// Update it and expect it to match
					const pieceInstance0Before = clone(pieceInstance0)
					const pieceInstance0Delta: any = {
						_id: 'sdf', // This will be dropped
						sourceLayerId: 'new',
						enable: { start: 99, end: 123 },
						badProperty: 9, // This will be dropped
						content: {
							timelineObjects: [
								literal<TimelineObjRundown>({
									id: 'a',
									enable: { start: 0 },
									content: {} as any,
									layer: 1,
									objectType: TimelineObjType.RUNDOWN,
									priority: 0,
								}),
							],
						},
					}
					const resultPiece = await context.updatePieceInstance(
						unprotectString(pieceInstance0._id),
						pieceInstance0Delta
					)
					const { pieceInstance: pieceInstance1, partInstance: partInstance1 } = cache.findPieceInstance(
						pieceInstance0._id
					)!
					expect(pieceInstance1).toBeTruthy()

					expect(resultPiece).toEqual(convertPieceInstanceToBlueprints(pieceInstance1))
					const pieceInstance0After = {
						...pieceInstance0Before,
						piece: {
							...pieceInstance0Before.piece,
							...omit(pieceInstance0Delta, 'badProperty', '_id'),
							content: {
								...omit(pieceInstance0Delta.content, 'timelineObjects'),
							},
							timelineObjectsString: serializePieceTimelineObjectsBlob(
								pieceInstance0Delta.content.timelineObjects
							),
						},
					}
					expect(pieceInstance1).toEqual(pieceInstance0After)
					expect((partInstance1 as PlayoutPartInstanceModelImpl).PartInstanceHasChanges).toBeFalsy()
					expect((partInstance1 as PlayoutPartInstanceModelImpl).ChangedPieceInstanceIds()).toEqual([
						pieceInstance1._id,
					])

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})

		describe('queuePart', () => {
			beforeEach(() => {
				postProcessPiecesMock.mockClear()
				innerStartQueuedAdLibMock.mockClear()
			})

			test('bad parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// No next-part
					// @ts-ignore
					await expect(context.queuePart()).rejects.toThrow('Cannot queue part when no current partInstance')
				})

				const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, partInstance, undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// Next part has already been modified
					context.nextPartState = ActionPartChange.SAFE_CHANGE
					// @ts-ignore
					await expect(context.queuePart('previous')).rejects.toThrow(
						'Cannot queue part when next part has already been modified'
					)
					context.nextPartState = ActionPartChange.NONE

					await expect(context.queuePart({} as any, [])).rejects.toThrow(
						'New part must contain at least one piece'
					)

					// expect(
					// 	context.queuePart(
					// 		// @ts-ignore
					// 		{
					// 			floated: true,
					// 		},
					// 		[{}]
					// 	).part.floated
					// ).toBeFalsy()
					// expect(
					// 	context.queuePart(
					// 		// @ts-ignore
					// 		{
					// 			invalid: true,
					// 		},
					// 		[{}]
					// 	).part.invalid
					// ).toBeFalsy()

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(innerStartQueuedAdLibMock).toHaveBeenCalledTimes(0)

					postProcessPiecesMock.mockImplementationOnce(() => {
						throw new Error('Mock process error')
					})
					await expect(context.queuePart({} as any, [{}] as any)).rejects.toThrow('Mock process error')
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(innerStartQueuedAdLibMock).toHaveBeenCalledTimes(0)

					partInstance.part.autoNext = true
					partInstance.part.expectedDuration = 700
					partInstance.timings = {
						plannedStartedPlayback: getCurrentTime(),
						plannedStoppedPlayback: undefined,
						playOffset: 0,
						take: undefined,
					}
					cache.replacePartInstance(new PlayoutPartInstanceModelImpl(partInstance, [], true))

					expect(isTooCloseToAutonext(partInstance, true)).toBeTruthy()
					await expect(context.queuePart({} as any, [{}] as any)).rejects.toThrow(
						'Too close to an autonext to queue a part'
					)

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, partInstance, undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const newPiece: IBlueprintPiece = {
						name: 'test piece',
						sourceLayerId: 'sl1',
						outputLayerId: 'o1',
						externalId: '-',
						enable: { start: 0 },
						lifespan: PieceLifespan.OutOnRundownEnd,
						content: {
							timelineObjects: [],
						},
					}
					const newPart: IBlueprintPart = {
						externalId: 'nope',
						title: 'something',
					}

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(innerStartQueuedAdLibMock).toHaveBeenCalledTimes(0)

					// Create it with most of the real flow
					postProcessPiecesMock.mockImplementationOnce(postProcessPiecesOrig)
					innerStartQueuedAdLibMock.mockImplementationOnce(innerStartQueuedAdLibOrig)
					expect((await context.queuePart(newPart, [newPiece]))._id).toEqual(
						cache.Playlist.nextPartInfo?.partInstanceId
					)

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(innerStartQueuedAdLibMock).toHaveBeenCalledTimes(1)

					// Verify some properties not exposed to the blueprints
					const newPartInstance = cache.getPartInstance(cache.Playlist.nextPartInfo!.partInstanceId)!
					expect(newPartInstance).toBeTruthy()
					expect(newPartInstance.PartInstance.part._rank).toBeLessThan(9000)
					expect(newPartInstance.PartInstance.part._rank).toBeGreaterThan(partInstance.part._rank)
					expect(newPartInstance.PartInstance.orphaned).toEqual('adlib-part')

					const newNextPartInstances = await context.getPieceInstances('next')
					expect(newNextPartInstances).toHaveLength(1)
					expect(newNextPartInstances[0].partInstanceId).toEqual(
						unprotectString(newPartInstance.PartInstance._id)
					)

					expect(context.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
		})

		describe('stopPiecesOnLayers', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, null, undefined)
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					innerStopPiecesMock.mockClear()
					await expect(context.stopPiecesOnLayers(['lay1'], 34)).resolves.toEqual([])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(0)

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
			test('valid parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const currentPartInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, currentPartInstance, undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					innerStopPiecesMock.mockClear()
					let filter: (piece: PieceInstance) => boolean = null as any
					innerStopPiecesMock.mockImplementationOnce(
						(context2, cache2, showStyleBase, partInstance, filter2, offset) => {
							expect(context2).toBe(jobContext)
							expect(cache2).toBe(cache)
							expect(showStyleBase).toBeTruthy()
							expect(partInstance.PartInstance).toStrictEqual(currentPartInstance)
							expect(offset).toEqual(34)
							filter = filter2

							return [protectString('result1')]
						}
					)

					// Ensure it behaves as expected
					await expect(context.stopPiecesOnLayers(['lay1'], 34)).resolves.toEqual(['result1'])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(1)
					expect(filter).toBeTruthy()

					// Now verify the filter works as intended
					expect(filter({ piece: { sourceLayerId: 'lay1' } } as any)).toBeTruthy()
					expect(filter({ piece: {} } as any)).toBeFalsy()
					expect(filter({ piece: { sourceLayerId: 'lay2' } } as any)).toBeFalsy()

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})

		describe('stopPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, null, undefined)
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					innerStopPiecesMock.mockClear()
					await expect(context.stopPieceInstances(['lay1'], 34)).resolves.toEqual([])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(0)

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
			test('valid parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const currentPartInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, currentPartInstance, undefined)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					innerStopPiecesMock.mockClear()
					let filter: (piece: PieceInstance) => boolean = null as any
					innerStopPiecesMock.mockImplementationOnce(
						(context2, cache2, showStyleBase, partInstance, filter2, offset) => {
							expect(context2).toBe(jobContext)
							expect(cache2).toBe(cache)
							expect(showStyleBase).toBeTruthy()
							expect(partInstance.PartInstance).toStrictEqual(currentPartInstance)
							expect(offset).toEqual(34)
							filter = filter2

							return [protectString('result1')]
						}
					)

					// Ensure it behaves as expected
					await expect(context.stopPieceInstances(['lay1'], 34)).resolves.toEqual(['result1'])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(1)
					expect(filter).toBeTruthy()

					// Now verify the filter works as intended
					expect(filter({ _id: 'lay1' } as any)).toBeTruthy()
					expect(filter({} as any)).toBeFalsy()
					expect(filter({ id: 'lay2' } as any)).toBeFalsy()

					expect(context.nextPartState).toEqual(ActionPartChange.NONE)
					expect(context.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})
		describe('removePieceInstances', () => {
			interface PieceInstanceCounts {
				other: number
				previous: number
				current: number
				next: number
			}
			function getPieceInstanceCounts(cache: PlayoutModel): PieceInstanceCounts {
				let other = 0
				for (const partInstance of cache.OlderPartInstances) {
					other += partInstance.PieceInstances.length
				}

				return {
					other,
					previous: cache.PreviousPartInstance?.PieceInstances?.length ?? 0,
					current: cache.CurrentPartInstance?.PieceInstances?.length ?? 0,
					next: cache.NextPartInstance?.PieceInstances?.length ?? 0,
				}
			}

			function expectCountsToEqual(counts: PieceInstanceCounts, old: PieceInstanceCounts): void {
				expect(counts.previous).toEqual(old.previous)
				expect(counts.current).toEqual(old.current)
				expect(counts.next).toEqual(old.next)
				expect(counts.other).toEqual(old.other)
			}

			test('invalid parameters', async () => {
				const { jobContext, playlistId, rundownId, allPartInstances } = await setupMyDefaultRundown()

				// No instance id
				await setPartInstances(jobContext, playlistId, undefined, null)
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// No instance id
					await expect(context.removePieceInstances('next', ['lay1'])).rejects.toThrow(
						'Cannot remove pieceInstances when no selected partInstance'
					)
				})

				// Ensure missing/bad ids dont delete anything
				const partInstance = allPartInstances[0]
				await setPartInstances(jobContext, playlistId, undefined, partInstance)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)
					const beforePieceInstancesCounts = getPieceInstanceCounts(cache)
					expect(beforePieceInstancesCounts.previous).toEqual(0)
					expect(beforePieceInstancesCounts.current).toEqual(0)
					expect(beforePieceInstancesCounts.next).not.toEqual(0)
					expect(beforePieceInstancesCounts.other).toEqual(0)

					const pieceInstanceFromOther = (await jobContext.mockCollections.PieceInstances.findOne({
						rundownId,
						partInstanceId: { $ne: partInstance.PartInstance._id },
					})) as PieceInstance
					expect(pieceInstanceFromOther).toBeTruthy()

					await expect(context.removePieceInstances('next', [])).resolves.toEqual([])
					await expect(
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						context.removePieceInstances('next', [unprotectString(pieceInstanceFromOther._id)])
					).resolves.toEqual([]) // Try and remove something belonging to a different part
					expectCountsToEqual(getPieceInstanceCounts(cache), beforePieceInstancesCounts)
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const partInstance = allPartInstances[0]
				await setPartInstances(jobContext, playlistId, undefined, partInstance)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					const beforePieceInstancesCounts = getPieceInstanceCounts(cache)
					expect(beforePieceInstancesCounts.previous).toEqual(0)
					expect(beforePieceInstancesCounts.current).toEqual(0)
					expect(beforePieceInstancesCounts.next).not.toEqual(0)
					expect(beforePieceInstancesCounts.other).toEqual(0)

					// Find the instance, and create its backing piece
					const targetPieceInstance = cache.NextPartInstance!.PieceInstances[0]
					expect(targetPieceInstance).toBeTruthy()

					await expect(
						context.removePieceInstances('next', [unprotectString(targetPieceInstance._id)])
					).resolves.toEqual([unprotectString(targetPieceInstance._id)])

					// Ensure it was all removed
					expect(cache.findPieceInstance(targetPieceInstance._id)).toBeFalsy()
					expect(context.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})

		describe('updatePartInstance', () => {
			test('bad parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				const partInstanceOther = (await jobContext.mockCollections.PartInstances.findOne({
					_id: { $ne: partInstance._id },
					rundownId,
				})) as DBPartInstance
				expect(partInstanceOther).toBeTruthy()

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					await expect(context.updatePartInstance('current', {})).rejects.toThrow(
						'Some valid properties must be defined'
					)
					await expect(
						context.updatePartInstance('current', { _id: 'bad', nope: 'ok' } as any)
					).rejects.toThrow('Some valid properties must be defined')
					await expect(context.updatePartInstance('current', { title: 'new' })).rejects.toThrow(
						'PartInstance could not be found'
					)
				})

				// Set a current part instance
				await setPartInstances(jobContext, playlistId, partInstance, undefined)
				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)
					await expect(context.updatePartInstance('next', { title: 'new' })).rejects.toThrow(
						'PartInstance could not be found'
					)
					await context.updatePartInstance('current', { title: 'new' })
				})
			})
			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				// Setup the rundown and find an instance to modify
				const partInstance0 = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance0).toBeTruthy()
				await setPartInstances(jobContext, playlistId, undefined, partInstance0)

				await wrapWithCache(jobContext, playlistId, async (cache) => {
					const { context } = await getActionExecutionContext(jobContext, cache)

					// Ensure there are no pending updates already
					expect((cache.NextPartInstance! as PlayoutPartInstanceModelImpl).HasAnyChanges()).toBeFalsy()

					// Update it and expect it to match
					const partInstance0Before = clone(partInstance0)
					const partInstance0Delta = {
						_id: 'sdf', // This will be dropped
						title: 'abc',
						expectedDuration: 1234,
						classes: ['123'],
						badProperty: 9, // This will be dropped
					}
					const resultPart = await context.updatePartInstance('next', partInstance0Delta)
					const partInstance1 = cache.NextPartInstance! as PlayoutPartInstanceModelImpl
					expect(partInstance1).toBeTruthy()

					expect(resultPart).toEqual(convertPartInstanceToBlueprints(partInstance1.PartInstance))

					const pieceInstance0After = {
						...partInstance0Before,
						part: {
							...partInstance0Before.part,
							..._.omit(partInstance0Delta, 'badProperty', '_id'),
						},
					}
					expect(partInstance1.PartInstance).toEqual(pieceInstance0After)
					expect(partInstance1.PartInstanceHasChanges).toBeTruthy()
					expect(partInstance1.ChangedPieceInstanceIds()).toHaveLength(0)

					expect(context.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
					expect(context.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
		})
	})
})
