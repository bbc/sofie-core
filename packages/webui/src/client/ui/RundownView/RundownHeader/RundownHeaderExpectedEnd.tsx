import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'
import { getRemainingDurationFromCurrentPart } from './remainingDuration'

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

	let estEnd: number | null = null
	const currentPartInstanceId = playlist.currentPartInfo?.partInstanceId
	if (currentPartInstanceId && timingDurations.partStartsAt && timingDurations.partExpectedDurations) {
		const remaining = getRemainingDurationFromCurrentPart(
			currentPartInstanceId,
			timingDurations.partStartsAt,
			timingDurations.partExpectedDurations
		)
		if (remaining != null && remaining > 0) {
			estEnd = now + remaining
		}
	}

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
