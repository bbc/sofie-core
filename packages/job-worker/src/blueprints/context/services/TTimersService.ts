import type {
	IPlaylistTTimer,
	IPlaylistTTimerState,
} from '@sofie-automation/blueprints-integration/dist/context/tTimersContext'
import type { RundownTTimer, RundownTTimerIndex } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import type { PlayoutModel } from '../../../playout/model/PlayoutModel.js'
import { ReadonlyDeep } from 'type-fest'
import {
	createCountdownTTimer,
	createFreeRunTTimer,
	createTimeOfDayTTimer,
	pauseTTimer,
	restartTTimer,
	resumeTTimer,
	validateTTimerIndex,
	recalculateTTimerEstimates,
} from '../../../playout/tTimers.js'
import { getCurrentTime } from '../../../lib/time.js'
import type { JobContext } from '../../../jobs/index.js'

export class TTimersService {
	readonly playoutModel: PlayoutModel
	readonly jobContext: JobContext

	readonly timers: [PlaylistTTimerImpl, PlaylistTTimerImpl, PlaylistTTimerImpl]

	constructor(playoutModel: PlayoutModel, jobContext: JobContext) {
		this.playoutModel = playoutModel
		this.jobContext = jobContext

		this.timers = [
			new PlaylistTTimerImpl(playoutModel, jobContext, 1),
			new PlaylistTTimerImpl(playoutModel, jobContext, 2),
			new PlaylistTTimerImpl(playoutModel, jobContext, 3),
		]
	}

	getTimer(index: RundownTTimerIndex): IPlaylistTTimer {
		validateTTimerIndex(index)
		return this.timers[index - 1]
	}
	clearAllTimers(): void {
		for (const timer of this.timers) {
			timer.clearTimer()
		}
	}
}

export class PlaylistTTimerImpl implements IPlaylistTTimer {
	readonly #playoutModel: PlayoutModel
	readonly #jobContext: JobContext
	readonly #index: RundownTTimerIndex

	get #modelTimer(): ReadonlyDeep<RundownTTimer> {
		return this.#playoutModel.playlist.tTimers[this.#index - 1]
	}

	get index(): RundownTTimerIndex {
		return this.#modelTimer.index
	}
	get label(): string {
		return this.#modelTimer.label
	}
	get state(): IPlaylistTTimerState | null {
		const rawMode = this.#modelTimer.mode
		const rawState = this.#modelTimer.state

		if (!rawMode || !rawState) return null

		const currentTime = rawState.paused ? rawState.duration : rawState.zeroTime - getCurrentTime()

		switch (rawMode.type) {
			case 'countdown':
				return {
					mode: 'countdown',
					currentTime,
					duration: rawMode.duration,
					paused: rawState.paused,
					stopAtZero: rawMode.stopAtZero,
				}
			case 'freeRun':
				return {
					mode: 'freeRun',
					currentTime,
					paused: rawState.paused,
				}
			case 'timeOfDay':
				return {
					mode: 'timeOfDay',
					currentTime,
					targetTime: rawState.paused ? 0 : rawState.zeroTime,
					targetRaw: rawMode.targetRaw,
					stopAtZero: rawMode.stopAtZero,
				}
			default:
				assertNever(rawMode)
				return null
		}
	}

	constructor(playoutModel: PlayoutModel, jobContext: JobContext, index: RundownTTimerIndex) {
		this.#playoutModel = playoutModel
		this.#jobContext = jobContext
		this.#index = index

		validateTTimerIndex(index)
	}

	setLabel(label: string): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			label: label,
		})
	}
	clearTimer(): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			mode: null,
			state: null,
		})
	}
	startCountdown(duration: number, options?: { stopAtZero?: boolean; startPaused?: boolean }): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			...createCountdownTTimer(duration, {
				stopAtZero: options?.stopAtZero ?? true,
				startPaused: options?.startPaused ?? false,
			}),
		})
	}
	startTimeOfDay(targetTime: string | number, options?: { stopAtZero?: boolean }): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			...createTimeOfDayTTimer(targetTime, {
				stopAtZero: options?.stopAtZero ?? true,
			}),
		})
	}
	startFreeRun(options?: { startPaused?: boolean }): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			...createFreeRunTTimer({
				startPaused: options?.startPaused ?? false,
			}),
		})
	}
	pause(): boolean {
		const newTimer = pauseTTimer(this.#modelTimer)
		if (!newTimer) return false

		this.#playoutModel.updateTTimer(newTimer)
		return true
	}
	resume(): boolean {
		const newTimer = resumeTTimer(this.#modelTimer)
		if (!newTimer) return false

		this.#playoutModel.updateTTimer(newTimer)
		return true
	}
	restart(): boolean {
		const newTimer = restartTTimer(this.#modelTimer)
		if (!newTimer) return false

		this.#playoutModel.updateTTimer(newTimer)
		return true
	}

	clearEstimate(): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			anchorPartId: undefined,
			estimateState: undefined,
		})
	}

	setEstimateAnchorPart(partId: string): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			anchorPartId: protectString<PartId>(partId),
			estimateState: undefined, // Clear manual estimate
		})

		// Recalculate estimates immediately since we already have the playout model
		recalculateTTimerEstimates(this.#jobContext, this.#playoutModel)
	}

	setEstimateTime(time: number, paused: boolean = false): void {
		const estimateState: TimerState = paused
			? literal<TimerState>({ paused: true, duration: time - getCurrentTime() })
			: literal<TimerState>({ paused: false, zeroTime: time })

		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			anchorPartId: undefined, // Clear automatic anchor
			estimateState,
		})
	}

	setEstimateDuration(duration: number, paused: boolean = false): void {
		const estimateState: TimerState = paused
			? literal<TimerState>({ paused: true, duration })
			: literal<TimerState>({ paused: false, zeroTime: getCurrentTime() + duration })

		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			anchorPartId: undefined, // Clear automatic anchor
			estimateState,
		})
	}
}
