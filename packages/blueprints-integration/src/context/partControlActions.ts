import { Time } from '../index.js'

export interface IPartControlActions {
	/** Inform core that a take out of the current partinstance should be blocked until the specified time */
	blockTakeUntil(time: Time | null): Promise<void>

	/** Stop any piecesInstances on the specified sourceLayers. Returns ids of piecesInstances that were affected */
	stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number): Promise<string[]>

	/** Stop piecesInstances by id. Returns ids of piecesInstances that were removed */
	stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number): Promise<string[]>
}
