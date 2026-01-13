export interface ITTimersContext {
	/**
	 * Get a T-timer by its index
	 * Note: Index is 1-based (1, 2, 3)
	 * @param index Number of the timer to retrieve
	 */
	getTimer(index: 1 | 2 | 3): IPlaylistTTimer

	/**
	 * Clear all T-timers
	 */
	clearAllTimers(): void
}

export interface IPlaylistTTimer {
	readonly index: number

	/** The label of the T-timer */
	readonly label: string

	/**
	 * The current state of the T-timer
	 * Null if the T-timer is not initialized
	 */
	readonly state: IPlaylistTTimerState | null

	/** Set the label of the T-timer */
	setLabel(label: string): void

	/** Clear the T-timer back to an uninitialized state */
	clearTimer(): void

	/**
	 * Start a countdown timer
	 * @param duration Duration of the countdown in milliseconds
	 * @param options Options for the countdown
	 */
	startCountdown(duration: number, options?: { stopAtZero?: boolean; startPaused?: boolean }): void

	/**
	 * Start a free-running timer
	 */
	startFreeRun(options?: { startPaused?: boolean }): void

	/**
	 * If the current mode supports being paused, pause the timer
	 * Note: This is supported by the countdown and freerun modes
	 * @returns True if the timer was paused, false if it could not be paused
	 */
	pause(): boolean

	/**
	 * If the timer can be restarted, restart it
	 * Note: This is supported by the countdown mode
	 * @returns True if the timer was restarted, false if it could not be restarted
	 */
	restart(): boolean
}

export type IPlaylistTTimerState = IPlaylistTTimerStateCountdown | IPlaylistTTimerStateFreeRun

export interface IPlaylistTTimerStateCountdown {
	/** The mode of the T-timer */
	readonly mode: 'countdown'
	/** The current time of the countdown, in milliseconds */
	readonly currentTime: number
	/** The total duration of the countdown, in milliseconds */
	readonly duration: number
	/** Whether the timer is currently paused */
	readonly paused: boolean

	/** If the countdown is set to stop at zero, or continue into negative values */
	readonly stopAtZero: boolean
}
export interface IPlaylistTTimerStateFreeRun {
	/** The mode of the T-timer */
	readonly mode: 'freerun'
	/** The current time of the freerun, in milliseconds */
	readonly currentTime: number
	/** Whether the timer is currently paused */
	readonly paused: boolean
}
