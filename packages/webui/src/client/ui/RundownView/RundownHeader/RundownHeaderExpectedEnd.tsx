import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'

export function RundownHeaderExpectedEnd({
	playlist,
	simplified,
}: {
	readonly playlist: DBRundownPlaylist
	readonly simplified?: boolean
}): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	// todo: this should live with the others in client/lib/rundwownTimings.ts
	function getEstimatedEnd(
		timing: RundownPlaylistTiming,
		now: number,
		remainingPlaylistDuration?: number,
		startedPlayback?: number
	): number | undefined {
		let frontAnchor = PlaylistTiming.getExpectedStart(timing)

		if (PlaylistTiming.isPlaylistDurationTimed(timing)) {
			frontAnchor = startedPlayback ?? PlaylistTiming.getExpectedStart(timing)
		}

		return remainingPlaylistDuration !== undefined
			? Math.max(now, frontAnchor ?? now) + remainingPlaylistDuration
			: undefined
	}

	const now = timingDurations.currentTime ?? Date.now()
	const expectedEnd = PlaylistTiming.getExpectedEnd(playlist.timing, playlist.startedPlayback)
	const estEnd = getEstimatedEnd(
		playlist.timing,
		now,
		timingDurations.remainingPlaylistDuration,
		playlist.startedPlayback
	)

	if (expectedEnd === undefined && estEnd === undefined) return null

	return (
		<div className="rundown-header__show-timers-endtimes">
			{!simplified && expectedEnd !== undefined ? (
				<Countdown label={t('Plan. End')} time={expectedEnd} className="rundown-header__show-timers-countdown" />
			) : null}
			{estEnd !== null ? (
				<Countdown label={t('Est. End')} time={estEnd} className="rundown-header__show-timers-countdown" />
			) : null}
		</div>
	)
}
