import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown'

export function RundownHeaderDurations({ playlist }: { playlist: DBRundownPlaylist }): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)
	const planned =
		expectedDuration != null ? RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, true, true) : null

	const remainingMs = timingDurations.remainingPlaylistDuration
	const startedMs = playlist.startedPlayback
	const estDuration =
		remainingMs != null && startedMs != null
			? (timingDurations.currentTime ?? Date.now()) - startedMs + remainingMs
			: null
	const estimated =
		estDuration != null ? RundownUtils.formatDiffToTimecode(estDuration, false, true, true, true, true) : null

	if (!planned && !estimated) return null

	return (
		<div className="rundown-header__endtimes">
			{planned ? <Countdown label={t('Plan. Dur')}>{planned}</Countdown> : null}
			{estimated ? <Countdown label={t('Est. Dur')}>{estimated}</Countdown> : null}
		</div>
	)
}
