import React from 'react'
import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown'
import { calculateTTimerDiff } from '../../../lib/tTimerUtils'
import classNames from 'classnames'
import { getCurrentTime } from '../../../lib/systemTime'
import { Countdown } from './Countdown'

interface IProps {
	tTimers: [RundownTTimer, RundownTTimer, RundownTTimer]
}

export const RundownHeaderTimers: React.FC<IProps> = ({ tTimers }) => {
	useTiming()

	const activeTimers = tTimers.filter((t) => t.mode)
	if (activeTimers.length == 0) return null

	return (
		<div className="rundown-header__clocks-timers">
			{activeTimers.map((timer) => (
				<SingleTimer key={timer.index} timer={timer} />
			))}
		</div>
	)
}

interface ISingleTimerProps {
	timer: RundownTTimer
}

function SingleTimer({ timer }: Readonly<ISingleTimerProps>) {
	const now = getCurrentTime()
	const mode = timer.mode
	if (!mode) return null
	const isRunning = !!timer.state && !timer.state.paused

	const diff = calculateTTimerDiff(timer, now)
	const timeStr = RundownUtils.formatDiffToTimecode(Math.abs(diff), false, true, true, false, true)
	const parts = timeStr.split(':')

	const timerSign = diff >= 0 ? '+' : '-'
	const isCountingDown = mode.type === 'countdown' && diff < 0 && isRunning

	return (
		<Countdown
			label={timer.label}
			className={classNames('rundown-header__clocks-timers__timer', {
				'countdown--counter': mode.type !== 'timeOfDay',
				'countdown--timeofday': mode.type === 'timeOfDay',
				'rundown-header__clocks-timers__timer__countdown': mode.type === 'countdown',
				'rundown-header__clocks-timers__timer__freeRun': mode.type === 'freeRun',
				'rundown-header__clocks-timers__timer__isRunning': isRunning,
				'rundown-header__clocks-timers__timer__isPaused': !isRunning,
				'rundown-header__clocks-timers__timer__isCountingDown': mode.type === 'countdown' && isCountingDown,
				'rundown-header__clocks-timers__timer__isCountingUp': mode.type === 'countdown' && !isCountingDown,
				'rundown-header__clocks-timers__timer__isComplete':
					mode.type === 'countdown' && timer.state !== null && diff <= 0,
			})}
		>
			<span className="rundown-header__clocks-timers__timer__sign">{timerSign}</span>
			{(() => {
				let cursor = 0
				return parts.map((p, i) => {
					const key = `${timer.index}-${cursor}-${p}`
					cursor += p.length + 1
					return (
						<React.Fragment key={key}>
					<span
						className={classNames('rundown-header__clocks-timers__timer__part', {
							'rundown-header__clocks-timers__timer__part--dimmed': Math.abs(diff) < [3600000, 60000, 1][i],
						})}
					>
						{p}
					</span>
					{i < parts.length - 1 && <span className="rundown-header__clocks-timers__timer__separator">:</span>}
						</React.Fragment>
					)
				})
			})()}
		</Countdown>
	)
}
