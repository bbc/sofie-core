import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { IAdLibListItem } from './AdLibListItem'
import ClassNames from 'classnames'
import {
	DragSource,
	DropTarget,
	ConnectDragSource,
	ConnectDropTarget,
	DragSourceMonitor,
	DropTargetMonitor,
	ConnectDragPreview,
} from 'react-dnd'
import { faBars } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import {
	ISourceLayer,
	PieceLifespan,
	IBlueprintActionTriggerMode,
	SomeContent,
} from '@sofie-automation/blueprints-integration'
import { PubSub } from '../../../lib/api/pubsub'
import { doUserAction, getEventTimestamp, UserAction } from '../../../lib/clientUserAction'
import { NotificationCenter, Notification, NoticeLevel } from '../../../lib/notifications/notifications'
import { literal, unprotectString, partial, protectString } from '../../../lib/lib'
import { contextMenuHoldToDisplayTime, UserAgentPointer, USER_AGENT_POINTER_PROPERTY } from '../../lib/lib'
import { IDashboardPanelTrackedProps } from './DashboardPanel'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { Bucket } from '../../../lib/collections/Buckets'
import { Events as MOSEvents } from '../../lib/data/mos/plugin-support'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../lib/api/methods'
import { DragDropItemTypes } from '../DragDropItemTypes'
import { BucketPieceButton, IBucketPieceDropResult } from './BucketPieceButton'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import update from 'immutability-helper'
import { PartInstance, DBPartInstance } from '../../../lib/collections/PartInstances'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { RundownUtils } from '../../lib/rundown'
import { BucketAdLibItem, BucketAdLibActionUi, isAdLibAction, isAdLib, BucketAdLibUi } from './RundownViewBuckets'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import RundownViewEventBus, {
	RundownViewEvents,
	RevealInShelfEvent,
	ToggleShelfDropzoneEvent,
} from '../../../lib/api/triggers/RundownViewEventBus'
import { setShelfContextMenuContext, ContextType } from './ShelfContextMenu'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../i18n'
import {
	AdLibPieceUi,
	getNextPieceInstancesGrouped,
	getUnfinishedPieceInstancesGrouped,
	isAdLibDisplayedAsOnAir,
	isAdLibOnAir,
} from '../../lib/shelf'
import { MongoFieldSpecifierOnes } from '@sofie-automation/corelib/dist/mongo'
import { BucketAdLibActions, BucketAdLibs, PartInstances, Rundowns } from '../../collections'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { UIShowStyleBase } from '../../../lib/api/showStyles'
import { UIStudio } from '../../../lib/api/studios'
import { UIStudios } from '../Collections'
import {
	AdLibActionId,
	BucketId,
	PieceId,
	ShowStyleBaseId,
	ShowStyleVariantId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylistCollectionUtil } from '../../../lib/collections/rundownPlaylistUtil'
import { TFunction } from 'react-i18next'

interface IBucketPanelDragObject {
	id: BucketId
	size: {
		width: number
	}
	originalIndex: number
}

type IBucketPanelDropResult = IBucketPieceDropResult

const bucketSource = {
	beginDrag(props: IBucketPanelProps, _monitor: DragSourceMonitor, component: any) {
		const size = {
			width: 0,
			height: 0,
		}

		if (component._panel) {
			const { width, height } = (component._panel as HTMLDivElement).getBoundingClientRect()
			size.width = width
			size.height = height
		}

		return {
			id: props.bucket._id,
			originalIndex: props.findBucket(props.bucket._id).index,
			size,
		}
	},

	endDrag(props: IBucketPanelProps, monitor: DragSourceMonitor<IBucketPanelDragObject, IBucketPanelDropResult>) {
		const { id: droppedId, originalIndex } = monitor.getItem()
		const didDrop = monitor.didDrop()

		if (!didDrop) {
			props.moveBucket(droppedId, originalIndex)
		} else {
			const dropResult = monitor.getDropResult()
			if (!dropResult) return

			const { index: newIndex } = dropResult
			props.onBucketReorder(droppedId, newIndex, originalIndex)
		}
	},
}

const bucketTarget = {
	canDrop(_props: IBucketPanelProps, _monitor: DropTargetMonitor) {
		return true
	},

	hover(props: IBucketPanelProps, monitor: DropTargetMonitor<IBucketPanelDragObject>, component: any) {
		if (monitor.getItemType() === DragDropItemTypes.BUCKET) {
			const { id: draggedId, size: draggedSize } = monitor.getItem()
			const overId = props.bucket._id
			let farEnough = true
			let rect = {
				width: 0,
				height: 0,
				left: 0,
				top: 0,
			}
			if (draggedId !== overId) {
				if (
					component &&
					component.decoratedRef &&
					component.decoratedRef.current &&
					component.decoratedRef.current._panel
				) {
					rect = (component.decoratedRef.current._panel as HTMLDivElement).getBoundingClientRect()
				}
				const draggedPosition = monitor.getClientOffset()
				if (draggedPosition) {
					if (rect.width - (draggedPosition.x - rect.left) >= draggedSize.width) {
						farEnough = false
					}
				}
				if (farEnough) {
					const { index: overIndex } = props.findBucket(overId)
					props.moveBucket(draggedId, overIndex)
				}
			}
		}
	},

	drop(props: IBucketPanelProps, monitor: DropTargetMonitor<{ bucketId: BucketId }>) {
		const { index } = props.findBucket(props.bucket._id)

		return {
			index,
			bucketId: props.bucket._id,
			action:
				monitor.getItemType() === DragDropItemTypes.BUCKET
					? 'reorder'
					: monitor.getItemType() === DragDropItemTypes.BUCKET_ADLIB_PIECE
					? monitor.getItem().bucketId === props.bucket._id
						? 'reorder'
						: 'move'
					: undefined,
		}
	},
}

interface IState {
	dropActive: boolean
	dropFrameActive: string | null
	bucketName: string
	adLibPieces: BucketAdLibItem[]
	singleClickMode: boolean
}

export function actionToAdLibPieceUi(
	action: BucketAdLibAction,
	sourceLayers: SourceLayers,
	outputLayers: OutputLayers
): BucketAdLibActionUi {
	let sourceLayerId = ''
	let outputLayerId = ''
	let content: SomeContent = {}
	if (RundownUtils.isAdlibActionContent(action.display)) {
		sourceLayerId = action.display.sourceLayerId
		outputLayerId = action.display.outputLayerId
		content = {
			...action.display.content,
		}
	}

	return literal<BucketAdLibActionUi>({
		_id: protectString(`${action._id}`),
		name:
			typeof action.display.label === 'string'
				? action.display.label
				: translateMessage(action.display.label, i18nTranslator),
		isAction: true,
		expectedDuration: 0,
		externalId: action.externalId || unprotectString(action._id),
		rundownId: protectString(''), // value doesn't matter
		bucketId: action.bucketId,
		showStyleBaseId: action.showStyleBaseId,
		showStyleVariantId: action.showStyleVariantId,
		studioId: action.studioId,
		sourceLayer: sourceLayers[sourceLayerId],
		outputLayer: outputLayers[outputLayerId],
		sourceLayerId,
		outputLayerId,
		_rank: action.display._rank || 0,
		content: content,
		adlibAction: action,
		tags: action.display.tags,
		currentPieceTags: action.display.currentPieceTags,
		nextPieceTags: action.display.nextPieceTags,
		lifespan: PieceLifespan.WithinPart, // value doesn't matter
		expectedPackages: action.expectedPackages,
		uniquenessId: action.uniquenessId,
	})
}

export interface IBucketPanelProps {
	bucket: Bucket
	playlist: RundownPlaylist
	showStyleBase: UIShowStyleBase
	shouldQueue: boolean
	editableName?: boolean
	selectedPiece: BucketAdLibActionUi | BucketAdLibUi | IAdLibListItem | PieceUi | undefined
	editedPiece: PieceId | undefined
	onNameChanged: (e: any, newName: string) => void
	moveBucket: (id: BucketId, atIndex: number) => void
	findBucket: (id: BucketId) => { bucket: Bucket | undefined; index: number }
	onBucketReorder: (draggedId: BucketId, newIndex: number, oldIndex: number) => void
	onSelectAdlib
	onAdLibContext: (args: { contextBucket: Bucket; contextBucketAdLib: BucketAdLibItem }, callback: () => void) => void
	onPieceNameRename: () => void
	extFrameDropZones: { _id: string; url: string }[]
}

export interface IBucketPanelTrackedProps extends IDashboardPanelTrackedProps {
	adLibPieces: BucketAdLibItem[]
	studio: UIStudio
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantId: ShowStyleVariantId
	outputLayers: OutputLayers
	sourceLayers: SourceLayers
}

interface BucketSourceCollectedProps {
	connectDragSource: ConnectDragSource
	connectDragPreview: ConnectDragPreview
	isDragging: boolean
}

interface BucketTargetCollectedProps {
	connectDropTarget: ConnectDropTarget
}

export const BucketPanel = translateWithTracker<Translated<IBucketPanelProps>, IState, IBucketPanelTrackedProps>(
	(props: Translated<IBucketPanelProps>) => {
		let showStyleBaseId: ShowStyleBaseId | undefined = undefined
		let showStyleVariantId: ShowStyleVariantId | undefined = undefined

		const selectedPart = props.playlist.currentPartInfo?.partInstanceId || props.playlist.nextPartInfo?.partInstanceId
		if (selectedPart) {
			const part = PartInstances.findOne(selectedPart, {
				fields: literal<MongoFieldSpecifierOnes<DBPartInstance>>({
					rundownId: 1,
					//@ts-expect-error deep property
					'part._id': 1,
				}),
			}) as Pick<PartInstance, 'rundownId'> | undefined
			if (part) {
				const rundown = Rundowns.findOne(part.rundownId, {
					fields: {
						showStyleBaseId: 1,
						showStyleVariantId: 1,
					},
				}) as Pick<Rundown, 'showStyleVariantId' | 'showStyleBaseId'> | undefined
				if (rundown) {
					showStyleBaseId = rundown.showStyleBaseId
					showStyleVariantId = rundown.showStyleVariantId
				}
			}
		}
		if (showStyleVariantId === undefined) {
			const rundown = RundownPlaylistCollectionUtil.getRundownsOrdered(
				props.playlist,
				{},
				{
					fields: {
						showStyleBaseId: 1,
						showStyleVariantId: 1,
					},
				}
			)[0] as Pick<Rundown, 'showStyleVariantId' | 'showStyleBaseId'> | undefined
			if (rundown) {
				showStyleBaseId = rundown.showStyleBaseId
				showStyleVariantId = rundown.showStyleVariantId
			}
		}
		if (!showStyleBaseId) throw new Meteor.Error(500, `No showStyleBaseId found for playlist ${props.playlist._id}`)
		if (!showStyleVariantId)
			throw new Meteor.Error(500, `No showStyleVariantId found for playlist ${props.playlist._id}`)

		const studio = UIStudios.findOne(props.playlist.studioId)
		if (!studio) throw new Meteor.Error(500, `No Studio found for playlist ${props.playlist._id}`)

		const tOLayers = props.showStyleBase ? props.showStyleBase.outputLayers : {}
		const tSLayers = props.showStyleBase ? props.showStyleBase.sourceLayers : {}

		const { unfinishedAdLibIds, unfinishedTags } = getUnfinishedPieceInstancesGrouped(
			props.playlist,
			props.showStyleBase
		)
		const { nextAdLibIds, nextTags } = getNextPieceInstancesGrouped(props.playlist, props.showStyleBase)
		const bucketAdLibPieces = BucketAdLibs.find({
			bucketId: props.bucket._id,
		}).fetch()
		const bucketActions = BucketAdLibActions.find({
			bucketId: props.bucket._id,
		})
			.fetch()
			.map((action) => actionToAdLibPieceUi(action, tSLayers, tOLayers))
		const allBucketItems = (bucketAdLibPieces as BucketAdLibItem[])
			.concat(bucketActions)
			.sort((a, b) => a._rank - b._rank || a.name.localeCompare(b.name))

		return literal<IBucketPanelTrackedProps>({
			adLibPieces: allBucketItems,
			studio,
			unfinishedAdLibIds,
			unfinishedTags,
			showStyleBaseId,
			showStyleVariantId,
			nextAdLibIds,
			nextTags,
			outputLayers: tOLayers,
			sourceLayers: tSLayers,
		})
	},
	(_data, props: IBucketPanelProps, nextProps: IBucketPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(
	DropTarget([DragDropItemTypes.BUCKET, DragDropItemTypes.BUCKET_ADLIB_PIECE], bucketTarget, (connect) => ({
		connectDropTarget: connect.dropTarget(),
	}))(
		DragSource(DragDropItemTypes.BUCKET, bucketSource, (connect, monitor) => ({
			connectDragSource: connect.dragSource(),
			connectDragPreview: connect.dragPreview(),
			isDragging: monitor.isDragging(),
		}))(
			class BucketPanel extends MeteorReactComponent<
				Translated<IBucketPanelProps & IBucketPanelTrackedProps> &
					BucketSourceCollectedProps &
					BucketTargetCollectedProps,
				IState
			> {
				_nameTextBox: HTMLInputElement | null = null
				_panel: HTMLDivElement | null = null

				constructor(
					props: Translated<IBucketPanelProps & IBucketPanelTrackedProps> &
						BucketSourceCollectedProps &
						BucketTargetCollectedProps
				) {
					super(props)

					this.state = {
						dropActive: false,
						dropFrameActive: null,
						bucketName: props.bucket.name,
						adLibPieces: props.adLibPieces.slice(),
						singleClickMode: false,
					}
				}

				componentDidMount(): void {
					this.subscribe(PubSub.buckets, this.props.playlist.studioId, this.props.bucket._id)
					this.subscribe(PubSub.uiBucketContentStatuses, this.props.playlist.studioId, this.props.bucket._id)
					this.subscribe(PubSub.uiStudio, this.props.playlist.studioId)
					this.autorun(() => {
						const showStyles: Array<[ShowStyleBaseId, ShowStyleVariantId]> =
							RundownPlaylistCollectionUtil.getRundownsUnordered(this.props.playlist).map((rundown) => [
								rundown.showStyleBaseId,
								rundown.showStyleVariantId,
							])
						const showStyleBases = showStyles.map((showStyle) => showStyle[0])
						const showStyleVariants = showStyles.map((showStyle) => showStyle[1])
						this.subscribe(PubSub.bucketAdLibPieces, {
							bucketId: this.props.bucket._id,
							studioId: this.props.playlist.studioId,
							showStyleVariantId: {
								$in: [null, ...showStyleVariants], // null = valid for all variants
							},
						})
						this.subscribe(PubSub.bucketAdLibActions, {
							bucketId: this.props.bucket._id,
							studioId: this.props.playlist.studioId,
							showStyleVariantId: {
								$in: [null, ...showStyleVariants], // null = valid for all variants
							},
						})
						for (const showStyleBaseId of _.uniq(showStyleBases)) {
							this.subscribe(PubSub.uiShowStyleBase, showStyleBaseId)
						}
					})

					window.addEventListener(MOSEvents.dragenter, this.onDragEnter)
					window.addEventListener(MOSEvents.dragleave, this.onDragLeave)

					RundownViewEventBus.on(RundownViewEvents.REVEAL_IN_SHELF, this.onRevealInShelf)
					RundownViewEventBus.on(RundownViewEvents.TOGGLE_SHELF_DROPZONE, this.onToggleDropFrame.bind(this))
				}

				componentDidUpdate(prevProps: IBucketPanelProps & IBucketPanelTrackedProps) {
					if (this.props.adLibPieces !== prevProps.adLibPieces) {
						this.setState({
							adLibPieces: ([] as BucketAdLibItem[]).concat(this.props.adLibPieces || []),
						})
					}

					RundownViewEventBus.off(RundownViewEvents.REVEAL_IN_SHELF, this.onRevealInShelf)
				}

				componentWillUnmount(): void {
					this._cleanUp()

					window.removeEventListener(MOSEvents.dragenter, this.onDragEnter)
					window.removeEventListener(MOSEvents.dragleave, this.onDragLeave)
					RundownViewEventBus.removeListener(RundownViewEvents.TOGGLE_SHELF_DROPZONE, this.onToggleDropFrame)
				}

				onRevealInShelf = (e: RevealInShelfEvent) => {
					const { pieceId } = e
					if (pieceId) {
						let found = false
						const index = this.state.adLibPieces.findIndex((piece) => piece._id === pieceId)
						if (index >= 0) {
							found = true
						}

						if (found) {
							Meteor.setTimeout(() => {
								const el = document.querySelector(`.dashboard-panel__panel__button[data-obj-id="${pieceId}"]`)
								if (el) {
									el.scrollIntoView({
										behavior: 'smooth',
									})
								}
							}, 100)
						}
					}
				}

				isAdLibOnAir(adLibPiece: AdLibPieceUi) {
					return isAdLibOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLibPiece)
				}

				isAdLibDisplayedAsOnAir(adLib: AdLibPieceUi) {
					return isAdLibDisplayedAsOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLib)
				}

				onDragEnter = () => {
					this.setState({
						dropActive: true,
					})
				}

				onDragLeave = () => {
					this.setState({
						dropActive: false,
					})
				}

				onClearAllSourceLayer = (sourceLayer: ISourceLayer, e: any) => {
					const { t } = this.props
					if (this.props.playlist._id && this.props.playlist.currentPartInfo) {
						const currentPartInstanceId = this.props.playlist.currentPartInfo.partInstanceId
						doUserAction(t, e, UserAction.CLEAR_SOURCELAYER, (e) =>
							MeteorCall.userAction.sourceLayerOnPartStop(
								e,
								getEventTimestamp(e),
								this.props.playlist._id,
								currentPartInstanceId,
								[sourceLayer._id]
							)
						)
					}
				}

				onToggleAdLib = (piece: BucketAdLibItem, queue: boolean, e: any, mode?: IBlueprintActionTriggerMode) => {
					const { t } = this.props

					queue = queue || this.props.shouldQueue

					if (piece.invalid) {
						NotificationCenter.push(
							new Notification(
								t('Invalid AdLib'),
								NoticeLevel.WARNING,
								t('Cannot play this AdLib because it is marked as Invalid'),
								'toggleAdLib'
							)
						)
						return
					}
					if (piece.floated) {
						NotificationCenter.push(
							new Notification(
								t('Floated AdLib'),
								NoticeLevel.WARNING,
								t('Cannot play this AdLib because it is marked as Floated'),
								'toggleAdLib'
							)
						)
						return
					}

					const sourceLayer = this.props.sourceLayers && this.props.sourceLayers[piece.sourceLayerId]

					if (queue && sourceLayer && !sourceLayer.isQueueable) {
						console.log(`Item "${piece._id}" is on sourceLayer "${piece.sourceLayerId}" that is not queueable.`)
						return
					}
					if (this.props.playlist && this.props.playlist.currentPartInfo) {
						if (isAdLibAction(piece as BucketAdLibItem)) {
							const bucketAction = piece as BucketAdLibActionUi
							doUserAction(t, e, UserAction.START_BUCKET_ADLIB, (e) =>
								MeteorCall.userAction.executeAction(
									e,
									getEventTimestamp(e),
									this.props.playlist._id,
									bucketAction.adlibAction._id,
									bucketAction.adlibAction.actionId,
									bucketAction.adlibAction.userData,
									mode?.data
								)
							)
						} else {
							if (!this.isAdLibOnAir(piece as any as AdLibPieceUi) || !(sourceLayer && sourceLayer.isClearable)) {
								const currentPartInstanceId = this.props.playlist.currentPartInfo.partInstanceId

								doUserAction(t, e, UserAction.START_BUCKET_ADLIB, (e) =>
									MeteorCall.userAction.bucketAdlibStart(
										e,
										getEventTimestamp(e),
										this.props.playlist._id,
										currentPartInstanceId,
										piece._id,
										queue
									)
								)
							} else {
								if (sourceLayer && sourceLayer.isClearable) {
									this.onClearAllSourceLayer(sourceLayer, e)
								}
							}
						}
					}
				}

				private onRenameTextBoxKeyUp = (e: KeyboardEvent) => {
					if (e.key === 'Escape') {
						this.setState(
							{
								bucketName: this.props.bucket.name,
							},
							() => {
								this._nameTextBox && this._nameTextBox.blur()
							}
						)
						e.preventDefault()
						e.stopPropagation()
						e.stopImmediatePropagation()
					} else if (e.key === 'Enter') {
						this._nameTextBox && this._nameTextBox.blur()
						e.preventDefault()
						e.stopPropagation()
						e.stopImmediatePropagation()
					}
				}

				private onRenameTextBoxBlur = (e: React.FocusEvent<HTMLInputElement>) => {
					if (!this.state.bucketName.trim()) {
						this.setState(
							{
								bucketName: this.props.bucket.name,
							},
							() => {
								this.props.onNameChanged && this.props.onNameChanged(e, this.state.bucketName)
							}
						)
					} else {
						this.props.onNameChanged && this.props.onNameChanged(e, this.state.bucketName)
					}
				}

				private onRenameTextBoxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
					this.setState({
						bucketName: e.target.value || '',
					})
				}

				private renameTextBoxFocus = (input: HTMLInputElement) => {
					input.focus()
					input.setSelectionRange(0, input.value.length)
				}

				private onRenameTextBoxShow = (ref: HTMLInputElement) => {
					if (ref && !this._nameTextBox) {
						ref.addEventListener('keyup', this.onRenameTextBoxKeyUp)
						this.renameTextBoxFocus(ref)
					}
					this._nameTextBox = ref
				}

				private moveAdLib = (id: PieceId, atIndex: number) => {
					const { piece, index } = this.findAdLib(id)

					if (piece) {
						this.setState(
							update(this.state, {
								adLibPieces: {
									$splice: [[index, 1], [atIndex, 0, piece] as any],
								},
							})
						)
					}
				}

				private findAdLib = (id: PieceId): { piece: BucketAdLibItem | undefined; index: number } => {
					const { adLibPieces: pieces } = this.state
					const piece = pieces.find((b) => b._id === id)

					return {
						piece,
						index: piece ? pieces.indexOf(piece) : -1,
					}
				}

				private onAdLibNameChanged = (e: any, piece: BucketAdLibItem, newName: string) => {
					const { t } = this.props
					if (isAdLib(piece)) {
						doUserAction(
							t,
							{ type: 'drop', timeStamp: e?.timeStamp ?? performance.now() },
							UserAction.MODIFY_BUCKET,
							(e) =>
								MeteorCall.userAction.bucketsModifyBucketAdLib(
									e,
									getEventTimestamp(e),
									piece._id,
									partial<BucketAdLib>({
										name: newName,
									})
								)
						)
					} else if (isAdLibAction(piece)) {
						doUserAction(
							t,
							{ type: 'drop', timeStamp: e?.timeStamp ?? performance.now() },
							UserAction.MODIFY_BUCKET,
							(e) =>
								MeteorCall.userAction.bucketsModifyBucketAdLibAction(
									e,
									getEventTimestamp(e),
									piece.adlibAction._id,
									partial<BucketAdLibAction>({
										//@ts-expect-error deep property
										'display.label': newName,
									})
								)
						)
					}

					this.props.onPieceNameRename()
				}

				private onAdLibReorder = (draggedId: PieceId, newIndex: number, oldIndex: number) => {
					const { t } = this.props
					if (this.props.adLibPieces) {
						const draggedOver = this.props.adLibPieces[newIndex]

						const draggedB = this.props.adLibPieces.find((b) => b._id === draggedId)

						if (draggedOver && draggedB) {
							let newRank = draggedOver._rank

							// Dragged over into first place
							if (newIndex === 0) {
								newRank = draggedOver._rank - 1
								// Dragged over into last place
							} else if (newIndex === this.props.adLibPieces.length - 1) {
								newRank = draggedOver._rank + 1
								// Last element swapped with next to last
							} else if (
								oldIndex === this.props.adLibPieces.length - 1 &&
								newIndex === this.props.adLibPieces.length - 2
							) {
								newRank = (this.props.adLibPieces[newIndex - 1]._rank + this.props.adLibPieces[newIndex]._rank) / 2
								// Dragged into any other place
							} else {
								newRank = (this.props.adLibPieces[newIndex]._rank + this.props.adLibPieces[newIndex + 1]._rank) / 2
							}

							if (isAdLib(draggedB)) {
								doUserAction(t, { type: 'drop', timeStamp: performance.now() }, UserAction.MODIFY_BUCKET, (e) =>
									MeteorCall.userAction.bucketsModifyBucketAdLib(
										e,
										getEventTimestamp(e),
										draggedB._id,
										partial<BucketAdLib>({
											_rank: newRank,
										})
									)
								)
							} else if (isAdLibAction(draggedB)) {
								doUserAction(t, { type: 'drop', timeStamp: performance.now() }, UserAction.MODIFY_BUCKET, (e) =>
									MeteorCall.userAction.bucketsModifyBucketAdLibAction(
										e,
										getEventTimestamp(e),
										draggedB.adlibAction._id,
										partial<BucketAdLibAction>({
											//@ts-expect-error deep property
											'display._rank': newRank,
										})
									)
								)
							}
						}
					}
				}

				private onAdLibMove = (draggedId: PieceId | AdLibActionId, bucketId: BucketId) => {
					const { t } = this.props
					if (this.props.adLibPieces) {
						const draggedB = this.props.adLibPieces.find((b) => b._id === draggedId)

						if (draggedB && isAdLib(draggedB)) {
							doUserAction(t, { type: 'drop', timeStamp: performance.now() }, UserAction.MODIFY_BUCKET_ADLIB, (e) =>
								MeteorCall.userAction.bucketsModifyBucketAdLib(
									e,
									getEventTimestamp(e),
									draggedB._id,
									partial<BucketAdLib>({
										bucketId,
									})
								)
							)
						} else if (draggedB && isAdLibAction(draggedB)) {
							doUserAction(t, { type: 'drop', timeStamp: performance.now() }, UserAction.MODIFY_BUCKET_ADLIB, (e) =>
								MeteorCall.userAction.bucketsModifyBucketAdLibAction(
									e,
									getEventTimestamp(e),
									draggedB.adlibAction._id,
									partial<BucketAdLibAction>({
										bucketId,
									})
								)
							)
						}
					}
				}

				private setRef = (ref: HTMLDivElement) => {
					this._panel = ref
					if (this._panel) {
						const style = window.getComputedStyle(this._panel)
						// check if a special variable is set through CSS to indicate that we shouldn't expect
						// double clicks to trigger AdLibs
						const value = style.getPropertyValue(USER_AGENT_POINTER_PROPERTY)
						if (this.state.singleClickMode !== (value === UserAgentPointer.NO_POINTER)) {
							this.setState({
								singleClickMode: value === UserAgentPointer.NO_POINTER,
							})
						}
					}
				}
				private adLibIsDisabled = (adlib: BucketAdLibItem) => {
					return (
						adlib.showStyleBaseId !== this.props.showStyleBaseId ||
						(!!adlib.showStyleVariantId && adlib.showStyleVariantId !== this.props.showStyleVariantId)
					)
				}

				private onToggleDropFrame = (e: ToggleShelfDropzoneEvent) => {
					this.setState({
						dropActive: e.display,
						dropFrameActive: e.display ? e.id : null,
					})
				}

				render(): JSX.Element | null {
					const { connectDragSource, connectDragPreview, connectDropTarget } = this.props

					if (this.props.showStyleBase) {
						// Hide duplicates;
						// Step 1: Only the first adLib found with a given externalId will be displayed,
						// adlibs with the same externalId are considered to be cariants of the same adlibs.
						const adLibPieceGroupedOnExternalIds = new Map<string, BucketAdLibItem>()
						for (const adLibPiece of this.state.adLibPieces) {
							const existingAdlib = adLibPieceGroupedOnExternalIds.get(adLibPiece.externalId)
							if (
								!existingAdlib ||
								// If the existing is disabled and we're not, we should use our one:
								(this.adLibIsDisabled(existingAdlib) && !this.adLibIsDisabled(adLibPiece))
							) {
								adLibPieceGroupedOnExternalIds.set(adLibPiece.externalId, adLibPiece)
							}
						}

						// Step 2: only the first adLib found with a given uniquenessId will be displayed:
						const uniqueAdlibs = new Map<string, BucketAdLibItem>()
						for (const adLibPiece of adLibPieceGroupedOnExternalIds.values()) {
							const uniquenessId = adLibPiece.uniquenessId ?? unprotectString(adLibPiece._id)
							const existingAdlib = uniqueAdlibs.get(uniquenessId)
							if (
								!existingAdlib ||
								// If the existing is disabled and we're not, we should use our one:
								(this.adLibIsDisabled(existingAdlib) && !this.adLibIsDisabled(adLibPiece))
							) {
								uniqueAdlibs.set(uniquenessId, adLibPiece)
							}
						}
						const adLibPieces: BucketAdLibItem[] = Array.from(uniqueAdlibs.values())

						return connectDragPreview(
							connectDropTarget(
								<div
									className={ClassNames('dashboard-panel', 'dashboard-panel__panel--bucket', {
										'dashboard-panel__panel--bucket-active': this.state.dropActive,
										'dashboard-panel__panel--sort-dragging': this.props.isDragging,
									})}
									data-bucket-id={this.props.bucket._id}
									ref={this.setRef}
								>
									{this.props.editableName ? (
										<input
											className="h4 dashboard-panel__header"
											value={this.state.bucketName}
											onChange={this.onRenameTextBoxChange}
											onBlur={this.onRenameTextBoxBlur}
											ref={this.onRenameTextBoxShow}
										/>
									) : (
										<h4 className="dashboard-panel__header">
											{connectDragSource(
												<span className="dashboard-panel__handle">
													<FontAwesomeIcon icon={faBars} />
												</span>
											)}
											&nbsp;
											{this.state.bucketName}
										</h4>
									)}
									{/*
						<FontAwesomeIcon icon={faBars} />&nbsp;

						{ filter.enableSearch &&
							<AdLibPanelToolbar
								onFilterChange={this.onFilterChange} />
						} */}
									<div className="dashboard-panel__panel">
										{adLibPieces.map((adlib: BucketAdLibItem) => (
											<ContextMenuTrigger
												id="shelf-context-menu"
												collect={() =>
													setShelfContextMenuContext({
														type: ContextType.BUCKET_ADLIB,
														details: {
															adLib: adlib,
															bucket: this.props.bucket,
															onToggle: this.onToggleAdLib,
														},
													})
												}
												renderTag="span"
												key={unprotectString(adlib._id)}
												holdToDisplay={contextMenuHoldToDisplayTime()}
											>
												<BucketPieceButton
													piece={adlib as any as IAdLibListItem}
													studio={this.props.studio}
													bucketId={adlib.bucketId}
													layer={this.props.sourceLayers[adlib.sourceLayerId]}
													outputLayer={this.props.outputLayers[adlib.outputLayerId]}
													onToggleAdLib={this.onToggleAdLib as any}
													onSelectAdLib={this.props.onSelectAdlib}
													playlist={this.props.playlist}
													isOnAir={this.isAdLibOnAir(adlib as any as AdLibPieceUi)}
													disabled={this.adLibIsDisabled(adlib)}
													findAdLib={this.findAdLib}
													moveAdLib={this.moveAdLib}
													editableName={this.props.editedPiece === adlib._id}
													onNameChanged={(e, name) => this.onAdLibNameChanged(e, adlib, name)}
													onAdLibReorder={this.onAdLibReorder}
													onAdLibMove={this.onAdLibMove}
													isSelected={
														this.props.selectedPiece &&
														RundownUtils.isAdLibPiece(this.props.selectedPiece) &&
														adlib._id === this.props.selectedPiece._id
													}
													toggleOnSingleClick={this.state.singleClickMode}
													displayStyle={PieceDisplayStyle.BUTTONS}
												>
													{adlib.name}
												</BucketPieceButton>
											</ContextMenuTrigger>
										))}
										{this.props.extFrameDropZones.map((dropZone) => (
											<DropzoneHolder
												key={dropZone._id}
												bucketId={this.props.bucket._id}
												id={dropZone._id}
												url={dropZone.url}
												hidden={this.state.dropFrameActive !== dropZone._id}
												t={this.props.t}
												showStyleBaseId={this.props.showStyleBaseId}
											/>
										))}
									</div>
								</div>
							)
						)
					}
					return null
				}
			}
		)
	)
)

interface DropzoneHolderProps {
	id: string
	bucketId: BucketId
	url: string
	hidden: boolean
	t: TFunction<'translation', undefined>
	showStyleBaseId: ShowStyleBaseId
}
const DropzoneHolder = (props: DropzoneHolderProps) => {
	let frame: HTMLIFrameElement | null = null
	let mounted = false

	const setDropzoneElement = (frameRef: HTMLIFrameElement | null) => {
		frame = frameRef
		if (frame && !mounted) {
			registerHandlers()
			mounted = true
		} else {
			unregisterHandlers()
			mounted = false
		}
	}
	const registerHandlers = () => {
		window.addEventListener('message', onMessage)
	}
	const unregisterHandlers = () => {
		window.removeEventListener('message', onMessage)
	}

	const onMessage = (event: MessageEvent) => {
		if (event.source === frame?.contentWindow) {
			if (event.data && event.data.event === 'drop') {
				RundownViewEventBus.emit(RundownViewEvents.ITEM_DROPPED, {
					id: props.id,
					bucketId: props.bucketId,
					ev: event,
				})
			}

			if (event.data && event.data.event === 'data' && event.data.data.trim().endsWith('</mos>')) {
				RundownViewEventBus.emit(RundownViewEvents.ITEM_DROPPED, {
					id: props.id,
					bucketId: props.bucketId,
					message: event.data.data,
					ev: event,
				})
			}

			if (event.data && event.data.event === 'error') {
				RundownViewEventBus.emit(RundownViewEvents.ITEM_DROPPED, {
					id: props.id,
					bucketId: props.bucketId,
					error: event.data.message,
					ev: event,
				})
			}
		}
	}

	React.useEffect(
		() => () => {
			unregisterHandlers()
		},
		[]
	)

	return (
		<div className="dropzone-panel" style={{ visibility: props.hidden ? 'hidden' : 'visible' }}>
			<iframe
				ref={setDropzoneElement}
				className="external-frame-panel__iframe"
				src={props.url}
				sandbox="allow-forms allow-popups allow-scripts allow-same-origin"
			></iframe>
		</div>
	)
}
