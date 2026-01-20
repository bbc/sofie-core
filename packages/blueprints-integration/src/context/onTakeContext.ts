import { IEventContext, IShowStyleUserContext } from '../index.js'
import { IRundownDataLookup } from './rundownDataLookup.js'
import { IExecuteTSRActionsContext } from './executeTsrActionContext.js'
import { IPartAndPieceActionContext } from './partsAndPieceActionContext.js'

/**
 * Context in which 'current' is the partInstance we're leaving, and 'next' is the partInstance we're taking.
 */
export interface IOnTakeContext
	extends IRundownDataLookup,
		IPartAndPieceActionContext<'previous' | 'current' | 'next'>,
		IShowStyleUserContext,
		IEventContext,
		IExecuteTSRActionsContext {
	/**
	 * Prevent the take.
	 * All modifications to the pieceInstances and partInstance done through this context will be persisted,
	 * but the next part will not be taken.
	 */
	abortTake(): void
}
