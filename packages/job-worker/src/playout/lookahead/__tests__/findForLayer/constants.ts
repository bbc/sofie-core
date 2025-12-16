import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { PartInstanceAndPieceInstances, PartAndPieces } from '../../util.js'
import { createFakePiece } from '../utils.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'

const layer: string = getRandomString()

const generateFakeObectsString = (
	pieceId: string,
	layer: string,
	beforeStart: number,
	afterStart: number,
	enableWhile: boolean = false
) =>
	protectString<PieceTimelineObjectsBlob>(
		JSON.stringify([
			// At piece start
			{
				id: pieceId + 'tl_pieceStart' + (enableWhile ? '_while' : ''),
				layer: layer,
				enable: !enableWhile ? { start: 0 } : { while: 1 },
				content: { deviceType: 0, type: 'none' },
			},
			//beforeOffsetObj except if it's piece starts later than the offset.
			{
				id: pieceId + 'tl_beforeOffset' + (enableWhile ? '_while' : ''),
				layer: layer,
				enable: !enableWhile ? { start: beforeStart } : { while: beforeStart },
				content: { deviceType: 0, type: 'none' },
			},
			//afterOffsetObj except if it's piece starts later than the offset.
			{
				id: pieceId + 'tl_afterOffset' + (enableWhile ? '_while' : ''),
				layer: layer,
				enable: !enableWhile ? { start: afterStart } : { while: afterStart },
				content: { deviceType: 0, type: 'none' },
			},
		])
	)

export const findForLayerTestConstants = {
	previous: {
		part: { _id: 'pPrev', part: 'prev' },
		allPieces: [createFakePiece('1'), createFakePiece('2'), createFakePiece('3')],
		onTimeline: true,
		nowInPart: 2000,
	} as any as PartInstanceAndPieceInstances,
	current: {
		part: { _id: 'pCur', part: 'cur' },
		allPieces: [createFakePiece('4'), createFakePiece('5'), createFakePiece('6')],
		onTimeline: true,
		nowInPart: 1000,
	} as any as PartInstanceAndPieceInstances,
	nextTimed: {
		part: { _id: 'pNextTimed', part: 'nextT' },
		allPieces: [createFakePiece('7'), createFakePiece('8'), createFakePiece('9')],
		onTimeline: true,
	} as any as PartInstanceAndPieceInstances,
	nextFuture: {
		part: { _id: 'pNextFuture', part: 'nextF' },
		allPieces: [createFakePiece('10'), createFakePiece('11'), createFakePiece('12')],
		onTimeline: false,
	} as any as PartInstanceAndPieceInstances,

	orderedParts: [{ _id: 'p1' }, { _id: 'p2', invalid: true }, { _id: 'p3' }, { _id: 'p4' }, { _id: 'p5' }].map(
		(p) => ({
			part: p as any,
			usesInTransition: true,
			pieces: [{ _id: p._id + '_p1' } as any],
		})
	) as PartAndPieces[],

	layer,
}

const partDuration = 3000

const lookaheadOffsetLayerIds = {
	partStart: 'partStart_' + layer,
	beforeOffset: 'beforeOffset_' + layer,
	afterOffset: 'afterOffset_' + layer,
}

export const lookaheadOffsetTestConstants = {
	multiLayerPart: {
		part: { _id: 'pLookahead_ml', part: 'lookahead_ml' },

		pieces: [
			// piece1 — At Part Start - lookaheadOffset should equal nextTimeOffset
			createFakePiece('ml_piece1', {
				enable: { start: 0, duration: partDuration - 0 },
				sourceLayerId: lookaheadOffsetLayerIds.partStart,
				// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
				// We need to check if all offsets are calculated correctly. (1000, 300 and no offset)
				timelineObjectsString: generateFakeObectsString(
					'ml_piece1',
					lookaheadOffsetLayerIds.partStart,
					700,
					1700
				),
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			createFakePiece('ml_piece2', {
				enable: { start: 500, duration: partDuration - 500 },
				sourceLayerId: lookaheadOffsetLayerIds.beforeOffset,
				// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
				// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
				timelineObjectsString: generateFakeObectsString(
					'ml_piece2',
					lookaheadOffsetLayerIds.beforeOffset,
					200,
					1200
				),
			}),

			// piece3 — After Offset — no lookahead offset
			createFakePiece('ml_piece3', {
				enable: { start: 1500, duration: partDuration - 1500 },
				sourceLayerId: lookaheadOffsetLayerIds.afterOffset,
				// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
				// We need to check if all offsets are calculated correctly.
				// for reference no offset should be calculated for all of it's objects.
				timelineObjectsString: generateFakeObectsString(
					'ml_piece3',
					lookaheadOffsetLayerIds.afterOffset,
					200,
					400
				),
			}),
		],

		onTimeline: true,
	} as any as PartAndPieces,
	multiLayerPartWhile: {
		part: { _id: 'pLookahead_ml_while', part: 'lookaheadFull_ml_while' },

		pieces: [
			// piece1 — At Part Start - lookaheadOffset should equal nextTimeOffset
			createFakePiece('ml_piece1_while', {
				enable: { start: 0, duration: partDuration - 0 },
				sourceLayerId: lookaheadOffsetLayerIds.partStart,
				// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
				// We need to check if all offsets are calculated correctly. (1000, 300 and no offset)
				timelineObjectsString: generateFakeObectsString(
					'ml_piece1_while',
					lookaheadOffsetLayerIds.partStart,
					700,
					1700,
					true
				),
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start
			createFakePiece('ml_piece2_while', {
				enable: { start: 500, duration: partDuration - 500 },
				sourceLayerId: lookaheadOffsetLayerIds.beforeOffset,
				// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
				// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
				timelineObjectsString: generateFakeObectsString(
					'ml_piece2_while',
					lookaheadOffsetLayerIds.beforeOffset,
					200,
					1200,
					true
				),
			}),

			// piece3 — After Offset — no lookahead offset
			createFakePiece('ml_piece3_while', {
				enable: { start: 1500, duration: partDuration - 1500 },
				sourceLayerId: lookaheadOffsetLayerIds.afterOffset,
				// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
				// We need to check if all offsets are calculated correctly. (no offset should be calculated)
				timelineObjectsString: generateFakeObectsString(
					'ml_piece3_while',
					lookaheadOffsetLayerIds.afterOffset,
					200,
					400,
					true
				),
			}),
		],

		onTimeline: true,
	} as any as PartAndPieces,
	singleLayerPart: {
		part: { _id: 'pLookahead_sl', part: 'lookahead_sl' },

		pieces: [
			// piece1 — At Part Start - should be ignored
			createFakePiece('sl_piece1', {
				enable: { start: 0, duration: partDuration - 0 },
				sourceLayerId: layer,
				// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
				// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
				// for reference the calculated offset values should be 1000, 300 and no offset
				timelineObjectsString: generateFakeObectsString('sl_piece1', layer, 700, 1700),
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start
			createFakePiece('sl_piece2', {
				enable: { start: 500, duration: partDuration - 500 },
				sourceLayerId: layer,
				// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
				// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
				timelineObjectsString: generateFakeObectsString('sl_piece2', layer, 200, 1200),
			}),

			// piece3 — After Offset — should be ignored
			createFakePiece('sl_piece3', {
				enable: { start: 1500, duration: partDuration - 1500 },
				sourceLayerId: layer,
				// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
				// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
				// for reference no offset should be calculated for all of it's objects.
				timelineObjectsString: generateFakeObectsString('sl_piece3', layer, 200, 400),
			}),
		],
		onTimeline: true,
	} as any as PartAndPieces,
	singleLayerPartWhile: {
		part: { _id: 'pLookahead_sl_while', part: 'lookahead_sl_while' },

		pieces: [
			// piece1 — At Part Start - should be ignored
			createFakePiece('sl_piece1_while', {
				enable: { start: 0, duration: partDuration - 0 },
				sourceLayerId: layer,
				// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
				// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
				// for reference the calculated offset values should be 1000, 300 and no offset
				timelineObjectsString: generateFakeObectsString('sl_piece1_while', layer, 700, 1700, true),
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start
			createFakePiece('sl_piece2_while', {
				enable: { start: 500, duration: partDuration - 500 },
				sourceLayerId: layer,
				// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
				// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
				timelineObjectsString: generateFakeObectsString('sl_piece2_while', layer, 200, 1200, true),
			}),

			// piece3 — After Offset — should be ignored
			createFakePiece('sl_piece3_while', {
				enable: { start: 1500, duration: partDuration - 1500 },
				sourceLayerId: layer,
				// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
				// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
				// for reference no offset should be calculated for all of it's objects.
				timelineObjectsString: generateFakeObectsString('sl_piece3_while', layer, 200, 400, true),
			}),
		],
		onTimeline: true,
	} as any as PartAndPieces,

	nextTimeOffset: 1000,

	layer,
	lookaheadOffsetLayerIds,
}
