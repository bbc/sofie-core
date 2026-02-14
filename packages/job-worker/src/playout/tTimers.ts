import type {
	RundownTTimerIndex,
	RundownTTimerMode,
	RundownTTimer,
	TimerState,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCurrentTime } from '../lib/index.js'
import type { ReadonlyDeep } from 'type-fest'
import * as chrono from 'chrono-node'

export function validateTTimerIndex(index: number): asserts index is RundownTTimerIndex {
	if (isNaN(index) || index < 1 || index > 3) throw new Error(`T-timer index out of range: ${index}`)
}

/**
 * Returns an updated T-timer in the paused state (if supported)
 * @param timer Timer to update
 * @returns If the timer supports pausing, the timer in paused state, otherwise null
 */
export function pauseTTimer(timer: ReadonlyDeep<RundownTTimer>): ReadonlyDeep<RundownTTimer> | null {
	if (!timer.mode || !timer.state) return null
	if (timer.mode.type === 'countdown' || timer.mode.type === 'freeRun') {
		if (timer.state.paused) {
			// Already paused
			return timer
		}
		return {
			...timer,
			state: { paused: true, duration: timer.state.zeroTime - getCurrentTime() },
		}
	} else {
		return null
	}
}

/**
 * Returns an updated T-timer in the resumed state (if supported)
 * @param timer Timer to update
 * @returns If the timer supports pausing, the timer in resumed state, otherwise null
 */
export function resumeTTimer(timer: ReadonlyDeep<RundownTTimer>): ReadonlyDeep<RundownTTimer> | null {
	if (!timer.mode || !timer.state) return null
	if (timer.mode.type === 'countdown' || timer.mode.type === 'freeRun') {
		if (!timer.state.paused) {
			// Already running
			return timer
		}

		return {
			...timer,
			state: { paused: false, zeroTime: timer.state.duration + getCurrentTime() },
		}
	} else {
		return null
	}
}

/**
 * Returns an updated T-timer, after restarting (if supported)
 * @param timer Timer to update
 * @returns If the timer supports restarting, the restarted timer, otherwise null
 */
export function restartTTimer(timer: ReadonlyDeep<RundownTTimer>): ReadonlyDeep<RundownTTimer> | null {
	if (!timer.mode || !timer.state) return null
	if (timer.mode.type === 'countdown') {
		return {
			...timer,
			state: timer.state.paused
				? { paused: true, duration: timer.mode.duration }
				: { paused: false, zeroTime: getCurrentTime() + timer.mode.duration },
		}
	} else if (timer.mode.type === 'timeOfDay') {
		const nextTime = calculateNextTimeOfDayTarget(timer.mode.targetRaw)
		// If we can't calculate the next time, or it's the same, we can't restart
		if (nextTime === null || (timer.state.paused ? false : nextTime === timer.state.zeroTime)) return null

		return {
			...timer,
			state: { paused: false, zeroTime: nextTime },
		}
	} else {
		return null
	}
}

/**
 * Create a new countdown T-timer mode and initial state
 * @param duration Duration in milliseconds
 * @param options Options for the countdown
 * @returns The created T-timer mode and state
 */
export function createCountdownTTimer(
	duration: number,
	options: {
		stopAtZero: boolean
		startPaused: boolean
	}
): { mode: ReadonlyDeep<RundownTTimerMode>; state: ReadonlyDeep<TimerState> } {
	if (duration <= 0) throw new Error('Duration must be greater than zero')

	return {
		mode: {
			type: 'countdown',
			duration,
			stopAtZero: !!options.stopAtZero,
		},
		state: options.startPaused
			? { paused: true, duration: duration }
			: { paused: false, zeroTime: getCurrentTime() + duration },
	}
}

export function createTimeOfDayTTimer(
	targetTime: string | number,
	options: {
		stopAtZero: boolean
	}
): { mode: ReadonlyDeep<RundownTTimerMode>; state: ReadonlyDeep<TimerState> } {
	const nextTime = calculateNextTimeOfDayTarget(targetTime)
	if (nextTime === null) throw new Error('Unable to parse target time for timeOfDay T-timer')

	return {
		mode: {
			type: 'timeOfDay',
			targetRaw: targetTime,
			stopAtZero: !!options.stopAtZero,
		},
		state: { paused: false, zeroTime: nextTime },
	}
}

/**
 * Create a new free-running T-timer mode and initial state
 * @param options Options for the free-run
 * @returns The created T-timer mode and state
 */
export function createFreeRunTTimer(options: { startPaused: boolean }): {
	mode: ReadonlyDeep<RundownTTimerMode>
	state: ReadonlyDeep<TimerState>
} {
	const now = getCurrentTime()
	return {
		mode: {
			type: 'freeRun',
		},
		state: options.startPaused ? { paused: true, duration: 0 } : { paused: false, zeroTime: now },
	}
}

/**
 * Calculate the next target time for a timeOfDay T-timer
 * @param targetTime The target time, as a string or timestamp number
 * @returns The next target timestamp in milliseconds, or null if it could not be calculated
 */
export function calculateNextTimeOfDayTarget(targetTime: string | number): number | null {
	if (typeof targetTime === 'number') {
		// This should be a unix timestamp
		return targetTime
	}

	// Verify we have a string worth parsing
	if (typeof targetTime !== 'string' || !targetTime) return null

	const parsed = chrono.parseDate(targetTime, undefined, {
		// Always look ahead for the next occurrence
		forwardDate: true,
	})
	return parsed ? parsed.getTime() : null
}
