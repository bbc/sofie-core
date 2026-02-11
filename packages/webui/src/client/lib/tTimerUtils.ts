import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

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

	const duration = timer.state.paused ? timer.state.duration : timer.state.zeroTime - now
	const estimateDuration = timer.estimateState.paused
		? timer.estimateState.duration
		: timer.estimateState.zeroTime - now

	return duration - estimateDuration
}

// TODO: remove this mock
let mockTimer: RundownTTimer | undefined

export function getDefaultTTimer(_tTimers: [RundownTTimer, RundownTTimer, RundownTTimer]): RundownTTimer | undefined {
	// FORCE MOCK:
	/*
	const active = tTimers.find((t) => t.mode)
	if (active) return active
	*/

	if (!mockTimer) {
		const now = Date.now()
		mockTimer = {
			index: 0,
			label: 'MOCK TIMER',
			mode: {
				type: 'countdown',
			},
			state: {
				zeroTime: now + 60 * 60 * 1000, // 1 hour
				duration: 0,
				paused: false,
			},
			estimateState: {
				zeroTime: now + 65 * 60 * 1000, // 65 mins -> 5 mins over
				duration: 0,
				paused: false,
			},
		} as any
	}

	return mockTimer
}
