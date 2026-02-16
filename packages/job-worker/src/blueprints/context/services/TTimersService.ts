import type {
	IPlaylistTTimer,
	IPlaylistTTimerState,
} from '@sofie-automation/blueprints-integration/dist/context/tTimersContext'
import type { RundownTTimer, RundownTTimerIndex } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
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
} from '../../../playout/tTimers.js'
import { getCurrentTime } from '../../../lib/time.js'

export class TTimersService {
	readonly timers: [PlaylistTTimerImpl, PlaylistTTimerImpl, PlaylistTTimerImpl]

	constructor(
		timers: ReadonlyDeep<RundownTTimer[]>,
		emitChange: (updatedTimer: ReadonlyDeep<RundownTTimer>) => void
	) {
		this.timers = [
			new PlaylistTTimerImpl(timers[0], emitChange),
			new PlaylistTTimerImpl(timers[1], emitChange),
			new PlaylistTTimerImpl(timers[2], emitChange),
		]
	}

	static withPlayoutModel(playoutModel: PlayoutModel): TTimersService {
		return new TTimersService(playoutModel.playlist.tTimers, (updatedTimer) => {
			playoutModel.updateTTimer(updatedTimer)
		})
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
	readonly #emitChange: (updatedTimer: ReadonlyDeep<RundownTTimer>) => void

	#timer: ReadonlyDeep<RundownTTimer>

	get index(): RundownTTimerIndex {
		return this.#timer.index
	}
	get label(): string {
		return this.#timer.label
	}
	get state(): IPlaylistTTimerState | null {
		const rawMode = this.#timer.mode
		const rawState = this.#timer.state

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

	constructor(timer: ReadonlyDeep<RundownTTimer>, emitChange: (updatedTimer: ReadonlyDeep<RundownTTimer>) => void) {
		this.#timer = timer
		this.#emitChange = emitChange
	}

	setLabel(label: string): void {
		this.#timer = {
			...this.#timer,
			label: label,
		}
		this.#emitChange(this.#timer)
	}
	clearTimer(): void {
		this.#timer = {
			...this.#timer,
			mode: null,
			state: null,
		}
		this.#emitChange(this.#timer)
	}
	startCountdown(duration: number, options?: { stopAtZero?: boolean; startPaused?: boolean }): void {
		this.#timer = {
			...this.#timer,
			...createCountdownTTimer(duration, {
				stopAtZero: options?.stopAtZero ?? true,
				startPaused: options?.startPaused ?? false,
			}),
		}
		this.#emitChange(this.#timer)
	}
	startTimeOfDay(targetTime: string | number, options?: { stopAtZero?: boolean }): void {
		this.#timer = {
			...this.#timer,
			...createTimeOfDayTTimer(targetTime, {
				stopAtZero: options?.stopAtZero ?? true,
			}),
		}
		this.#emitChange(this.#timer)
	}
	startFreeRun(options?: { startPaused?: boolean }): void {
		this.#timer = {
			...this.#timer,
			...createFreeRunTTimer({
				startPaused: options?.startPaused ?? false,
			}),
		}
		this.#emitChange(this.#timer)
	}
	pause(): boolean {
		const newTimer = pauseTTimer(this.#timer)
		if (!newTimer) return false

		this.#timer = newTimer
		this.#emitChange(newTimer)
		return true
	}
	resume(): boolean {
		const newTimer = resumeTTimer(this.#timer)
		if (!newTimer) return false

		this.#timer = newTimer
		this.#emitChange(newTimer)
		return true
	}
	restart(): boolean {
		const newTimer = restartTTimer(this.#timer)
		if (!newTimer) return false

		this.#timer = newTimer
		this.#emitChange(newTimer)
		return true
	}

	setVisibility(visibility: {
		rundownView?: boolean
		directorScreen?: boolean
		presenterScreen?: boolean
		prompterScreen?: boolean
	}): void {
		const currentVisibility = this.#timer.visibility ?? {
			rundownView: true,
			directorScreen: true,
			presenterScreen: true,
			prompterScreen: true,
		}

		this.#timer = {
			...this.#timer,
			visibility: {
				rundownView: visibility.rundownView ?? currentVisibility.rundownView,
				directorScreen: visibility.directorScreen ?? currentVisibility.directorScreen,
				presenterScreen: visibility.presenterScreen ?? currentVisibility.presenterScreen,
				prompterScreen: visibility.prompterScreen ?? currentVisibility.prompterScreen,
			},
		}
		this.#emitChange(this.#timer)
	}
}
