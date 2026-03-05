import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown'
import { getRemainingDurationFromCurrentPart } from './remainingDuration'

export function RundownHeaderDurations({
	playlist,
	simplified,
}: {
	readonly playlist: DBRundownPlaylist
	readonly simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)

	const now = timingDurations.currentTime ?? Date.now()
	const currentPartInstanceId = playlist.currentPartInfo?.partInstanceId

	let estDuration: number | null = null
	if (currentPartInstanceId && timingDurations.partStartsAt && timingDurations.partExpectedDurations) {
		const remaining = getRemainingDurationFromCurrentPart(
			currentPartInstanceId,
			timingDurations.partStartsAt,
			timingDurations.partExpectedDurations
		)
		if (remaining != null) {
			const elapsed =
				playlist.startedPlayback == null
					? (timingDurations.asDisplayedPlaylistDuration ?? 0)
					: now - playlist.startedPlayback
			estDuration = elapsed + remaining
		}
	}

	if (expectedDuration == null && estDuration == null) return null

	return (
		<div className="rundown-header__show-timers-endtimes">
			{expectedDuration != null ? (
				<Countdown label={t('Plan. Dur')} className="rundown-header__show-timers-countdown" ms={expectedDuration}>
					{RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, true, true)}
				</Countdown>
			) : null}
			{!simplified && estDuration != null ? (
				<Countdown label={t('Est. Dur')} className="rundown-header__show-timers-countdown" ms={estDuration}>
					{RundownUtils.formatDiffToTimecode(estDuration, false, true, true, true, true)}
				</Countdown>
			) : null}
		</div>
	)
}
