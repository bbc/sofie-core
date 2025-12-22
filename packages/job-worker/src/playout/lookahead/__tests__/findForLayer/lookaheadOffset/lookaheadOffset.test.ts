jest.mock('../../../../../playout/lookahead/index.js', () => {
	const actual = jest.requireActual('../../../../../playout/lookahead/index.js')
	return {
		...actual,
		findLargestLookaheadDistance: jest.fn(() => 0),
		getLookeaheadObjects: actual.getLookeaheadObjects,
	}
})
jest.mock('../../../../../playout/lookahead/util.js')
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { LookaheadMode, TSR } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../../../../../jobs/index.js'
import { findLargestLookaheadDistance, getLookeaheadObjects } from '../../../../../playout/lookahead/index.js'
import { getOrderedPartsAfterPlayhead } from '../../../../../playout/lookahead/util.js'
import { PlayoutModel } from '../../../../../playout/model/PlayoutModel.js'
import { SelectedPartInstancesTimelineInfo } from '../../../../../playout/timeline/generate.js'
import { wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'

const findLargestLookaheadDistanceMock = jest.mocked(findLargestLookaheadDistance).mockImplementation(() => 0)

const getOrderedPartsAfterPlayheadMock = jest.mocked(getOrderedPartsAfterPlayhead).mockImplementation(() => [])
const partDuration = 3000
function makePiece({
	partId,
	layer,
	start = 0,
	duration,
	nameSuffix = '',
	objsBeforeOffset = 0,
	objsAfterOffset = 0,
	objsWhile = false,
}: {
	partId: string
	layer: string
	start?: number
	duration?: number
	nameSuffix?: string
	objsBeforeOffset?: number
	objsAfterOffset?: number
	objsWhile?: boolean
}) {
	return {
		_id: protectString(`piece_${partId}_${nameSuffix}_${layer}`),
		startRundownId: protectString('r1'),
		startPartId: protectString(partId),
		enable: { start, duration },
		outputLayerId: layer,
		pieceType: 'normal',
		timelineObjectsString: generateFakeObectsString(
			`piece_${partId}_${nameSuffix}_${layer}`,
			layer,
			objsBeforeOffset,
			objsAfterOffset,
			objsWhile
		),
	}
}

function generateFakeObectsString(
	pieceId: string,
	layer: string,
	beforeStart: number,
	afterStart: number,
	enableWhile: boolean = false
) {
	return protectString<PieceTimelineObjectsBlob>(
		JSON.stringify([
			// At piece start
			{
				id: `${pieceId}_objPieceStart_${layer}`,
				layer,
				enable: !enableWhile ? { start: 0 } : { while: 1 },
				content: {
					deviceType: TSR.DeviceType.CASPARCG,
					type: TSR.TimelineContentTypeCasparCg.MEDIA,
					file: 'AMB',
				},
			},
			//beforeOffsetObj except if it's piece starts later than the offset.
			{
				id: `${pieceId}_obj_beforeOffset_${layer}`,
				layer,
				enable: !enableWhile ? { start: beforeStart } : { while: beforeStart },
				content: {
					deviceType: TSR.DeviceType.CASPARCG,
					type: TSR.TimelineContentTypeCasparCg.MEDIA,
					file: 'AMB',
				},
			},
			//afterOffsetObj except if it's piece starts later than the offset.
			{
				id: `${pieceId}_obj_afterOffset_${layer}`,
				layer,
				enable: !enableWhile ? { start: afterStart } : { while: afterStart },
				content: {
					deviceType: TSR.DeviceType.CASPARCG,
					type: TSR.TimelineContentTypeCasparCg.MEDIA,
					file: 'AMB',
				},
			},
		])
	)
}
const lookaheadOffsetTestConstants = {
	multiLayerPart: {
		nowInPart: 0,
		partInstance: {
			_id: protectString('pLookahead_ml_instance'),
			part: {
				_id: protectString('pLookahead_ml'),
				_rank: 0,
			},
			playlistActivationId: 'pA1',
		},
		pieces: [
			// piece1 — At Part Start - lookaheadOffset should equal nextTimeOffset
			// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (1000, 300 and no offset)
			makePiece({
				partId: 'pLookahead_ml',
				layer: 'layer1',
				duration: partDuration,
				nameSuffix: 'partStart',
				objsBeforeOffset: 700,
				objsAfterOffset: 1700,
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
			makePiece({
				partId: 'pLookahead_ml',
				layer: 'layer2',
				start: 500,
				duration: partDuration - 500,
				nameSuffix: 'partBeforeOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 1200,
			}),

			// piece3 — After Offset — no lookahead offset
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
			// We need to check if all offsets are calculated correctly.
			// for reference no offset should be calculated for all of it's objects.
			makePiece({
				partId: 'pLookahead_ml',
				layer: 'layer3',
				start: 1500,
				duration: partDuration - 1500,
				nameSuffix: 'partAfterOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 400,
			}),
		],
		calculatedTimings: undefined,
		regenerateTimelineAt: undefined,
	},
	multiLayerPartWhile: {
		nowInPart: 0,
		partInstance: {
			_id: protectString('pLookahead_ml_while_instance'),
			part: {
				_id: protectString('pLookahead_ml_while'),
				_rank: 0,
			},
			playlistActivationId: 'pA1',
		},
		pieces: [
			// piece1 — At Part Start - lookaheadOffset should equal nextTimeOffset
			// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (1000, 300 and no offset)
			makePiece({
				partId: 'pLookahead_ml_while',
				layer: 'layer1',
				duration: partDuration,
				nameSuffix: 'partStart',
				objsBeforeOffset: 700,
				objsAfterOffset: 1700,
				objsWhile: true,
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
			makePiece({
				partId: 'pLookahead_ml_while',
				layer: 'layer2',
				start: 500,
				duration: partDuration - 500,
				nameSuffix: 'partBeforeOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 1200,
				objsWhile: true,
			}),

			// piece3 — After Offset — no lookahead offset
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
			// We need to check if all offsets are calculated correctly.
			// for reference no offset should be calculated for all of it's objects.
			makePiece({
				partId: 'pLookahead_ml_while',
				layer: 'layer3',
				start: 1500,
				duration: partDuration - 1500,
				nameSuffix: 'partAfterOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 400,
				objsWhile: true,
			}),
		],
		calculatedTimings: undefined,
		regenerateTimelineAt: undefined,
	},
	singleLayerPart: {
		nowInPart: 0,
		partInstance: {
			_id: protectString('pLookahead_sl_instance'),
			part: {
				_id: protectString('pLookahead_sl'),
				_rank: 0,
			},
			playlistActivationId: 'pA1',
		},
		pieces: [
			// piece1 — At Part Start - should be ignored
			// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
			// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
			// for reference the calculated offset values should be 1000, 300 and no offset
			makePiece({
				partId: 'pLookahead_sl',
				layer: 'layer1',
				duration: partDuration,
				nameSuffix: 'partStart',
				objsBeforeOffset: 700,
				objsAfterOffset: 1700,
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			/// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
			makePiece({
				partId: 'pLookahead_sl',
				layer: 'layer1',
				start: 500,
				duration: partDuration - 500,
				nameSuffix: 'partBeforeOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 1200,
			}),

			// piece3 — After Offset — should be ignored
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
			// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
			// for reference no offset should be calculated for all of it's objects.
			makePiece({
				partId: 'pLookahead_sl',
				layer: 'layer1',
				start: 1500,
				duration: partDuration - 1500,
				nameSuffix: 'partAfterOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 400,
			}),
		],
		calculatedTimings: undefined,
		regenerateTimelineAt: undefined,
	},
	singleLayerPartWhile: {
		nowInPart: 0,
		partInstance: {
			_id: protectString('pLookahead_sl_while_instance'),
			part: {
				_id: protectString('pLookahead_sl_while'),
				_rank: 0,
			},
			playlistActivationId: 'pA1',
		},
		pieces: [
			// piece1 — At Part Start - should be ignored
			// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
			// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
			// for reference the calculated offset values should be 1000, 300 and no offset
			makePiece({
				partId: 'pLookahead_sl_while',
				layer: 'layer1',
				duration: partDuration,
				nameSuffix: 'partStart',
				objsBeforeOffset: 700,
				objsAfterOffset: 1700,
				objsWhile: true,
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
			makePiece({
				partId: 'pLookahead_sl_while',
				layer: 'layer1',
				start: 500,
				duration: partDuration - 500,
				nameSuffix: 'partBeforeOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 1200,
				objsWhile: true,
			}),

			// piece3 — After Offset — should be ignored
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
			// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
			// for reference no offset should be calculated for all of it's objects.
			makePiece({
				partId: 'pLookahead_sl_while',
				layer: 'layer1',
				start: 1500,
				duration: partDuration - 1500,
				nameSuffix: 'partAfterOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 400,
				objsWhile: true,
			}),
		],
		calculatedTimings: undefined,
		regenerateTimelineAt: undefined,
	},
	nextTimeOffset: 1000,
}

describe('getLookeaheadObjects', () => {
	let context: JobContext
	let playoutModel: PlayoutModel

	beforeEach(() => {
		jest.resetAllMocks()

		context = {
			startSpan: jest.fn(() => ({ end: jest.fn() })),
			studio: {
				mappings: {
					layer1: {
						device: 'casparcg',
						layer: 10,
						lookahead: LookaheadMode.PRELOAD,
						lookaheadDepth: 1,
						lookaheadMaxSearchDistance: 10,
					},
					layer2: {
						device: 'casparcg',
						layer: 10,
						lookahead: LookaheadMode.PRELOAD,
						lookaheadDepth: 1,
						lookaheadMaxSearchDistance: 10,
					},
					layer3: {
						device: 'casparcg',
						layer: 10,
						lookahead: LookaheadMode.PRELOAD,
						lookaheadDepth: 1,
						lookaheadMaxSearchDistance: 10,
					},
				},
			},
			directCollections: {
				Pieces: {
					findFetch: jest.fn(),
				},
			},
		} as unknown as JobContext

		playoutModel = {
			getRundownIds: () => [protectString('r1')],
			playlist: {
				nextTimeOffset: 0,
			},
		} as unknown as PlayoutModel
	})

	test('returns empty array when no lookahead mappings are defined', async () => {
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{
				_id: protectString('p1'),
				classesForNext: [],
			} as any,
		])
		const findFetchMock = jest.fn().mockResolvedValue([makePiece({ partId: 'p1', layer: 'layer1' })])
		context = {
			...context,
			studio: {
				...context.studio,
				mappings: {},
			},
			directCollections: {
				...context.directCollections,
				Pieces: {
					...context.directCollections.Pieces,
					findFetch: findFetchMock,
				},
			},
		} as JobContext

		const res = await getLookeaheadObjects(context, playoutModel, {} as SelectedPartInstancesTimelineInfo)

		expect(res).toEqual([])
	})
	test('returns one lookahead object for a single future part', async () => {
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{
				_id: protectString('p1'),
				classesForNext: [],
			} as any,
		])

		const findFetchMock = jest.fn().mockResolvedValue([makePiece({ partId: 'p1', layer: 'layer1' })])

		context = {
			...context,
			directCollections: {
				...context.directCollections,
				Pieces: {
					...context.directCollections.Pieces,
					findFetch: findFetchMock,
				},
			},
		} as unknown as JobContext

		const res = await getLookeaheadObjects(context, playoutModel, {
			current: undefined,
			next: undefined,
			previous: undefined,
		} as SelectedPartInstancesTimelineInfo)

		expect(res).toHaveLength(1)

		const obj = res[0]
		expect(obj.layer).toBe('layer1_lookahead')
		expect(obj.objectType).toBe('rundown')
		expect(obj.pieceInstanceId).toContain('p1')
		expect(obj.partInstanceId).toContain('p1')
		expect(obj.content).toMatchObject({
			deviceType: TSR.DeviceType.CASPARCG,
			type: TSR.TimelineContentTypeCasparCg.MEDIA,
			file: 'AMB',
		})
	})
	test('respects lookaheadMaxSearchDistance', async () => {
		findLargestLookaheadDistanceMock.mockReturnValue(10)
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ _id: protectString('p1'), classesForNext: [] } as any,
			{ _id: protectString('p2'), classesForNext: [] } as any,
		])

		context = {
			...context,
			studio: {
				...context.studio,
				mappings: {
					...context.studio.mappings,
					layer1: {
						...context.studio.mappings['layer1'],
						lookaheadMaxSearchDistance: 1,
					},
				},
			},
		} as JobContext

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue([
				makePiece({ partId: 'p1', layer: 'layer1' }),
				makePiece({ partId: 'p2', layer: 'layer1' }),
			])

		const res = await getLookeaheadObjects(context, playoutModel, {} as SelectedPartInstancesTimelineInfo)

		expect(res).toHaveLength(1)
		expect(res[0].partInstanceId).toContain('p1')
	})
	test('applies nextTimeOffset to lookahead objects in future part', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 5000,
			},
		} as PlayoutModel
		findLargestLookaheadDistanceMock.mockReturnValue(1)
		getOrderedPartsAfterPlayheadMock.mockReturnValue([{ _id: protectString('p1'), classesForNext: [] } as any])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue([makePiece({ partId: 'p1', layer: 'layer1', start: 0 })])

		const res = await getLookeaheadObjects(context, playoutModel, {} as SelectedPartInstancesTimelineInfo)

		expect(res).toHaveLength(1)
		expect(res[0].lookaheadOffset).toBe(5000)
	})
	test('applies nextTimeOffset to lookahead objects in nextPart with no offset on next part', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 5000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([{ _id: protectString('p1'), classesForNext: [] } as any])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue([
				makePiece({ partId: 'pNext', layer: 'layer1', start: 0 }),
				makePiece({ partId: 'p1', layer: 'layer2', start: 0 }),
			])

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				nowInPart: 0,
				partInstance: {
					_id: protectString('pNextInstance'),
					part: {
						_id: protectString('pNext'),
						_rank: 0,
					},
					playlistActivationId: 'pA1',
				},
				pieceInstances: [
					wrapPieceToInstance(
						makePiece({ partId: 'pNext', layer: 'layer1', start: 0 }) as any,
						'pA1' as any,
						'pNextInstance' as any
					),
				],
				calculatedTimings: undefined,
				regenerateTimelineAt: undefined,
			},
		} as any)

		expect(res).toHaveLength(2)
		expect(res[0].lookaheadOffset).toBe(5000)
		expect(res[1].lookaheadOffset).toBe(undefined)
	})
	test('Multi layer part produces lookahead objects for all layers with the correct offsets', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 1000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ ...lookaheadOffsetTestConstants.multiLayerPart, classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue(lookaheadOffsetTestConstants.multiLayerPart.pieces)

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				...lookaheadOffsetTestConstants.multiLayerPart,
				pieceInstances: lookaheadOffsetTestConstants.multiLayerPart.pieces.map((piece) =>
					wrapPieceToInstance(
						piece as any,
						'pA1' as any,
						lookaheadOffsetTestConstants.multiLayerPart.partInstance._id
					)
				),
			},
		} as any)

		expect(res).toHaveLength(3)
		expect(res.map((o) => o.layer).sort()).toEqual([`layer1_lookahead`, 'layer2_lookahead', 'layer3_lookahead'])
		expect(res.map((o) => o.lookaheadOffset).sort()).toEqual([1000, 500])
	})
	test('Multi layer part produces lookahead objects with while enable values for all layers with the correct offsets', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 1000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ ...lookaheadOffsetTestConstants.multiLayerPartWhile, classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue(lookaheadOffsetTestConstants.multiLayerPartWhile.pieces)

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				...lookaheadOffsetTestConstants.multiLayerPartWhile,
				pieceInstances: lookaheadOffsetTestConstants.multiLayerPartWhile.pieces.map((piece) =>
					wrapPieceToInstance(
						piece as any,
						'pA1' as any,
						lookaheadOffsetTestConstants.multiLayerPartWhile.partInstance._id
					)
				),
			},
		} as any)

		expect(res).toHaveLength(3)
		expect(res.map((o) => o.layer).sort()).toEqual([`layer1_lookahead`, 'layer2_lookahead', 'layer3_lookahead'])
		expect(res.map((o) => o.lookaheadOffset).sort()).toEqual([1000, 500])
	})
	test('Single layer part produces lookahead objects with the correct offsets', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 1000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ ...lookaheadOffsetTestConstants.singleLayerPart, classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue(lookaheadOffsetTestConstants.singleLayerPart.pieces)

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				...lookaheadOffsetTestConstants.singleLayerPart,
				pieceInstances: lookaheadOffsetTestConstants.singleLayerPart.pieces.map((piece) =>
					wrapPieceToInstance(
						piece as any,
						'pA1' as any,
						lookaheadOffsetTestConstants.singleLayerPart.partInstance._id
					)
				),
			},
		} as any)
		expect(res).toHaveLength(2)
		expect(res.map((o) => o.layer)).toEqual(['layer1_lookahead', 'layer1_lookahead'])
		expect(res.map((o) => o.lookaheadOffset)).toEqual([500, undefined])
	})
	test('Single layer part produces lookahead objects with while enable values with the correct offsets', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 1000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ ...lookaheadOffsetTestConstants.singleLayerPartWhile, classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue(lookaheadOffsetTestConstants.singleLayerPartWhile.pieces)

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				...lookaheadOffsetTestConstants.singleLayerPartWhile,
				pieceInstances: lookaheadOffsetTestConstants.singleLayerPartWhile.pieces.map((piece) =>
					wrapPieceToInstance(
						piece as any,
						'pA1' as any,
						lookaheadOffsetTestConstants.singleLayerPartWhile.partInstance._id
					)
				),
			},
		} as any)
		expect(res).toHaveLength(2)
		expect(res.map((o) => o.layer)).toEqual(['layer1_lookahead', 'layer1_lookahead'])
		expect(res.map((o) => o.lookaheadOffset)).toEqual([500, undefined])
	})
})
