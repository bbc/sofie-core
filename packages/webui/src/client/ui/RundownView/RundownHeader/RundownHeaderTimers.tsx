import React from 'react'
import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown'
import classNames from 'classnames'
import { getCurrentTime } from '../../../lib/systemTime'
import { Countdown } from './Countdown'
import { calculateTTimerDiff, calculateTTimerOverUnder } from '../../../lib/tTimerUtils'

interface IProps {
	tTimers: [RundownTTimer, RundownTTimer, RundownTTimer]
}

export const RundownHeaderTimers: React.FC<IProps> = ({ tTimers }) => {
	useTiming()

	if (!tTimers?.length) {
		return null
	}

	const activeTimers = tTimers.filter((t) => t.mode).slice(0, 2)

	return (
		<div className="rundown-header__clocks-timers">
			{activeTimers.map((timer) => (
				<div key={timer.index} className="rundown-header__clocks-timers__row">
					<SingleTimer timer={timer} />
				</div>
			))}
		</div>
	)
}

interface ISingleTimerProps {
	timer: RundownTTimer
}

function SingleTimer({ timer }: Readonly<ISingleTimerProps>) {
	const now = getCurrentTime()

	const isRunning = !!timer.state && !timer.state.paused

	const diff = calculateTTimerDiff(timer, now)
	const timeStr = RundownUtils.formatDiffToTimecode(Math.abs(diff), false, true, true, false, true)
	const isCountingDown = timer.mode?.type === 'countdown' && diff < 0 && isRunning
	const overUnder = calculateTTimerOverUnder(timer, now)

	return (
		<Countdown
			label={timer.label}
			className={classNames('rundown-header__clocks-timers__timer', 'rundown-header__show-timers-countdown', {
				'countdown--counter': timer.mode!.type !== 'timeOfDay',
				'countdown--timeofday': timer.mode!.type === 'timeOfDay',
				'rundown-header__clocks-timers__timer__countdown': timer.mode!.type === 'countdown',
				'rundown-header__clocks-timers__timer__freeRun': timer.mode!.type === 'freeRun',
				'rundown-header__clocks-timers__timer__isRunning': isRunning,
				'rundown-header__clocks-timers__timer__isPaused': !isRunning,
				'rundown-header__clocks-timers__timer__isCountingDown': timer.mode!.type === 'countdown' && isCountingDown,
				'rundown-header__clocks-timers__timer__isCountingUp': timer.mode!.type === 'countdown' && !isCountingDown,
				'rundown-header__clocks-timers__timer__isComplete':
					timer.mode!.type === 'countdown' && timer.state !== null && diff <= 0,
			})}
			ms={timer.mode!.type === 'timeOfDay' ? undefined : diff}
			postfix={
				overUnder ? (
					<span
						className={classNames('rundown-header__clocks-timers__timer__over-under', {
							'rundown-header__clocks-timers__timer__over-under--over': overUnder > 0,
							'rundown-header__clocks-timers__timer__over-under--under': overUnder < 0,
						})}
					>
						{overUnder > 0 ? '+' : '−'}
						{RundownUtils.formatDiffToTimecode(Math.abs(overUnder), false, false, true, false, true)}
					</span>
				) : undefined
			}
		>
			{timeStr}
		</Countdown>
	)
}
