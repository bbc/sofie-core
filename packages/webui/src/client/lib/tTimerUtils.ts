import { RundownTTimer, timerStateToDuration } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

/**
 * Calculate the display diff for a T-Timer.
 * For countdown/timeOfDay: positive = time remaining, negative = overrun.
 * For freeRun: positive = elapsed time.
 */
export function calculateTTimerDiff(timer: RundownTTimer, now: number): number {
	if (!timer.state) {
		return 0
	}

	// Get current time: either frozen duration or calculated from zeroTime
	const currentDuration = timerStateToDuration(timer.state, now)

	// Free run counts up, so negate to get positive elapsed time
	if (timer.mode?.type === 'freeRun') {
		return -currentDuration
	}

	// Apply stopAtZero if configured
	if (timer.mode?.stopAtZero && currentDuration < 0) {
		return 0
	}

	return currentDuration
}

/**
 * Calculate the over/under difference between the timer's current value
 * and its estimate.
 *
 * Positive = over (behind schedule, will reach anchor after timer hits zero)
 * Negative = under (ahead of schedule, will reach anchor before timer hits zero)
 *
 * Returns undefined if no estimate is available.
 */
export function calculateTTimerOverUnder(timer: RundownTTimer, now: number): number | undefined {
	if (!timer.state || !timer.estimateState) {
		return undefined
	}

	const duration = timerStateToDuration(timer.state, now)
	const estimateDuration = timerStateToDuration(timer.estimateState, now)

	return estimateDuration - duration
}

export function getDefaultTTimer(tTimers: [RundownTTimer, RundownTTimer, RundownTTimer]): RundownTTimer | undefined {
	return tTimers.find((t) => t.mode)
}
