import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useTranslation } from 'react-i18next'
import { Countdown } from './Countdown'
import { useTiming } from '../RundownTiming/withTiming'

export function RundownHeaderExpectedEnd({ playlist }: { playlist: DBRundownPlaylist }): JSX.Element | null {
	const { t } = useTranslation()
	const timingDurations = useTiming()

	const expectedEnd = PlaylistTiming.getExpectedEnd(playlist.timing)

	const now = timingDurations.currentTime ?? Date.now()

	// Calculate Est. End by summing partExpectedDurations for all parts after the current one.
	// Both partStartsAt and partExpectedDurations use PartInstanceId keys, so they match.
	let estEnd: number | null = null
	const currentPartInstanceId = playlist.currentPartInfo?.partInstanceId
	const partStartsAt = timingDurations.partStartsAt
	const partExpectedDurations = timingDurations.partExpectedDurations

	if (currentPartInstanceId && partStartsAt && partExpectedDurations) {
		const currentKey = unprotectString(currentPartInstanceId)
		const currentStartsAt = partStartsAt[currentKey]

		if (currentStartsAt != null) {
			let remainingDuration = 0
			for (const [partId, startsAt] of Object.entries<number>(partStartsAt)) {
				if (startsAt > currentStartsAt) {
					remainingDuration += partExpectedDurations[partId] ?? 0
				}
			}
			if (remainingDuration > 0) {
				estEnd = now + remainingDuration
			}
		}
	}

	if (!expectedEnd && !estEnd) return null

	return (
		<div className="rundown-header__endtimes">
			{expectedEnd ? <Countdown label={t('Plan. End')} time={expectedEnd} /> : null}
			{estEnd ? <Countdown label={t('Est. End')} time={estEnd} /> : null}
		</div>
	)
}
