import { useState } from 'react'
import ClassNames from 'classnames'
import { NavLink } from 'react-router-dom'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownLayoutRundownHeader } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import Navbar from 'react-bootstrap/Navbar'
import { RundownContextMenu, RundownHeaderContextMenuTrigger, RundownHamburgerButton } from './RundownContextMenu'
import { useTranslation } from 'react-i18next'
import { TimeOfDay } from '../RundownTiming/TimeOfDay'
import { CurrentPartOrSegmentRemaining } from '../RundownHeader/CurrentPartOrSegmentRemaining'
import { RundownHeaderTimers } from './RundownHeaderTimers'

import { RundownHeaderTimingDisplay } from './RundownHeaderTimingDisplay'
import { RundownHeaderPlannedStart } from './RundownHeaderPlannedStart'
import { RundownHeaderDurations } from './RundownHeaderDurations'
import { RundownHeaderExpectedEnd } from './RundownHeaderExpectedEnd'
import { HeaderFreezeFrameIcon } from './HeaderFreezeFrameIcon'
import './RundownHeader.scss'

interface IRundownHeaderProps {
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
	currentRundown: Rundown | undefined
	studio: UIStudio
	rundownIds: RundownId[]
	firstRundown: Rundown | undefined
	rundownCount: number
	onActivate?: (isRehearsal: boolean) => void
	inActiveRundownView?: boolean
	layout: RundownLayoutRundownHeader | undefined
}

export function RundownHeader({ playlist, studio, firstRundown }: IRundownHeaderProps): JSX.Element {
	const { t } = useTranslation()
	const [simplified, setSimplified] = useState(false)

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
								<div className="rundown-header__onair">
									<span className="rundown-header__timers-segment-remaining">
										<span className="rundown-header__timers-segment-remaining__label">{t('Seg. Budg.')}</span>
										<CurrentPartOrSegmentRemaining
											currentPartInstanceId={playlist.currentPartInfo.partInstanceId}
											heavyClassName="overtime"
											preferSegmentTime={true}
										/>
									</span>
									<span className="rundown-header__timers-onair-remaining">
										<span className="rundown-header__timers-onair-remaining__label">{t('On Air')}</span>
										<CurrentPartOrSegmentRemaining
											currentPartInstanceId={playlist.currentPartInfo.partInstanceId}
											heavyClassName="overtime"
										/>
										<HeaderFreezeFrameIcon partInstanceId={playlist.currentPartInfo.partInstanceId} />
									</span>
								</div>
							)}
						</div>

						<div className="rundown-header__clocks">
							<RundownHeaderTimers tTimers={playlist.tTimers} />
							<RundownHeaderTimingDisplay playlist={playlist} />
							<div className="rundown-header__clocks-clock-group">
								<TimeOfDay className="rundown-header__clocks-time-now" />
								<span className="rundown-header__clocks-playlist-name">{playlist.name}</span>
							</div>
						</div>

						<div className="rundown-header__right">
							<div className="rundown-header__show-timers" onClick={() => setSimplified((s) => !s)}>
								<RundownHeaderPlannedStart playlist={playlist} simplified={simplified} />
								<RundownHeaderDurations playlist={playlist} simplified={simplified} />
								<RundownHeaderExpectedEnd playlist={playlist} simplified={simplified} />
							</div>
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
