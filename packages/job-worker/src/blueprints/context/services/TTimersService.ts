import type {
	IPlaylistTTimer,
	IPlaylistTTimerState,
	ITTimersContext,
} from '@sofie-automation/blueprints-integration/dist/context/tTimersContext'
import type { RundownTTimer, RundownTTimerIndex } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import type { PlayoutModel } from '../../../playout/model/PlayoutModel.js'
import { ReadonlyDeep } from 'type-fest'

export class TTimersService implements ITTimersContext {
	readonly playoutModel: PlayoutModel

	readonly timers: [IPlaylistTTimer, IPlaylistTTimer, IPlaylistTTimer]

	constructor(playoutModel: PlayoutModel) {
		this.playoutModel = playoutModel

		this.timers = [
			new PlaylistTTimerImpl(playoutModel, 1),
			new PlaylistTTimerImpl(playoutModel, 2),
			new PlaylistTTimerImpl(playoutModel, 3),
		]
	}

	getTimer(index: RundownTTimerIndex): IPlaylistTTimer {
		if (isNaN(index) || index < 1 || index > 3) throw new Error(`T-timer index out of range: ${index}`)
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

	// get hasChanged(): boolean {
	// 	return this.#hasChanged
	// }

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
				return null
			case 'freeRun':
				return null
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

		if (isNaN(index) || index < 1 || index > 3) throw new Error(`T-timer index out of range: ${index}`)
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
		throw new Error('Method not implemented.')
	}
	startFreeRun(options?: { startPaused?: boolean }): void {
		throw new Error('Method not implemented.')
	}
	pause(): boolean {
		throw new Error('Method not implemented.')
	}
	resume(): boolean {
		throw new Error('Method not implemented.')
	}
	restart(): boolean {
		throw new Error('Method not implemented.')
	}
}
