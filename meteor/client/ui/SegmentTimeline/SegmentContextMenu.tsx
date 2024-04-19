import * as React from 'react'
import Escape from './../../lib/Escape'
import { withTranslation } from 'react-i18next'
import { ContextMenu, MenuItem } from '@jstarpl/react-contextmenu'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'
import { IContextMenuContext } from '../RundownView'
import { PartUi, SegmentUi } from './SegmentTimelineContainer'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { i18nTranslator } from '../i18n'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { MeteorCall } from '../../../lib/api/methods'
import { PartExtended } from '../../../lib/Rundown'
import { CoreUserEditingDefinition } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { UserAction, doUserAction } from '../../../lib/clientUserAction'

interface IProps {
	onSetNext: (part: DBPart | undefined, e: any, offset?: number, take?: boolean) => void
	onSetNextSegment: (segmentId: SegmentId, e: any) => void
	onQueueNextSegment: (segmentId: SegmentId | null, e: any) => void
	playlist?: DBRundownPlaylist
	studioMode: boolean
	contextMenuContext: IContextMenuContext | null
	enablePlayFromAnywhere: boolean
}
interface IState {}

export const SegmentContextMenu = withTranslation()(
	class SegmentContextMenu extends React.Component<Translated<IProps>, IState> {
		constructor(props: Translated<IProps>) {
			super(props)
		}

		render(): JSX.Element | null {
			const { t } = this.props

			if (!this.props.studioMode || !this.props.playlist || !this.props.playlist.activationId) return null

			const part = this.getPartFromContext()
			const segment = this.getSegmentFromContext()
			const timecode = this.getTimePosition()
			const startsAt = this.getPartStartsAt()

			const isCurrentPart =
				(part && this.props.playlist && part.instance._id === this.props.playlist.currentPartInfo?.partInstanceId) ||
				undefined

			const canSetAsNext = !!this.props.playlist?.activationId

			if (segment?.orphaned === SegmentOrphanedReason.SCRATCHPAD) return null

			return (
				<Escape to="document">
					<ContextMenu id="segment-timeline-context-menu">
						{part && timecode === null && (
							<>
								<MenuItem
									onClick={(e) => this.props.onSetNextSegment(part.instance.segmentId, e)}
									disabled={isCurrentPart || !canSetAsNext}
								>
									<span dangerouslySetInnerHTML={{ __html: t('Set segment as <strong>Next</strong>') }}></span>
								</MenuItem>
								{part.instance.segmentId !== this.props.playlist.queuedSegmentId ? (
									<MenuItem
										onClick={(e) => this.props.onQueueNextSegment(part.instance.segmentId, e)}
										disabled={!canSetAsNext}
									>
										<span>{t('Queue segment')}</span>
									</MenuItem>
								) : (
									<MenuItem onClick={(e) => this.props.onQueueNextSegment(null, e)} disabled={!canSetAsNext}>
										<span>{t('Clear queued segment')}</span>
									</MenuItem>
								)}
								{segment &&
									this.renderUserEditOperations(segment.userEdits, (e, userEdit) =>
										this.onDoSegmentUserOperation(userEdit, segment, e)
									)}
								<hr />
							</>
						)}
						{part && !part.instance.part.invalid && timecode !== null && (
							<>
								<MenuItem
									onClick={(e) => this.props.onSetNext(part.instance.part, e)}
									disabled={!!part.instance.orphaned || !canSetAsNext}
								>
									<span dangerouslySetInnerHTML={{ __html: t('Set this part as <strong>Next</strong>') }}></span>
									{startsAt !== null &&
										'\u00a0(' + RundownUtils.formatTimeToShortTime(Math.floor(startsAt / 1000) * 1000) + ')'}
								</MenuItem>
								{startsAt !== null && part && this.props.enablePlayFromAnywhere ? (
									<>
										{/* <MenuItem
											onClick={(e) => this.onSetAsNextFromHere(part.instance.part, e)}
											disabled={isCurrentPart || !!part.instance.orphaned || !canSetAsNext}
										>
											<span dangerouslySetInnerHTML={{ __html: t('Set <strong>Next</strong> Here') }}></span> (
											{RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
										</MenuItem> */}
										<MenuItem
											onClick={(e) => this.onPlayFromHere(part.instance.part, e)}
											disabled={!!part.instance.orphaned || !canSetAsNext}
										>
											<span>{t('Play from Here')}</span> (
											{RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
										</MenuItem>
									</>
								) : null}
								{this.renderUserEditOperations(part.instance.part.userEdits, (e, userEdit) =>
									this.onDoPartUserOperation(part, userEdit, segment, e)
								)}
							</>
						)}
					</ContextMenu>
				</Escape>
			)
		}

		private renderUserEditOperations(
			userEdits: CoreUserEditingDefinition[] | undefined,
			execute: (e: any, userEdit: CoreUserEditingDefinition) => void
		) {
			if (!userEdits || userEdits.length === 0) return null

			return (
				<>
					<hr />
					{userEdits.map((userEdit, i) => {
						return (
							<MenuItem key={`${userEdit.id}_${i}`} onClick={(e) => execute(e, userEdit)}>
								<span>{translateMessage(userEdit.label, i18nTranslator)}</span>
							</MenuItem>
						)
					})}
				</>
			)
		}

		getSegmentFromContext = (): SegmentUi | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.segment) {
				return this.props.contextMenuContext.segment
			}

			return null
		}

		getPartFromContext = (): PartUi | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.part) {
				return this.props.contextMenuContext.part
			} else {
				return null
			}
		}

		// private onSetAsNextFromHere = (part: DBPart, e) => {
		// 	const offset = this.getTimePosition()
		// 	this.props.onSetNext(part, e, offset || 0)
		// }

		private onPlayFromHere = (part: DBPart, e: React.MouseEvent | React.TouchEvent) => {
			const offset = this.getTimePosition()
			this.props.onSetNext(part, e, offset || 0, true)
		}

		private getPartStartsAt = (): number | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.partStartsAt !== undefined) {
				return this.props.contextMenuContext.partStartsAt
			}
			return null
		}

		private getTimePosition = (): number | null => {
			let offset = 0
			if (this.props.contextMenuContext && this.props.contextMenuContext.partDocumentOffset) {
				const left = this.props.contextMenuContext.partDocumentOffset.left || 0
				const timeScale = this.props.contextMenuContext.timeScale || 1
				const menuPosition = this.props.contextMenuContext.mousePosition || { left }
				offset = (menuPosition.left - left) / timeScale
				return offset
			}
			return null
		}

		private onDoPartUserOperation(
			part: PartExtended,
			userEdit: CoreUserEditingDefinition,
			segment: SegmentUi | null,
			e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement, MouseEvent>
		) {
			// TODO: move this to the parent level.

			const { t } = this.props
			if (/*this.state.studioMode &&*/ part) {
				doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
					MeteorCall.userAction.executeUserChangeOperation(
						e,
						ts,
						part.instance.rundownId,
						{
							segmentExternalId: segment?.externalId,
							partExternalId: part.instance.part.externalId,
							pieceExternalId: undefined,
						},
						{
							id: userEdit.id,
							// TODO: define for non-click types
						}
					)
				)
			}
		}

		private onDoSegmentUserOperation(
			userEdit: CoreUserEditingDefinition,
			segment: SegmentUi,
			e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement, MouseEvent>
		) {
			// TODO: move this to the parent level.

			const { t } = this.props
			if (/*this.state.studioMode &&*/ segment) {
				doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
					MeteorCall.userAction.executeUserChangeOperation(
						e,
						ts,
						segment.rundownId,
						{
							segmentExternalId: segment.externalId,
							partExternalId: undefined,
							pieceExternalId: undefined,
						},
						{
							id: userEdit.id,
							// TODO: define for non-click types
						}
					)
				)
			}
		}
	}
)
