import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { logger } from '../../../logging'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	AdLibActionId,
	BucketAdLibId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Match, check } from '../../../../lib/check'
import { PlaylistsRestAPI } from '../../../../lib/api/rest/v1'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../../lib/api/client'
import {
	AdLibActions,
	AdLibPieces,
	BucketAdLibs,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
} from '../../../collections'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ServerClientAPI } from '../../client'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { getCurrentTime } from '../../../../lib/lib'
import { TriggerReloadDataResponse } from '../../../../lib/api/userActions'
import { ServerRundownAPI } from '../../rundown'
import { triggerWriteAccess } from '../../../security/lib/securityVerify'

class PlaylistsServerAPI implements PlaylistsRestAPI {
	constructor(private context: ServerAPIContext) {}

	async getAllRundownPlaylists(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const rundownPlaylists = (await RundownPlaylists.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<DBRundownPlaylist, '_id'>
		>
		return ClientAPI.responseSuccess(
			rundownPlaylists.map((rundownPlaylist) => ({ id: unprotectString(rundownPlaylist._id) }))
		)
	}

	async activate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				rehearsal,
			}
		)
	}
	async deactivate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.DeactivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async executeAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string | null
	): Promise<ClientAPI.ClientResponse<object>> {
		const baselineAdLibPiece = RundownBaselineAdLibPieces.findOneAsync(adLibId as PieceId, {
			projection: { _id: 1 },
		})
		const segmentAdLibPiece = AdLibPieces.findOneAsync(adLibId as PieceId, { projection: { _id: 1 } })
		const bucketAdLibPiece = BucketAdLibs.findOneAsync(adLibId as BucketAdLibId, { projection: { _id: 1 } })
		const [baselineAdLibDoc, segmentAdLibDoc, bucketAdLibDoc, adLibAction, baselineAdLibAction] = await Promise.all(
			[
				baselineAdLibPiece,
				segmentAdLibPiece,
				bucketAdLibPiece,
				AdLibActions.findOneAsync(adLibId as AdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
				RundownBaselineAdLibActions.findOneAsync(adLibId as RundownBaselineAdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
			]
		)
		const adLibActionDoc = adLibAction ?? baselineAdLibAction
		const regularAdLibDoc = baselineAdLibDoc ?? segmentAdLibDoc ?? bucketAdLibDoc
		if (regularAdLibDoc) {
			// This is an AdLib Piece
			const pieceType = baselineAdLibDoc ? 'baseline' : segmentAdLibDoc ? 'normal' : 'bucket'
			const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId, {
				projection: { currentPartInfo: 1 },
			})
			if (!rundownPlaylist)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist does not exist`),
						UserErrorMessage.RundownPlaylistNotFound
					),
					404
				)
			if (rundownPlaylist.currentPartInfo === null)
				return ClientAPI.responseError(
					UserError.from(Error(`No active Part in ${rundownPlaylistId}`), UserErrorMessage.PartNotFound),
					412
				)

			const result = await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this.context.getMethodContext(connection),
				event,
				getCurrentTime(),
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.AdlibPieceStart,
				{
					playlistId: rundownPlaylistId,
					adLibPieceId: regularAdLibDoc._id,
					partInstanceId: rundownPlaylist.currentPartInfo.partInstanceId,
					pieceType,
				}
			)
			if (ClientAPI.isClientResponseError(result)) return result
			return ClientAPI.responseSuccess({})
		} else if (adLibActionDoc) {
			// This is an AdLib Action
			const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId, {
				projection: { currentPartInfo: 1, activationId: 1 },
			})

			if (!rundownPlaylist)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist does not exist`),
						UserErrorMessage.RundownPlaylistNotFound
					),
					404
				)
			if (!rundownPlaylist.activationId)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist ${rundownPlaylistId} is not currently active`),
						UserErrorMessage.InactiveRundown
					),
					412
				)
			if (!rundownPlaylist.currentPartInfo)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist ${rundownPlaylistId} must be playing`),
						UserErrorMessage.NoCurrentPart
					),
					412
				)

			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this.context.getMethodContext(connection),
				event,
				getCurrentTime(),
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.ExecuteAction,
				{
					playlistId: rundownPlaylistId,
					actionDocId: adLibActionDoc._id,
					actionId: adLibActionDoc.actionId,
					userData: adLibActionDoc.userData,
					triggerMode: triggerMode ? triggerMode : undefined,
				}
			)
		} else {
			return ClientAPI.responseError(
				UserError.from(new Error(`No adLib with Id ${adLibId}`), UserErrorMessage.AdlibNotFound),
				412
			)
		}
	}
	async moveNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: delta,
				segmentDelta: 0,
			}
		)
	}
	async moveNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: 0,
				segmentDelta: delta,
			}
		)
	}

	async reloadPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<object>> {
		return ServerClientAPI.runUserActionInLogForPlaylist<object>(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			'reloadPlaylist',
			[rundownPlaylistId],
			async (access) => {
				const reloadResponse = await ServerRundownAPI.resyncRundownPlaylist(access)
				const success = !reloadResponse.rundownsResponses.reduce((missing, rundownsResponse) => {
					return missing || rundownsResponse.response === TriggerReloadDataResponse.MISSING
				}, false)
				return success
					? {}
					: UserError.from(
							new Error(`Failed to reload playlist ${rundownPlaylistId}`),
							UserErrorMessage.InternalError
					  )
			}
		)
	}

	async resetPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async setNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(segmentId, String)
			},
			StudioJobs.SetNextSegment,
			{
				playlistId: rundownPlaylistId,
				nextSegmentId: segmentId,
			}
		)
	}
	async setNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partId, String)
			},
			StudioJobs.SetNextPart,
			{
				playlistId: rundownPlaylistId,
				nextPartId: partId,
			}
		)
	}

	async take(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | undefined
	): Promise<ClientAPI.ClientResponse<void>> {
		triggerWriteAccess()
		const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId)
		if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId: fromPartInstanceId ?? rundownPlaylist.currentPartInfo?.partInstanceId ?? null,
			}
		)
	}

	async clearSourceLayer(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		const rundownPlaylist = await RundownPlaylists.findOneAsync(rundownPlaylistId)
		if (!rundownPlaylist)
			return ClientAPI.responseError(
				UserError.from(
					Error(`Rundown playlist ${rundownPlaylistId} does not exist`),
					UserErrorMessage.RundownPlaylistNotFound
				),
				412
			)
		if (!rundownPlaylist.currentPartInfo?.partInstanceId || !rundownPlaylist.activationId)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Rundown playlist ${rundownPlaylistId} is not currently active`),
					UserErrorMessage.InactiveRundown
				),
				412
			)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(sourceLayerId, String)
			},
			StudioJobs.StopPiecesOnSourceLayers,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: rundownPlaylist.currentPartInfo.partInstanceId,
				sourceLayerIds: [sourceLayerId],
			}
		)
	}

	async recallStickyPiece(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(sourceLayerId, String)
			},
			StudioJobs.StartStickyPieceOnSourceLayer,
			{
				playlistId: rundownPlaylistId,
				sourceLayerId,
			}
		)
	}
}

class PlaylistsAPIFactory implements APIFactory<PlaylistsRestAPI> {
	createServerAPI(context: ServerAPIContext): PlaylistsRestAPI {
		return new PlaylistsServerAPI(context)
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<PlaylistsRestAPI>): void {
	const playlistsAPIFactory = new PlaylistsAPIFactory()

	registerRoute<never, never, Array<{ id: string }>>(
		'get',
		'/playlists',
		new Map(),
		playlistsAPIFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API GET: playlists`)
			return await serverAPI.getAllRundownPlaylists(connection, event)
		}
	)

	registerRoute<{ playlistId: string }, { rehearsal: boolean }, void>(
		'put',
		'/playlists/:playlistId/activate',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.RundownAlreadyActive]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const rehearsal = body.rehearsal
			logger.info(`API PUT: activate ${rundownPlaylistId} - ${rehearsal ? 'rehearsal' : 'live'}`)

			check(rundownPlaylistId, String)
			return await serverAPI.activate(connection, event, rundownPlaylistId, rehearsal)
		}
	)

	registerRoute<{ playlistId: string }, never, void>(
		'put',
		'/playlists/:playlistId/deactivate',
		new Map([[404, [UserErrorMessage.RundownPlaylistNotFound]]]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			logger.info(`API PUT: deactivate ${rundownPlaylistId}`)

			check(rundownPlaylistId, String)
			return await serverAPI.deactivate(connection, event, rundownPlaylistId)
		}
	)

	registerRoute<{ playlistId: string }, { adLibId: string; actionType?: string }, object>(
		'post',
		'/playlists/:playlistId/execute-adlib',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.InactiveRundown, UserErrorMessage.NoCurrentPart, UserErrorMessage.AdlibNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const adLibId = protectString<AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId>(
				body.adLibId
			)
			const actionTypeObj = body
			const triggerMode = actionTypeObj ? (actionTypeObj as { actionType: string }).actionType : undefined
			logger.info(`API POST: execute-adlib ${rundownPlaylistId} ${adLibId} - triggerMode: ${triggerMode}`)

			check(adLibId, String)
			check(rundownPlaylistId, String)

			return await serverAPI.executeAdLib(connection, event, rundownPlaylistId, adLibId, triggerMode)
		}
	)

	registerRoute<{ playlistId: string }, { delta: number }, PartId | null>(
		'post',
		'/playlists/:playlistId/move-next-part',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const delta = body.delta
			logger.info(`API POST: move-next-part ${rundownPlaylistId} ${delta}`)

			check(rundownPlaylistId, String)
			check(delta, Number)
			return await serverAPI.moveNextPart(connection, event, rundownPlaylistId, delta)
		}
	)

	registerRoute<{ playlistId: string }, { delta: number }, PartId | null>(
		'post',
		'/playlists/:playlistId/move-next-segment',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const delta = body.delta
			logger.info(`API POST: move-next-segment ${rundownPlaylistId} ${delta}`)

			check(rundownPlaylistId, String)
			check(delta, Number)
			return await serverAPI.moveNextSegment(connection, event, rundownPlaylistId, delta)
		}
	)

	registerRoute<{ playlistId: string }, never, object>(
		'put',
		'/playlists/:playlistId/reload-playlist',
		new Map([[404, [UserErrorMessage.RundownPlaylistNotFound]]]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			logger.info(`API PUT: reload-playlist ${rundownPlaylistId}`)

			check(rundownPlaylistId, String)
			return await serverAPI.reloadPlaylist(connection, event, rundownPlaylistId)
		}
	)

	registerRoute<{ playlistId: string }, never, void>(
		'put',
		'/playlists/:playlistId/reset-playlist',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.RundownResetWhileActive]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			logger.info(`API PUT: reset-playlist ${rundownPlaylistId}`)

			check(rundownPlaylistId, String)
			return await serverAPI.resetPlaylist(connection, event, rundownPlaylistId)
		}
	)

	registerRoute<{ playlistId: string }, { partId: string }, void>(
		'put',
		'/playlists/:playlistId/set-next-part',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const partId = protectString<PartId>(body.partId)
			logger.info(`API PUT: set-next-part ${rundownPlaylistId} ${partId}`)

			check(rundownPlaylistId, String)
			check(partId, String)
			return await serverAPI.setNextPart(connection, event, rundownPlaylistId, partId)
		}
	)

	registerRoute<{ playlistId: string }, { segmentId: string }, void>(
		'put',
		'/playlists/:playlistId/set-next-segment',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const segmentId = protectString<SegmentId>(body.segmentId)
			logger.info(`API PUT: set-next-segment ${rundownPlaylistId} ${segmentId}`)

			check(rundownPlaylistId, String)
			check(segmentId, String)
			return await serverAPI.setNextSegment(connection, event, rundownPlaylistId, segmentId)
		}
	)

	registerRoute<{ playlistId: string }, { fromPartInstanceId?: string }, void>(
		'post',
		'/playlists/:playlistId/take',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.TakeNoNextPart]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const fromPartInstanceId = body.fromPartInstanceId
			logger.info(`API POST: take ${rundownPlaylistId}`)

			check(rundownPlaylistId, String)
			check(fromPartInstanceId, Match.Optional(String))
			return await serverAPI.take(connection, event, rundownPlaylistId, protectString(fromPartInstanceId))
		}
	)

	registerRoute<{ playlistId: string; sourceLayerId: string }, never, void>(
		'delete',
		'/playlists/:playlistId/sourceLayer/:sourceLayerId',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.InactiveRundown]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const playlistId = protectString<RundownPlaylistId>(params.playlistId)
			const sourceLayerId = params.sourceLayerId
			logger.info(`API DELETE: sourceLayer ${playlistId} ${sourceLayerId}`)

			check(playlistId, String)
			check(sourceLayerId, String)
			return await serverAPI.clearSourceLayer(connection, event, playlistId, sourceLayerId)
		}
	)

	registerRoute<{ playlistId: string; sourceLayerId: string }, never, void>(
		'post',
		'/playlists/:playlistId/sourceLayer/:sourceLayerId/sticky',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.InactiveRundown]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const playlistId = protectString<RundownPlaylistId>(params.playlistId)
			const sourceLayerId = params.sourceLayerId
			logger.info(`API POST: sourceLayer recallSticky ${playlistId} ${sourceLayerId}`)

			check(playlistId, String)
			check(sourceLayerId, String)
			return await serverAPI.recallStickyPiece(connection, event, playlistId, sourceLayerId)
		}
	)
}