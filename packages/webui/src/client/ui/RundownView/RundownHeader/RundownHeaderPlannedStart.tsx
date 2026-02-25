import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'

export function RundownHeaderPlannedStart({ playlist }: { playlist: DBRundownPlaylist }): JSX.Element | null {
	const { t } = useTranslation()
	const expectedStart = PlaylistTiming.getExpectedStart(playlist.timing)

	if (expectedStart == null) return null

	return (
		<div className="rundown-header__endtimes">
			<Countdown label={t('Plan. Start')} time={expectedStart} />
		</div>
	)
}
