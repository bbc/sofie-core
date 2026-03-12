import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'

export function RundownHeaderExpectedEnd({
	playlist,
	simplified,
}: {
	playlist: DBRundownPlaylist
	simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const expectedEnd = PlaylistTiming.getExpectedEnd(playlist.timing)
	const now = timingDurations.currentTime ?? Date.now()

	// Use remainingPlaylistDuration which includes current part's remaining time
	const estEnd =
		timingDurations.remainingPlaylistDuration != null && timingDurations.remainingPlaylistDuration > 0
			? now + timingDurations.remainingPlaylistDuration
			: null

	if (!expectedEnd && !estEnd) return null

	return (
		<div className="rundown-header__show-timers-endtimes">
			{expectedEnd ? (
				<Countdown label={t('Plan. End')} time={expectedEnd} className="rundown-header__show-timers-countdown" />
			) : null}
			{!simplified && estEnd ? (
				<Countdown label={t('Est. End')} time={estEnd} className="rundown-header__show-timers-countdown" />
			) : null}
		</div>
	)
}
