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
	playlist: DBRundownPlaylist
	simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)
	const planned =
		expectedDuration != null ? RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, true, true) : null

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
				playlist.startedPlayback != null
					? now - playlist.startedPlayback
					: (timingDurations.asDisplayedPlaylistDuration ?? 0)
			estDuration = elapsed + remaining
		}
	}

	const estimated =
		estDuration != null ? RundownUtils.formatDiffToTimecode(estDuration, false, true, true, true, true) : null

	if (!planned && !estimated) return null

	return (
		<div className="rundown-header__show-timers-endtimes">
			{planned ? (
				<Countdown label={t('Plan. Dur')} className="rundown-header__show-timers-countdown">
					{planned}
				</Countdown>
			) : null}
			{!simplified && estimated ? (
				<Countdown label={t('Est. Dur')} className="rundown-header__show-timers-countdown">
					{estimated}
				</Countdown>
			) : null}
		</div>
	)
}
