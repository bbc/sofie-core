import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import {
	DBRundownPlaylist,
	QuickLoopMarker,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { assertNever, literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WebSocketTopicBase, WebSocketTopic, CollectionObserver } from '../wsHandler'
import { SelectedPartInstances, PartInstancesHandler } from '../collections/partInstancesHandler'
import { PlaylistHandler } from '../collections/playlistHandler'
import { ShowStyleBaseExt, ShowStyleBaseHandler } from '../collections/showStyleBaseHandler'
import { calculateCurrentSegmentTiming } from './helpers/segmentTiming'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartsHandler } from '../collections/partsHandler'
import _ = require('underscore')
import { calculateCurrentPartTiming } from './helpers/partTiming'
import { SelectedPieceInstances, PieceInstancesHandler, PieceInstanceMin } from '../collections/pieceInstancesHandler'
import { toPieceStatus } from './helpers/pieceStatus'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { SegmentHandler } from '../collections/segmentHandler'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { SegmentsHandler } from '../collections/segmentsHandler'
import { normalizeArray } from '@sofie-automation/corelib/dist/lib'
import {
	PartStatus,
	CurrentPartStatus,
	CurrentSegment,
	ActivePlaylistEvent,
	ActivePlaylistTimingMode,
	ActivePlaylistQuickLoop,
	QuickLoopMarker as QuickLoopMarkerStatus,
	QuickLoopMarkerType as QuickLoopMarkerStatusType,
} from '@sofie-automation/live-status-gateway-api'

const THROTTLE_PERIOD_MS = 100

export class ActivePlaylistTopic
	extends WebSocketTopicBase
	implements
		WebSocketTopic,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<ShowStyleBaseExt>,
		CollectionObserver<SelectedPartInstances>,
		CollectionObserver<DBPart[]>,
		CollectionObserver<SelectedPieceInstances>,
		CollectionObserver<DBSegment>
{
	public observerName = ActivePlaylistTopic.name
	private _activePlaylist: DBRundownPlaylist | undefined
	private _currentPartInstance: DBPartInstance | undefined
	private _nextPartInstance: DBPartInstance | undefined
	private _firstInstanceInSegmentPlayout: DBPartInstance | undefined
	private _partInstancesInCurrentSegment: DBPartInstance[] = []
	private _partsBySegmentId: Record<string, DBPart[]> = {}
	private _partsById: Record<string, DBPart | undefined> = {}
	private _segmentsById: Record<string, DBSegment | undefined> = {}
	private _pieceInstancesInCurrentPartInstance: PieceInstanceMin[] | undefined
	private _pieceInstancesInNextPartInstance: PieceInstanceMin[] | undefined
	private _showStyleBaseExt: ShowStyleBaseExt | undefined
	private _currentSegment: DBSegment | undefined
	private throttledSendStatusToAll: () => void

	constructor(logger: Logger) {
		super(ActivePlaylistTopic.name, logger)
		this.throttledSendStatusToAll = _.throttle(this.sendStatusToAll.bind(this), THROTTLE_PERIOD_MS, {
			leading: false,
			trailing: true,
		})
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus([ws])
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		if (this.isDataInconsistent()) {
			// data is inconsistent, let's wait
			return
		}

		const currentPart = this._currentPartInstance ? this._currentPartInstance.part : null
		const nextPart = this._nextPartInstance ? this._nextPartInstance.part : null

		const message = this._activePlaylist
			? literal<ActivePlaylistEvent>({
					event: 'activePlaylist',
					id: unprotectString(this._activePlaylist._id),
					name: this._activePlaylist.name,
					rundownIds: this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r)),
					currentPart:
						this._currentPartInstance && currentPart
							? literal<CurrentPartStatus>({
									id: unprotectString(currentPart._id),
									name: currentPart.title,
									autoNext: currentPart.autoNext,
									segmentId: unprotectString(currentPart.segmentId),
									timing: calculateCurrentPartTiming(
										this._currentPartInstance,
										this._partInstancesInCurrentSegment
									),
									pieces:
										this._pieceInstancesInCurrentPartInstance?.map((piece) =>
											toPieceStatus(piece, this._showStyleBaseExt)
										) ?? [],
									publicData: currentPart.publicData,
							  })
							: null,
					currentSegment:
						this._currentPartInstance && currentPart && this._currentSegment
							? literal<CurrentSegment>({
									id: unprotectString(currentPart.segmentId),
									timing: calculateCurrentSegmentTiming(
										this._currentSegment,
										this._currentPartInstance,
										this._firstInstanceInSegmentPlayout,
										this._partInstancesInCurrentSegment,
										this._partsBySegmentId[unprotectString(currentPart.segmentId)] ?? []
									),
							  })
							: null,
					nextPart: nextPart
						? literal<PartStatus>({
								id: unprotectString(nextPart._id),
								name: nextPart.title,
								autoNext: nextPart.autoNext,
								segmentId: unprotectString(nextPart.segmentId),
								pieces:
									this._pieceInstancesInNextPartInstance?.map((piece) =>
										toPieceStatus(piece, this._showStyleBaseExt)
									) ?? [],
								publicData: nextPart.publicData,
						  })
						: null,
					quickLoop: this.transformQuickLoopStatus(),
					publicData: this._activePlaylist.publicData,
					timing: {
						timingMode: translatePlaylistTimingType(this._activePlaylist.timing.type),
						startedPlayback: this._activePlaylist.startedPlayback,
						expectedDurationMs: this._activePlaylist.timing.expectedDuration,
						expectedStart:
							this._activePlaylist.timing.type !== PlaylistTimingType.None
								? this._activePlaylist.timing.expectedStart
								: undefined,
						expectedEnd:
							this._activePlaylist.timing.type !== PlaylistTimingType.None
								? this._activePlaylist.timing.expectedEnd
								: undefined,
					},
			  })
			: literal<ActivePlaylistEvent>({
					event: 'activePlaylist',
					id: null,
					name: '',
					rundownIds: [],
					currentPart: null,
					currentSegment: null,
					nextPart: null,
					quickLoop: undefined,
					publicData: undefined,
					timing: {
						timingMode: ActivePlaylistTimingMode.NONE,
					},
			  })

		this.sendMessage(subscribers, message)
	}

	private transformQuickLoopStatus(): ActivePlaylistQuickLoop | undefined {
		if (!this._activePlaylist) return

		const quickLoopProps = this._activePlaylist.quickLoop
		if (!quickLoopProps) return undefined

		return {
			locked: quickLoopProps.locked,
			running: quickLoopProps.running,
			start: this.transformQuickLoopMarkerStatus(quickLoopProps.start),
			end: this.transformQuickLoopMarkerStatus(quickLoopProps.end),
		}
	}

	private transformQuickLoopMarkerStatus(marker: QuickLoopMarker | undefined): QuickLoopMarkerStatus | undefined {
		if (!marker) return undefined

		switch (marker.type) {
			case QuickLoopMarkerType.PLAYLIST:
				return {
					markerType: QuickLoopMarkerStatusType.PLAYLIST,
					rundownId: undefined,
					segmentId: undefined,
					partId: undefined,
				}
			case QuickLoopMarkerType.RUNDOWN:
				return {
					markerType: QuickLoopMarkerStatusType.RUNDOWN,
					rundownId: unprotectString(marker.id),
					segmentId: undefined,
					partId: undefined,
				}
			case QuickLoopMarkerType.SEGMENT: {
				const segment = this._segmentsById[unprotectString(marker.id)]

				return {
					markerType: QuickLoopMarkerStatusType.SEGMENT,
					rundownId: unprotectString(segment?.rundownId),
					segmentId: unprotectString(marker.id),
					partId: undefined,
				}
			}
			case QuickLoopMarkerType.PART: {
				const part = this._partsById[unprotectString(marker.id)]

				return {
					markerType: QuickLoopMarkerStatusType.PART,
					rundownId: unprotectString(part?.rundownId),
					segmentId: unprotectString(part?.segmentId),
					partId: unprotectString(marker.id),
				}
			}
			default:
				assertNever(marker)
				return undefined
		}
	}

	private isDataInconsistent() {
		return (
			this._currentPartInstance?._id !== this._activePlaylist?.currentPartInfo?.partInstanceId ||
			this._currentPartInstance?.segmentId !== this._currentSegment?._id ||
			this._nextPartInstance?._id !== this._activePlaylist?.nextPartInfo?.partInstanceId ||
			(this._pieceInstancesInCurrentPartInstance?.[0] &&
				this._pieceInstancesInCurrentPartInstance?.[0].partInstanceId !== this._currentPartInstance?._id) ||
			(this._pieceInstancesInNextPartInstance?.[0] &&
				this._pieceInstancesInNextPartInstance?.[0].partInstanceId !== this._nextPartInstance?._id)
		)
	}

	async update(
		source: string,
		data:
			| DBRundownPlaylist
			| ShowStyleBaseExt
			| SelectedPartInstances
			| DBPart[]
			| SelectedPieceInstances
			| DBSegment
			| DBSegment[]
			| undefined
	): Promise<void> {
		let hasAnythingChanged = false
		switch (source) {
			case PlaylistHandler.name: {
				const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
				this.logUpdateReceived(
					'playlist',
					source,
					`rundownPlaylistId ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
				)
				this._activePlaylist = unprotectString(rundownPlaylist?.activationId) ? rundownPlaylist : undefined
				hasAnythingChanged = true
				break
			}
			case ShowStyleBaseHandler.name: {
				const showStyleBaseExt = data ? (data as ShowStyleBaseExt) : undefined
				this.logUpdateReceived('showStyleBase', source)
				this._showStyleBaseExt = showStyleBaseExt
				hasAnythingChanged = true
				break
			}
			case PartInstancesHandler.name: {
				const partInstances = data as SelectedPartInstances
				this.logUpdateReceived(
					'partInstances',
					source,
					`${partInstances.inCurrentSegment.length} instances in segment`
				)
				this._currentPartInstance = partInstances.current
				this._nextPartInstance = partInstances.next
				this._firstInstanceInSegmentPlayout = partInstances.firstInSegmentPlayout
				this._partInstancesInCurrentSegment = partInstances.inCurrentSegment
				hasAnythingChanged = true
				break
			}
			case PartsHandler.name: {
				this._partsById = normalizeArray(data as DBPart[], '_id')
				this._partsBySegmentId = _.groupBy(data as DBPart[], 'segmentId')
				this.logUpdateReceived('parts', source)
				hasAnythingChanged = true // TODO: can this be smarter?
				break
			}
			case PieceInstancesHandler.name: {
				const pieceInstances = data as SelectedPieceInstances
				this.logUpdateReceived('pieceInstances', source)
				if (
					pieceInstances.currentPartInstance !== this._pieceInstancesInCurrentPartInstance ||
					pieceInstances.nextPartInstance !== this._pieceInstancesInNextPartInstance
				) {
					hasAnythingChanged = true
				}
				this._pieceInstancesInCurrentPartInstance = pieceInstances.currentPartInstance
				this._pieceInstancesInNextPartInstance = pieceInstances.nextPartInstance
				break
			}
			case SegmentHandler.name: {
				this._currentSegment = data as DBSegment
				this.logUpdateReceived('segment', source)
				hasAnythingChanged = true
				break
			}
			case SegmentsHandler.name: {
				this._segmentsById = normalizeArray(data as DBSegment[], '_id')
				this.logUpdateReceived('segments', source)
				hasAnythingChanged = true // TODO: can this be smarter?
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		if (hasAnythingChanged) {
			this.throttledSendStatusToAll()
		}
	}

	private sendStatusToAll() {
		this.sendStatus(this._subscribers)
	}
}

function translatePlaylistTimingType(type: PlaylistTimingType): ActivePlaylistTimingMode {
	switch (type) {
		case PlaylistTimingType.None:
			return ActivePlaylistTimingMode.NONE
		case PlaylistTimingType.BackTime:
			return ActivePlaylistTimingMode.BACK_MINUS_TIME
		case PlaylistTimingType.ForwardTime:
			return ActivePlaylistTimingMode.FORWARD_MINUS_TIME
		default:
			assertNever(type)
			// Cast and return the value anyway, so that the application works
			return type as any as ActivePlaylistTimingMode
	}
}
