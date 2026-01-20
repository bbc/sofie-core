import { IRundownDataLookup } from './rundownDataLookup.js'
import { IPartPieceDataRead, IPartPieceMutations } from './partPieceAccess.js'
import { IPartControlActions } from './partControlActions.js'

/**
 * Reusable helper context for part and piece actions during playback.
 * Used as a base for IOnTakeContext and IActionExecutionContext.
 */
export interface IPartAndPieceActionContext<
	TRead extends string = 'current' | 'next',
	TWrite extends string = 'current' | 'next',
> extends IRundownDataLookup,
		IPartPieceDataRead<TRead>,
		IPartPieceMutations<TWrite>,
		IPartControlActions {}
