import type { RundownTTimerIndex, RundownTTimerMode } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
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
export function pauseTTimer(timer: ReadonlyDeep<RundownTTimerMode> | null): ReadonlyDeep<RundownTTimerMode> | null {
	if (timer?.type === 'countdown' || timer?.type === 'freeRun') {
		if (timer.pauseTime) {
			// Already paused
			return timer
		}

		return {
			...timer,
			pauseTime: getCurrentTime(),
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
export function resumeTTimer(timer: ReadonlyDeep<RundownTTimerMode> | null): ReadonlyDeep<RundownTTimerMode> | null {
	if (timer?.type === 'countdown' || timer?.type === 'freeRun') {
		if (!timer.pauseTime) {
			// Already running
			return timer
		}

		const pausedOffset = timer.startTime - timer.pauseTime
		const newStartTime = getCurrentTime() + pausedOffset

		return {
			...timer,
			startTime: newStartTime,
			pauseTime: null,
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
export function restartTTimer(timer: ReadonlyDeep<RundownTTimerMode> | null): ReadonlyDeep<RundownTTimerMode> | null {
	if (timer?.type === 'countdown') {
		return {
			...timer,
			startTime: getCurrentTime(),
			pauseTime: timer.pauseTime ? getCurrentTime() : null,
		}
	} else if (timer?.type === 'timeOfDay') {
		const nextTime = calculateNextTimeOfDayTarget(timer.targetRaw)
		// If we can't calculate the next time, we can't restart
		if (nextTime === null || nextTime === timer.targetTime) return null

		return {
			...timer,
			targetTime: nextTime,
		}
	} else {
		return null
	}
}

/**
 * Create a new countdown T-timer
 * @param index Timer index
 * @param duration Duration in milliseconds
 * @param options Options for the countdown
 * @returns The created T-timer
 */
export function createCountdownTTimer(
	duration: number,
	options: {
		stopAtZero: boolean
		startPaused: boolean
	}
): ReadonlyDeep<RundownTTimerMode> {
	if (duration <= 0) throw new Error('Duration must be greater than zero')

	const now = getCurrentTime()
	return {
		type: 'countdown',
		startTime: now,
		pauseTime: options.startPaused ? now : null,
		duration,
		stopAtZero: !!options.stopAtZero,
	}
}

export function createTimeOfDayTTimer(
	targetTime: string | number,
	options: {
		stopAtZero: boolean
	}
): ReadonlyDeep<RundownTTimerMode> {
	const nextTime = calculateNextTimeOfDayTarget(targetTime)
	if (nextTime === null) throw new Error('Unable to parse target time for timeOfDay T-timer')

	return {
		type: 'timeOfDay',
		targetTime: nextTime,
		targetRaw: targetTime,
		stopAtZero: !!options.stopAtZero,
	}
}

/**
 * Create a new free-running T-timer
 * @param index Timer index
 * @param options Options for the free-run
 * @returns The created T-timer
 */
export function createFreeRunTTimer(options: { startPaused: boolean }): ReadonlyDeep<RundownTTimerMode> {
	const now = getCurrentTime()
	return {
		type: 'freeRun',
		startTime: now,
		pauseTime: options.startPaused ? now : null,
	}
}

/**
 * Calculate the current time of a T-timer
 * @param startTime The start time of the timer (unix timestamp)
 * @param pauseTime The pause time of the timer (unix timestamp) or null if not paused
 */
export function calculateTTimerCurrentTime(startTime: number, pauseTime: number | null): number {
	if (pauseTime) {
		return pauseTime - startTime
	} else {
		return getCurrentTime() - startTime
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
