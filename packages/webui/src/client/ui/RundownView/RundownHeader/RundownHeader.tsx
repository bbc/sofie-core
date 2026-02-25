import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ClassNames from 'classnames'
import { NavLink } from 'react-router-dom'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownLayoutRundownHeader } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import Navbar from 'react-bootstrap/Navbar'
import { RundownContextMenu, RundownHeaderContextMenuTrigger, RundownHamburgerButton } from './RundownContextMenu'
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
										<CurrentPartOrSegmentRemaining
											currentPartInstanceId={playlist.currentPartInfo.partInstanceId}
											heavyClassName="overtime"
											preferSegmentTime={true}
										/>
									</span>
									<span className="rundown-header__onair-remaining">
										<span className="rundown-header__onair-remaining__label">{t('On Air')}</span>
										<CurrentPartOrSegmentRemaining
											currentPartInstanceId={playlist.currentPartInfo.partInstanceId}
											heavyClassName="overtime"
										/>
										<HeaderFreezeFrameIcon partInstanceId={playlist.currentPartInfo.partInstanceId} />
									</span>
								</div>
							)}
						</div>

						<div className="rundown-header__center">
							<RundownHeaderTimers tTimers={playlist.tTimers} />
							<RundownHeaderTimingDisplay playlist={playlist} />
							<TimeOfDay />
						</div>

						<div className="rundown-header__right">
							<RundownHeaderPlannedStart playlist={playlist} />
							<RundownHeaderDurations playlist={playlist} />
							<RundownHeaderExpectedEnd playlist={playlist} />
							<NavLink to="/" title={t('Exit')} className="rundown-header__close-btn">
								<FontAwesomeIcon icon="close" size="xl" />
							</NavLink>
						</div>
					</div>
				</RundownHeaderContextMenuTrigger>
			</Navbar>
		</>
	)
}
