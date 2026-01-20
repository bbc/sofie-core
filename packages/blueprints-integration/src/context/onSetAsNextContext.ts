import {
	IBlueprintMutatablePart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceInstance,
	IEventContext,
	IShowStyleUserContext,
} from '../index.js'
import { IRundownDataLookup } from './rundownDataLookup.js'
import { IPartPieceDataRead } from './partPieceAccess.js'

/**
 * Context in which 'current' is the part currently on air, and 'next' is the partInstance being set as Next.
 * This context allows reading from 'previous', 'current', and 'next', but has specific constraints on mutations.
 */
export interface IOnSetAsNextContext
	extends IRundownDataLookup,
		IPartPieceDataRead<'previous' | 'current' | 'next'>,
		IShowStyleUserContext,
		IEventContext {
	/** Whether the part being set as next was selected as a result of user's actions */
	readonly manuallySelected: boolean

	/**
	 * Slightly modified portions of IPartPieceMutations
	 * Future: Replace these with the interface once all methods support current + next
	 */
	/** Insert a pieceInstance (only 'next' allowed in this context). Returns id of new PieceInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	insertPiece(part: 'next', piece: IBlueprintPiece): Promise<IBlueprintPieceInstance>
	/** Update a piecesInstance from the partInstance being set as Next */
	updatePieceInstance(pieceInstanceId: string, piece: Partial<IBlueprintPiece>): Promise<IBlueprintPieceInstance>
	/** Update a partInstance */
	updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance>
	/** Remove piecesInstances by id. Returns ids of piecesInstances that were removed. */
	removePieceInstances(part: 'current' | 'next', pieceInstanceIds: string[]): Promise<string[]>

	/**
	 * Move the next part through the rundown. Can move by either a number of parts, or segments in either direction.
	 * This will result in the `onSetAsNext` callback being called again following the current call, with the new PartInstance.
	 * Multiple calls of this inside one call to `onSetAsNext` will replace earlier calls.
	 * @returns Whether a new Part was found using the provided offset
	 */
	moveNextPart(partDelta: number, segmentDelta: number, ignoreQuickLoop?: boolean): Promise<boolean>
}
