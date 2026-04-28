import {
	PlannedEndComponent,
	TimeToPlannedEndComponent,
	TimeSincePlannedEndComponent,
} from '../../../lib/Components/CounterComponents'
import { useTiming } from '../../RundownView/RundownTiming/withTiming.js'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { getCurrentTime } from '../../../lib/systemTime.js'
import { useTranslation } from 'react-i18next'
import { OverUnderChip } from '../../../lib/Components/OverUnderChip.js'

export interface DirectorScreenTopProps {
	playlist: DBRundownPlaylist
}

export function DirectorScreenTop({ playlist }: Readonly<DirectorScreenTopProps>): JSX.Element {
	const timingDurations = useTiming()
	const { t } = useTranslation()

	const now = timingDurations.currentTime ?? getCurrentTime()
	const overUnderClock = getPlaylistTimingDiff(playlist, timingDurations) ?? 0
	const rehearsalInProgress = Boolean(playlist.rehearsal && playlist.startedPlayback)

	const estimatedEnd = PlaylistTiming.getEstimatedEnd(
		playlist.timing,
		now,
		timingDurations.remainingPlaylistDuration,
		playlist.startedPlayback
	)

	const remainingDuration = PlaylistTiming.getRemainingDuration(
		playlist.timing,
		now,
		timingDurations.remainingPlaylistDuration,
		playlist.startedPlayback
	)

	return (
		<>
			<div className="director-screen__top">
				{estimatedEnd !== undefined ? (
					<div className="director-screen__top__planned-end">
						<div>
							<PlannedEndComponent value={estimatedEnd} />
						</div>
						{rehearsalInProgress ? t('Rehearsal end') : t('Expected end') }
					</div>
				) : null}

				{/* Countdown to an end (planned or rehearsal) */}
				{remainingDuration !== undefined && remainingDuration >= 0 ? (
					<div className="director-screen__top__time-to director-screen__top__planned-container director-screen__top__center">
						<div>
							<TimeToPlannedEndComponent value={remainingDuration} />
						</div>
						<span className="director-screen__top__planned-to director-screen__top__center">
							{rehearsalInProgress
								? t('Time to rehearsal end')
								: t('Time to end')}
						</span>
					</div>
				) : null}

				{/* Count up past an end (planned or rehearsal) */}
				{remainingDuration !== undefined && remainingDuration < 0 ? (
					<div className="director-screen__top__planned-container director-screen__top__center">
						<div>
							<TimeSincePlannedEndComponent value={remainingDuration} />
						</div>
						<span className="director-screen__top__planned-since director-screen__top__center">
							{rehearsalInProgress
								? t('Time since rehearsal end')
								: 
									 t('Time since end')
									}
						</span>
					</div>
				) : null}
				<div className="director-screen__top__spacer"></div>
			</div>
			<OverUnderChip className="screen-timing-clock over-under-chip--overlay" valueMs={overUnderClock} />
		</>
	)
}
