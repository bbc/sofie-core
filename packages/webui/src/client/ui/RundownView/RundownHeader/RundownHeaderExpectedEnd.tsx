import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'

export function RundownHeaderExpectedEnd({ playlist }: { playlist: DBRundownPlaylist }): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const expectedStart = PlaylistTiming.getExpectedStart(playlist.timing)
	const expectedEnd = PlaylistTiming.getExpectedEnd(playlist.timing)
	const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)

	const now = timingDurations.currentTime ?? Date.now()
	const estEnd =
		expectedStart != null && timingDurations.remainingPlaylistDuration != null
			? now + timingDurations.remainingPlaylistDuration
			: null

	if (!expectedEnd && !expectedDuration && !estEnd) return null

	return (
		<div className="rundown-header__endtimes">
			{expectedEnd ? <Countdown label={t('Plan. End')} time={expectedEnd} /> : null}
			{estEnd ? <Countdown label={t('Est. End')} time={estEnd} /> : null}
		</div>
	)
}
