import { UserAction } from '../userAction'
import { IMeteorCall } from '../api/methods'
import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { ClientAPI } from '../api/client'
import { MongoAsyncReadOnlyCollection } from '../collections/lib'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { LoggerInstanceFixed } from '@sofie-automation/corelib/dist/logging'
import { IBaseFilterLink } from '@sofie-automation/blueprints-integration'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReactivePlaylistActionContext } from './actionFactory'
import { TFunction } from 'i18next'

export interface TriggersContext {
	readonly MeteorCall: IMeteorCall

	readonly logger: LoggerInstanceFixed

	readonly isClient: boolean

	readonly AdLibActions: MongoAsyncReadOnlyCollection<AdLibAction>
	readonly AdLibPieces: MongoAsyncReadOnlyCollection<AdLibPiece>
	readonly Parts: MongoAsyncReadOnlyCollection<DBPart>
	readonly RundownBaselineAdLibActions: MongoAsyncReadOnlyCollection<RundownBaselineAdLibAction>
	readonly RundownBaselineAdLibPieces: MongoAsyncReadOnlyCollection<RundownBaselineAdLibItem>
	readonly RundownPlaylists: MongoAsyncReadOnlyCollection<DBRundownPlaylist>
	readonly Rundowns: MongoAsyncReadOnlyCollection<DBRundown>
	readonly Segments: MongoAsyncReadOnlyCollection<DBSegment>

	hashSingleUseToken(token: string): string

	doUserAction<Result>(
		_t: TFunction,
		userEvent: string,
		_action: UserAction,
		fcn: (event: string, timeStamp: Time) => Promise<ClientAPI.ClientResponse<Result>>,
		callback?: (err: any, res?: Result) => void | boolean,
		_okMessage?: string
	): void

	memoizedIsolatedAutorun<TArgs extends any[], TRes>(
		fnc: (...args: TArgs) => Promise<TRes>,
		functionName: string,
		...params: TArgs
	): Promise<TRes>

	createContextForRundownPlaylistChain(
		_studioId: StudioId,
		_filterChain: IBaseFilterLink[]
	): Promise<ReactivePlaylistActionContext | undefined>
}
