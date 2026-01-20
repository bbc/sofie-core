import {
	IBlueprintMutatablePart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IBlueprintSegmentDB,
} from '../index.js'

/**
 * Read-only data access for parts and pieces.
 * Uses type parameter to control which parts can be read from.
 *
 * @template TPart - Which parts can be read from ('current' | 'next' or 'previous' | 'current' | 'next')
 */
export interface IPartPieceDataRead<TPart extends string> {
	/** Get a PartInstance which can be modified */
	getPartInstance(part: TPart): Promise<IBlueprintPartInstance | undefined>

	/** Get the PieceInstances for a modifiable PartInstance */
	getPieceInstances(part: TPart): Promise<IBlueprintPieceInstance[]>

	/** Get the resolved PieceInstances for a modifiable PartInstance */
	getResolvedPieceInstances(part: TPart): Promise<IBlueprintResolvedPieceInstance[]>

	/** Gets the Segment. This primarily allows for accessing metadata */
	getSegment(segment: TPart): Promise<IBlueprintSegmentDB | undefined>
}

/**
 * Mutation operations for parts and pieces.
 * Uses type parameter to control which parts can be written to.
 *
 * @template TPart - Which parts can be written to ('current' | 'next' or 'next' only)
 */
export interface IPartPieceMutations<TPart extends string> {
	/** Insert a pieceInstance. Returns id of new PieceInstance. Any timelineObjects will have their ids changed, so are not safe to reference from another piece */
	insertPiece(part: TPart, piece: IBlueprintPiece): Promise<IBlueprintPieceInstance>

	/** Update a piecesInstance */
	updatePieceInstance(pieceInstanceId: string, piece: Partial<IBlueprintPiece>): Promise<IBlueprintPieceInstance>

	/** Update a partInstance */
	updatePartInstance(part: TPart, props: Partial<IBlueprintMutatablePart>): Promise<IBlueprintPartInstance>

	/** Remove piecesInstances by id. Returns ids of piecesInstances that were removed. */
	removePieceInstances(part: TPart, pieceInstanceIds: string[]): Promise<string[]>
}
