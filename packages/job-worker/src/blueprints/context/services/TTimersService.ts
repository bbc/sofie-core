import type {
	IPlaylistTTimer,
	IPlaylistTTimerState,
} from '@sofie-automation/blueprints-integration/dist/context/tTimersContext'
import type { RundownTTimer, RundownTTimerIndex } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import type { PlayoutModel } from '../../../playout/model/PlayoutModel.js'
import { ReadonlyDeep } from 'type-fest'
import {
	calculateTTimerCurrentTime,
	createCountdownTTimer,
	createFreeRunTTimer,
	pauseTTimer,
	restartTTimer,
	resumeTTimer,
	validateTTimerIndex,
} from '../../../playout/tTimers.js'

export class TTimersService {
	readonly playoutModel: PlayoutModel

	readonly timers: [PlaylistTTimerImpl, PlaylistTTimerImpl, PlaylistTTimerImpl]

	constructor(playoutModel: PlayoutModel) {
		this.playoutModel = playoutModel

		this.timers = [
			new PlaylistTTimerImpl(playoutModel, 1),
			new PlaylistTTimerImpl(playoutModel, 2),
			new PlaylistTTimerImpl(playoutModel, 3),
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
		switch (rawMode?.type) {
			case 'countdown':
				return {
					mode: 'countdown',
					currentTime: calculateTTimerCurrentTime(rawMode.startTime, rawMode.pauseTime),
					duration: rawMode.duration,
					paused: !rawMode.pauseTime,
					stopAtZero: rawMode.stopAtZero,
				}
			case 'freeRun':
				return {
					mode: 'freeRun',
					currentTime: calculateTTimerCurrentTime(rawMode.startTime, rawMode.pauseTime),
					paused: !rawMode.pauseTime,
				}
			case undefined:
				return null
			default:
				assertNever(rawMode)
				return null
		}
	}

	constructor(playoutModel: PlayoutModel, index: RundownTTimerIndex) {
		this.#playoutModel = playoutModel
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
		})
	}
	startCountdown(duration: number, options?: { stopAtZero?: boolean; startPaused?: boolean }): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			mode: createCountdownTTimer(duration, {
				stopAtZero: options?.stopAtZero ?? true,
				startPaused: options?.startPaused ?? false,
			}),
		})
	}
	startFreeRun(options?: { startPaused?: boolean }): void {
		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			mode: createFreeRunTTimer({
				startPaused: options?.startPaused ?? false,
			}),
		})
	}
	pause(): boolean {
		const newTimer = pauseTTimer(this.#modelTimer.mode)
		if (!newTimer) return false

		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			mode: newTimer,
		})
		return true
	}
	resume(): boolean {
		const newTimer = resumeTTimer(this.#modelTimer.mode)
		if (!newTimer) return false

		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			mode: newTimer,
		})
		return true
	}
	restart(): boolean {
		const newTimer = restartTTimer(this.#modelTimer.mode)
		if (!newTimer) return false

		this.#playoutModel.updateTTimer({
			...this.#modelTimer,
			mode: newTimer,
		})
		return true
	}
}
