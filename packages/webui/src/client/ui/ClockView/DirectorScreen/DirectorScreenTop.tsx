import {
	PlannedEndComponent,
	TimeToPlannedEndComponent,
	TimeSincePlannedEndComponent,
} from '../../../lib/Components/CounterComponents'
import { useTiming } from '../../RundownView/RundownTiming/withTiming.js'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { getCurrentTime } from '../../../lib/systemTime.js'
import { useTranslation } from 'react-i18next'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { OverUnderChip } from '../../../lib/Components/OverUnderChip.js'

export interface DirectorScreenTopProps {
	playlist: DBRundownPlaylist
}

export function DirectorScreenTop({ playlist }: Readonly<DirectorScreenTopProps>): JSX.Element {
	const timingDurations = useTiming()

	const rehearsalInProgress = Boolean(playlist.rehearsal && playlist.startedPlayback)

	const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing) || 0
	const expectedEnd = PlaylistTiming.getExpectedEnd(playlist.timing, playlist.startedPlayback)
	const now = timingDurations.currentTime ?? getCurrentTime()

	const overUnderClock = getPlaylistTimingDiff(playlist, timingDurations) ?? 0

	let currentEndTarget = undefined
	if (rehearsalInProgress && expectedDuration > 0) {
		currentEndTarget = playlist.startedPlayback! + expectedDuration
	} else if (expectedEnd) {
		currentEndTarget = expectedEnd
	}

	let countDownToEnd = undefined
	if (currentEndTarget !== undefined) {
		countDownToEnd = currentEndTarget - now
	}

	const { t } = useTranslation()

	return (
		<>
			<div className="director-screen__top">
				{currentEndTarget !== undefined ? (
					<div className="director-screen__top__planned-end">
						<div>
							<PlannedEndComponent value={currentEndTarget} />
						</div>
						{rehearsalInProgress ? t('Rehearsal end') : t('Planned end')}
					</div>
				) : null}

				{/* Countdown to an end (planned or rehearsal) */}
				{countDownToEnd !== undefined && countDownToEnd >= 0 ? (
					<div className="director-screen__top__time-to director-screen__top__planned-container director-screen__top__center">
						<div>
							<TimeToPlannedEndComponent value={countDownToEnd} />
						</div>
						<span className="director-screen__top__planned-to director-screen__top__center">
							{rehearsalInProgress ? t('Time to rehearsal end') : t('Time to planned end')}
						</span>
					</div>
				) : null}

				{/* Count up past an end (planned or rehearsal) */}
				{countDownToEnd !== undefined && countDownToEnd < 0 ? (
					<div className="director-screen__top__planned-container director-screen__top__center">
						<div>
							<TimeSincePlannedEndComponent value={countDownToEnd} />
						</div>
						<span className="director-screen__top__planned-since director-screen__top__center">
							{rehearsalInProgress ? t('Time since rehearsal end') : t('Time since planned end')}
						</span>
					</div>
				) : null}
				<div className="director-screen__top__spacer"></div>
			</div>
			<OverUnderChip className="screen-timing-clock over-under-chip--overlay" valueMs={overUnderClock} />
		</>
	)
}
