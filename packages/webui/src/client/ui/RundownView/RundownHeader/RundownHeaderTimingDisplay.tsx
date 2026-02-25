import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { useTiming } from '../RundownTiming/withTiming'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming'
import { RundownUtils } from '../../../lib/rundown'

export interface IRundownHeaderTimingDisplayProps {
	playlist: DBRundownPlaylist
}

export function RundownHeaderTimingDisplay({ playlist }: IRundownHeaderTimingDisplayProps): JSX.Element | null {
	const timingDurations = useTiming()

	const overUnderClock = getPlaylistTimingDiff(playlist, timingDurations) ?? 0
	const timeStr = RundownUtils.formatDiffToTimecode(Math.abs(overUnderClock), false, false, true, true, true)
	const isUnder = overUnderClock <= 0

	return (
		<div className="rundown-header__timing-display">
			<span
				className={`rundown-header__diff ${isUnder ? 'rundown-header__diff--under' : 'rundown-header__diff--over'}`}
			>
				<span className="rundown-header__diff__label">{isUnder ? 'Under' : 'Over'}</span>
				<span className="rundown-header__diff__chip">
					{isUnder ? '−' : '+'}
					{timeStr}
				</span>
			</span>
		</div>
	)
}
