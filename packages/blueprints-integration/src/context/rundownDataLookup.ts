import { ReadonlyDeep } from 'type-fest'
import {
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
} from '../index.js'
import { BlueprintQuickLookInfo } from './quickLoopInfo.js'

/**
 * Methods for looking back in history for pieces and parts, and looking ahead to upcoming parts.
 */
export interface IRundownDataLookup {
	/** Information about the current loop, if there is one */
	readonly quickLoopInfo: BlueprintQuickLookInfo | null

	/** Get the last active piece on given layer */
	findLastPieceOnLayer(
		sourceLayerId: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			originalOnly?: boolean
			piecePrivateDataFilter?: any // Mongo query against properties inside of piece.privateData
		}
	): Promise<IBlueprintPieceInstance | undefined>

	/** Get the previous scripted piece on a given layer, looking backwards from the current part. */
	findLastScriptedPieceOnLayer(
		sourceLayerId: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			piecePrivateDataFilter?: any
		}
	): Promise<IBlueprintPiece | undefined>

	/** Gets the PartInstance for a PieceInstance retrieved from findLastPieceOnLayer. This primarily allows for accessing metadata of the PartInstance */
	getPartInstanceForPreviousPiece(piece: IBlueprintPieceInstance): Promise<IBlueprintPartInstance>

	/** Gets the Part for a Piece retrieved from findLastScriptedPieceOnLayer. This primarily allows for accessing metadata of the Part */
	getPartForPreviousPiece(piece: IBlueprintPieceDB): Promise<IBlueprintPart | undefined>

	/** Get a list of the upcoming Parts in the Rundown, in the order that they will be Taken
	 *
	 * @param limit The max number of parts returned. Default is 5.
	 * @returns An array of Parts. If there is no next part, the array will be empty.
	 */
	getUpcomingParts(limit?: number): Promise<ReadonlyDeep<IBlueprintPart[]>>
}
