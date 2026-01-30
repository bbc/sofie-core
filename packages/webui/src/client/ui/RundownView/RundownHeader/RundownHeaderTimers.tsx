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

	const hasActiveTimers = tTimers.some((t) => t.mode)

	if (!hasActiveTimers) return null

	return (
		<div className="timing__header_t-timers">
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

	const isRunning = timer.state !== null && !timer.state.paused

	const diff = calculateDiff(timer, now)
	const timeStr = RundownUtils.formatDiffToTimecode(Math.abs(diff), false, true, true, false, true)
	const parts = timeStr.split(':')

	const timerSign = diff >= 0 ? '+' : '-'

	return (
		<div
			className={classNames('timing__header_t-timers__timer', {
				'timing__header_t-timers__timer__countdown': timer.mode!.type === 'countdown',
				'timing__header_t-timers__timer__freeRun': timer.mode!.type === 'freeRun',
				'timing__header_t-timers__timer__isRunning': isRunning,
				'timing__header_t-timers__timer__isPaused': !isRunning,
				'timing__header_t-timers__timer__isCountingDown': timer.mode!.type === 'countdown',
				'timing__header_t-timers__timer__isCountingUp': timer.mode!.type === 'countdown',
				'timing__header_t-timers__timer__isComplete':
					timer.mode!.type === 'countdown' && timer.state !== null && timer.state.paused,
			})}
		>
			<span className="timing__header_t-timers__timer__label">{timer.label}</span>
			<div className="timing__header_t-timers__timer__value">
				<span className="timing__header_t-timers__timer__sign">{timerSign}</span>
				{parts.map((p, i) => (
					<React.Fragment key={i}>
						<span
							className={classNames('timing__header_t-timers__timer__part', {
								'timing__header_t-timers__timer__part--dimmed': p === '00',
							})}
						>
							{p}
						</span>
						{i < parts.length - 1 && <span className="timing__header_t-timers__timer__separator">:</span>}
					</React.Fragment>
				))}
			</div>
		</div>
	)
}

function calculateDiff(timer: RundownTTimer, now: number): number {
	if (!timer.state) {
		return 0
	}

	// Get current time: either frozen duration or calculated from zeroTime
	const currentTime = timer.state.paused ? timer.state.duration : timer.state.zeroTime - now

	// Free run counts up, so negate to get positive elapsed time
	if (timer.mode?.type === 'freeRun') {
		return -currentTime
	}

	// Apply stopAtZero if configured
	if (timer.mode?.stopAtZero && currentTime < 0) {
		return 0
	}

	return currentTime
}
