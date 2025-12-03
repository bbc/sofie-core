import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimelineObjType } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getBestPieceInstanceId, LookaheadTimelineObject } from './findObjects'
import { PartAndPieces, PieceInstanceWithObjectMap } from './util'
import { TimelineEnable } from 'superfly-timeline'
import { TimelineObjectCoreExt } from '@sofie-automation/blueprints-integration'

export type StartInfo = { start: number } | { while: number } | undefined

/**
 * Computes a full {@link LookaheadTimelineObject} for a given piece/object pair,
 * including the correct `lookaheadOffset` based on explicit numeric `start` or
 * `while > 1` expressions.
 *
 * This function:
 * - Ignores objects whose `enable` is an array (unsupported for lookahead)
 * - Extracts a usable numeric start reference from both the object and its parent piece
 * - Supports lookahead semantics where `enable.while > 1` acts like an implicit start value
 *   but the offset is added *to the while value* instead of replacing start
 * - Returns `undefined` when lookahead cannot be computed safely
 *
 * @param obj - The timeline object associated with the piece and layer. If `undefined`,
 *              no lookahead object is created.
 * @param rawPiece - The piece instance containing the object map and its own enable
 *                   expression, which determines the base start time for lookahead.
 * @param partInfo - Metadata about the part the piece belongs to, required for
 *                   associating the lookahead object with the correct `partInstanceId`.
 * @param partInstanceId - The currently active or next part instance ID. If `null`,
 *                         the function falls back to the part ID from `partInfo`.
 * @param nextTimeOffset - An optional offset of the in point of the next part
 *                         used to calculate the lookahead offset. If omitted, no
 *                         lookahead offset is generated.
 *
 * @returns A fully constructed {@link LookaheadTimelineObject} ready to be pushed
 *          into the lookahead timeline, or `undefined` when no valid lookahead
 *          calculation is possible.
 */
export function computeLookaheadObject(
	obj: TimelineObjectCoreExt<any, unknown, unknown> | undefined,
	rawPiece: PieceInstanceWithObjectMap,
	partInfo: PartAndPieces,
	partInstanceId: PartInstanceId | null,
	nextTimeOffset?: number
): LookaheadTimelineObject | undefined {
	if (!obj) return undefined

	const enable = obj.enable

	if (Array.isArray(enable)) return undefined

	const startInfo = getStartInfoFromEnable(enable)
	const pieceStartInfo = getStartInfoFromEnable(rawPiece.piece.enable)

	// We make sure to only consider objects for lookahead that have an explicit numeric start/while value. (while = 1 and 0 is considered boolean)
	if (!pieceStartInfo) return undefined

	let lookaheadOffset: number | undefined
	// Only calculate lookaheadOffset if needed
	if (nextTimeOffset) {
		const pieceStart = 'start' in pieceStartInfo ? pieceStartInfo.start : pieceStartInfo.while
		lookaheadOffset = computeLookaheadOffset(nextTimeOffset, pieceStart, startInfo)
	}

	return literal<LookaheadTimelineObject>({
		metaData: undefined,
		...obj,
		objectType: TimelineObjType.RUNDOWN,
		pieceInstanceId: getBestPieceInstanceId(rawPiece),
		infinitePieceInstanceId: rawPiece.infinite?.infiniteInstanceId,
		partInstanceId: partInstanceId ?? protectString(unprotectString(partInfo.part._id)),
		lookaheadOffset,
	})
}

/**
 * Computes a lookahead offset for an object based on the next part's start time,
 * the piece's start time, and the object's enable expression (represented as a {@link StartInfo}).
 *
 * This function supports two mutually exclusive modes:
 *
 * **1. `start` mode (`{ start: number | undefined }`)**
 *    - A numeric `start` value is treated as the object's explicit start time.
 *    - The offset is calculated as:
 *      ```
 *      offset = nextTimeOffset - pieceStart - start
 *      ```
 *    - Returns `undefined` if the resulting offset is not positive.
 *
 * **2. `while` mode (`{ while: number | undefined }`)**
 *    - `while = 0` is treated as a boolean "false" → no lookahead offset.
 *    - `while = 1` is treated as a boolean "true" equivalent to `start = 0`,
 *      meaning the object starts immediately.
 *    - Any `while > 1` value is treated as a timestamp signifying when the object
 *      is considered to begin, and the lookahead offset is added *on top of*
 *      the while value. Example:
 *      ```
 *      effectiveStart = (while === 1 ? 0 : while)
 *      offset = nextTimeOffset - pieceStart - effectiveStart
 *      returned = while + offset
 *      ```
 *    - Returns `undefined` if the computed offset is not positive.
 *
 * @param nextTimeOffset - The upcoming part's start time (or similar time anchor).
 *                         If undefined, no lookahead offset is produced.
 * @param pieceStart - The start time of the piece this object belongs to.
 * @param info - A `StartInfo` discriminated union describing whether the object
 *               uses a numeric `start` or a `while` expression.
 *
 * @returns A positive lookahead offset, or `undefined` if lookahead cannot be
 *          determined or would be non-positive.
 */
function computeLookaheadOffset(
	nextTimeOffset: number | undefined,
	pieceStart: number,
	info: StartInfo
): number | undefined {
	if (nextTimeOffset === undefined || !info) return undefined

	if ('start' in info) {
		const offset = nextTimeOffset - pieceStart - info.start
		return offset > 0 ? offset : undefined
	}

	if ('while' in info) {
		// while == 0 is treated as false
		if (info.while !== 0) {
			// while == 1 is treated as true which is equal to start == 0. Any other value means the object starts at that timestamp and doesn't have an end.
			const offset = nextTimeOffset - pieceStart - info.while === 1 ? 0 : info.while
			return offset > 0 ? info.while + offset : undefined
		}
	}

	return undefined
}

/**
 * Extracts a numeric start reference from a {@link TimelineEnable} object,
 * returning a {@link StartInfo} describing how lookahead should be calculated.
 *
 * The function handles two mutually exclusive modes:
 *
 * **1. `start` mode (`{ start: number }`)**
 *    - If `enable.start` is a numeric value, it is returned as `start`.
 *    - If `enable.start` is the string `"now"`, it is treated as `0`.
 *
 * **2. `while` mode (`{ while: number }`)**
 *    - If `enable.while` is numeric and greater than 1, it is returned as `while`.
 *    - This indicates the object should be considered as starting at this
 *      timestamp, with any lookahead offset added on top.
 *
 * If no usable numeric `start` or `while` expression exists, the function returns `undefined`.
 *
 * @param enable - The timeline object's enable expression to extract start info from.
 * @returns A {@link StartInfo} object containing either `start` or `while`, or `undefined`
 *          if no numeric value is available for lookahead calculations.
 */
function getStartInfoFromEnable(enable: TimelineEnable): StartInfo {
	// Case: start is a number
	if (typeof enable.start === 'number') {
		return { start: enable.start }
	}

	// Case: start is "now"
	if (enable.start === 'now') {
		return { start: 0 }
	}

	// Case: while is numeric and > 1 → offset must be added to while
	if (typeof enable.while === 'number' && enable.while > 1) {
		return { while: enable.while }
	}

	// No usable numeric expressions
	return undefined
}
