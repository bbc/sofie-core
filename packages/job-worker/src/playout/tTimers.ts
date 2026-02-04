import type {
	RundownTTimerIndex,
	RundownTTimerMode,
	RundownTTimer,
	TimerState,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../lib/index.js'
import type { ReadonlyDeep } from 'type-fest'
import * as chrono from 'chrono-node'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../jobs/index.js'
import { PlayoutModel } from './model/PlayoutModel.js'

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

/**
 * Recalculate T-Timer estimates based on timing anchors
 *
 * For each T-Timer that has an anchorPartId set, this function:
 * 1. Iterates through ordered parts from current/next onwards
 * 2. Accumulates expected durations until the anchor part is reached
 * 3. Updates estimateState with the calculated duration
 * 4. Sets the estimate as running if we're progressing, or paused if pushing (overrunning)
 *
 * @param context Job context
 * @param playoutModel The playout model containing the playlist and parts
 */
export function recalculateTTimerEstimates(context: JobContext, playoutModel: PlayoutModel): void {
	const span = context.startSpan('recalculateTTimerEstimates')

	const playlist = playoutModel.playlist
	const tTimers = playlist.tTimers

	// Find which timers have anchors that need calculation
	const timerAnchors = new Map<PartId, RundownTTimerIndex[]>()
	for (const timer of tTimers) {
		if (timer.anchorPartId) {
			const existingTimers = timerAnchors.get(timer.anchorPartId) ?? []
			existingTimers.push(timer.index)
			timerAnchors.set(timer.anchorPartId, existingTimers)
		}
	}

	// If no timers have anchors, nothing to do
	if (timerAnchors.size === 0) {
		if (span) span.end()
		return
	}

	const currentPartInstance = playoutModel.currentPartInstance?.partInstance
	const nextPartInstance = playoutModel.nextPartInstance?.partInstance

	// Get ordered parts to iterate through
	const orderedParts = playoutModel.getAllOrderedParts()

	// Start from next part if available, otherwise current, otherwise first playable part
	let startPartIndex: number | undefined
	if (nextPartInstance) {
		// We have a next part selected, start from there
		startPartIndex = orderedParts.findIndex((p) => p._id === nextPartInstance.part._id)
	} else if (currentPartInstance) {
		// No next, but we have current - start from the part after current
		const currentIndex = orderedParts.findIndex((p) => p._id === currentPartInstance.part._id)
		if (currentIndex >= 0 && currentIndex < orderedParts.length - 1) {
			startPartIndex = currentIndex + 1
		}
	}

	// If we couldn't find a starting point, start from the first playable part
	startPartIndex ??= orderedParts.findIndex((p) => isPartPlayable(p))

	if (startPartIndex === undefined || startPartIndex < 0) {
		// No parts to iterate through, clear estimates
		for (const timer of tTimers) {
			if (timer.anchorPartId) {
				playoutModel.updateTTimer({ ...timer, estimateState: undefined })
			}
		}
		if (span) span.end()
		return
	}

	// Iterate through parts and accumulate durations
	const playablePartsSlice = orderedParts.slice(startPartIndex).filter((p) => isPartPlayable(p))

	const now = getCurrentTime()
	let accumulatedDuration = 0

	// Calculate remaining time for current part
	// If not started, treat as if it starts now (elapsed = 0, remaining = full duration)
	// Account for playOffset (e.g., from play-from-anywhere feature)
	let isPushing = false
	if (currentPartInstance) {
		const currentPartDuration =
			currentPartInstance.part.expectedDurationWithTransition ?? currentPartInstance.part.expectedDuration
		if (currentPartDuration) {
			const currentPartStartedPlayback = currentPartInstance.timings?.plannedStartedPlayback
			const startedPlayback =
				currentPartStartedPlayback && currentPartStartedPlayback <= now ? currentPartStartedPlayback : now
			const playOffset = currentPartInstance.timings?.playOffset || 0
			const elapsed = now - startedPlayback - playOffset
			const remaining = currentPartDuration - elapsed

			isPushing = remaining < 0
			accumulatedDuration = Math.max(0, remaining)
		}
	}

	for (const part of playablePartsSlice) {
		// Add this part's expected duration to the accumulator
		const partDuration = part.expectedDurationWithTransition ?? part.expectedDuration ?? 0
		accumulatedDuration += partDuration

		// Check if this part is an anchor for any timer
		const timersForThisPart = timerAnchors.get(part._id)
		if (timersForThisPart) {
			for (const timerIndex of timersForThisPart) {
				const timer = tTimers[timerIndex - 1]

				// Update the timer's estimate
				const estimateState: TimerState = isPushing
					? literal<TimerState>({
							paused: true,
							duration: accumulatedDuration,
						})
					: literal<TimerState>({
							paused: false,
							zeroTime: now + accumulatedDuration,
						})

				playoutModel.updateTTimer({ ...timer, estimateState })
			}
			// Remove this anchor since we've processed it
			timerAnchors.delete(part._id)
		}

		// Early exit if we've resolved all timers
		if (timerAnchors.size === 0) {
			break
		}
	}

	// Clear estimates for any timers whose anchors weren't found (e.g., anchor is in the past or removed)
	// Any remaining entries in timerAnchors are anchors that weren't reached
	for (const timerIndices of timerAnchors.values()) {
		for (const timerIndex of timerIndices) {
			const timer = tTimers[timerIndex - 1]
			playoutModel.updateTTimer({ ...timer, estimateState: undefined })
		}
	}

	if (span) span.end()
}
