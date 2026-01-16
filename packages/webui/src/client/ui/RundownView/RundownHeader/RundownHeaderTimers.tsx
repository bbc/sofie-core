import React from 'react'
import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown'
import classNames from 'classnames'

interface IProps {
	tTimers: [RundownTTimer, RundownTTimer, RundownTTimer]
}

export const RundownHeaderTimers: React.FC<IProps> = ({ tTimers }) => {
	useTiming()

	// TODO: Remove this mock data once verified
	const mockTimers = React.useMemo<[RundownTTimer, RundownTTimer, RundownTTimer]>(() => {
		const now = Date.now()
		return [
			{
				index: 1,
				label: 'Timer 1',
				mode: { type: 'freeRun', startTime: now - 60000 },
			},
			{
				index: 2,
				label: 'Timer 2',
				mode: { type: 'countdown', startTime: now, duration: 300000, pauseTime: null, stopAtZero: false },
			},
			{
				index: 3,
				label: 'Timer 3',
				mode: { type: 'countdown', startTime: now - 10000, duration: 5000, pauseTime: null, stopAtZero: true },
			},
		]
	}, [])

	tTimers = mockTimers

	const hasActiveTimers = tTimers.some((t) => t.mode)

	if (!hasActiveTimers) return null

	return (
		<div className="rundown-header-timers">
			{tTimers.map((timer) => (
				<SingleTimer key={timer.index} timer={timer} />
			))}
		</div>
	)
}

interface ISingleTimerProps {
	timer: RundownTTimer
}

function SingleTimer({ timer }: ISingleTimerProps) {
	if (!timer.mode) return null

	const now = Date.now()

	return (
		<div className="rundown-header-timer">
			<span className="timer-label">{timer.label}</span>
			<span className={classNames('timer-value', {})}>{formatTimeStr(timer, now)}</span>
		</div>
	)
}

function formatTimeStr(timer: RundownTTimer, now: number) {
	if (timer.mode!.type === 'freeRun') {
		const startTime = timer.mode!.startTime
		const diff = now - startTime
		return RundownUtils.formatDiffToTimecode(diff, false, false, true, false, true)
	} else if (timer.mode!.type === 'countdown') {
		const endTime = timer.mode!.startTime + timer.mode!.duration
		let diff = endTime - now

		if (timer.mode!.stopAtZero && diff < 0) {
			diff = 0
		}

		return RundownUtils.formatDiffToTimecode(diff, false, false, true, false, true)
	}
}
