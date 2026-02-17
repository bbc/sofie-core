import ClassNames from 'classnames'
import { NavLink } from 'react-router-dom'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownLayoutRundownHeader } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import Navbar from 'react-bootstrap/Navbar'
import { RundownContextMenu, RundownHeaderContextMenuTrigger, RundownHamburgerButton } from './RundownContextMenu'
import { useTranslation } from 'react-i18next'
import { TimeOfDay } from '../RundownTiming/TimeOfDay'
import { CurrentPartOrSegmentRemaining } from '../RundownTiming/CurrentPartOrSegmentRemaining'
import { RundownHeaderTimers } from '../RundownHeader_old/RundownHeaderTimers'
import { FreezeFrameIcon } from '../../../lib/ui/icons/freezeFrame'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { PieceInstances, PartInstances } from '../../../collections/index'
import { useTiming, TimingTickResolution, TimingDataResolution } from '../RundownTiming/withTiming'
import './RundownHeader.scss'

interface IRundownHeaderProps {
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
	currentRundown: Rundown | undefined
	studio: UIStudio
	rundownIds: RundownId[]
	firstRundown: Rundown | undefined
	onActivate?: (isRehearsal: boolean) => void
	inActiveRundownView?: boolean
	layout: RundownLayoutRundownHeader | undefined
}

export function RundownHeader({ playlist, studio, firstRundown }: IRundownHeaderProps): JSX.Element {
	const { t } = useTranslation()

	return (
		<>
			<RundownContextMenu playlist={playlist} studio={studio} firstRundown={firstRundown} />
			<Navbar
				data-bs-theme="dark"
				fixed="top"
				expand
				className={ClassNames('rundown-header', {
					active: !!playlist.activationId,
					'not-active': !playlist.activationId,
					rehearsal: playlist.rehearsal,
				})}
			>
				<RundownHeaderContextMenuTrigger>
					<div className="rundown-header__content">
						<div className="rundown-header__left">
							<RundownHamburgerButton />
							{playlist.currentPartInfo && (
								<div className="rundown-header__timers">
									<span className="rundown-header__segment-remaining">
										<span className="rundown-header__segment-remaining__label">{t('Seg. Budg.')}</span>
										<span className="timing-clock rundown-header__segment-remaining__value">
											<CurrentPartOrSegmentRemaining
												currentPartInstanceId={playlist.currentPartInfo.partInstanceId}
												heavyClassName="overtime"
												preferSegmentTime={true}
											/>
										</span>
									</span>
									<span className="rundown-header__onair-remaining">
										<span className="rundown-header__onair-remaining__label">{t('On Air')}</span>
										<span className="timing-clock rundown-header__onair-remaining__value">
											<CurrentPartOrSegmentRemaining
												currentPartInstanceId={playlist.currentPartInfo.partInstanceId}
												heavyClassName="overtime"
											/>
											<HeaderFreezeFrameIcon partInstanceId={playlist.currentPartInfo.partInstanceId} />
										</span>
									</span>
								</div>
							)}
						</div>

						<div className="rundown-header__center">
							<RundownHeaderTimers tTimers={playlist.tTimers} />
							<TimeOfDay />
						</div>

						<div className="rundown-header__right">
							<NavLink to="/" title={t('Exit')} className="rundown-header__close-btn">
								<CoreIcon.NrkClose />
							</NavLink>
						</div>
					</div>
				</RundownHeaderContextMenuTrigger>
			</Navbar>
		</>
	)
}

function HeaderFreezeFrameIcon({ partInstanceId }: { partInstanceId: PartInstanceId }) {
	const timingDurations = useTiming(TimingTickResolution.Synced, TimingDataResolution.Synced)

	const freezeFrameIcon = useTracker(
		() => {
			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) return null

			// We use the exact display duration from the timing context just like VTSourceRenderer does.
			// Fallback to static displayDuration or expectedDuration if timing context is unavailable.
			const partDisplayDuration =
				(timingDurations.partDisplayDurations && timingDurations.partDisplayDurations[partInstanceId as any]) ??
				partInstance.part.displayDuration ??
				partInstance.part.expectedDuration ??
				0

			const partDuration = timingDurations.partDurations
				? timingDurations.partDurations[partInstanceId as any]
				: partDisplayDuration

			const pieceInstances = PieceInstances.find({ partInstanceId }).fetch()

			for (const pieceInstance of pieceInstances) {
				const piece = pieceInstance.piece
				if (piece.virtual) continue

				const content = piece.content as VTContent | undefined
				if (!content || content.loop || content.sourceDuration === undefined) {
					continue
				}

				const seek = content.seek || 0
				const renderedInPoint = typeof piece.enable.start === 'number' ? piece.enable.start : 0
				const pieceDuration = content.sourceDuration - seek

				const isAutoNext = partInstance.part.autoNext

				if (
					(isAutoNext && renderedInPoint + pieceDuration < partDuration) ||
					(!isAutoNext && Math.abs(renderedInPoint + pieceDuration - partDisplayDuration) > 500)
				) {
					console.log('HeaderFreezeFrameIcon: showing icon!', {
						pieceDuration,
						partDuration,
						partDisplayDuration,
						difference: renderedInPoint + pieceDuration - partDisplayDuration,
						isAutoNext,
					})
					return <FreezeFrameIcon className="freeze-frame-icon" />
				} else {
					console.log('HeaderFreezeFrameIcon: NOT showing icon', {
						pieceDuration,
						partDuration,
						partDisplayDuration,
						difference: renderedInPoint + pieceDuration - partDisplayDuration,
						isAutoNext,
					})
				}
			}
			return null
		},
		[partInstanceId, timingDurations.partDisplayDurations, timingDurations.partDurations],
		null
	)

	return freezeFrameIcon
}
