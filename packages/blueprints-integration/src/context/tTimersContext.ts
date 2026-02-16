export type IPlaylistTTimerIndex = 1 | 2 | 3

export interface ITTimersContext {
	/**
	 * Get a T-timer by its index
	 * Note: Index is 1-based (1, 2, 3)
	 * @param index Number of the timer to retrieve
	 */
	getTimer(index: IPlaylistTTimerIndex): IPlaylistTTimer

	/**
	 * Clear all T-timers
	 */
	clearAllTimers(): void
}

export interface IPlaylistTTimer {
	readonly index: IPlaylistTTimerIndex

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
	 * Start a timeOfDay timer, counting towards the target time
	 * This will throw if it is unable to parse the target time
	 * @param targetTime The target time, as a string (e.g. "14:30", "2023-12-31T23:59:59Z") or a timestamp number
	 */
	startTimeOfDay(targetTime: string | number, options?: { stopAtZero?: boolean }): void

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
	 * If the current mode supports being paused, resume the timer
	 * This is the opposite of `pause()`
	 * @returns True if the timer was resumed, false if it could not be resumed
	 */
	resume(): boolean

	/**
	 * If the timer can be restarted, restore it to its initial/restarted state
	 * Note: This is supported by the countdown and timeOfDay modes
	 * @returns True if the timer was restarted, false if it could not be restarted
	 */
	restart(): boolean

	/**
	 * Set the visibility of the timer on different screens
	 * @param visibility Object specifying which screens should display this timer
	 */
	setVisibility(visibility: {
		rundownView?: boolean
		directorScreen?: boolean
		presenterScreen?: boolean
		prompterScreen?: boolean
	}): void
}

export type IPlaylistTTimerState =
	| IPlaylistTTimerStateCountdown
	| IPlaylistTTimerStateFreeRun
	| IPlaylistTTimerStateTimeOfDay

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
	readonly mode: 'freeRun'
	/** The current time of the freerun, in milliseconds */
	readonly currentTime: number
	/** Whether the timer is currently paused */
	readonly paused: boolean
}

export interface IPlaylistTTimerStateTimeOfDay {
	/** The mode of the T-timer */
	readonly mode: 'timeOfDay'
	/** The current remaining time of the timer, in milliseconds */
	readonly currentTime: number
	/** The target timestamp of the timer, in milliseconds */
	readonly targetTime: number

	/**
	 * The raw target string of the timer, as provided when setting the timer
	 * (e.g. "14:30", "2023-12-31T23:59:59Z", or a timestamp number)
	 */
	readonly targetRaw: string | number

	/** If the countdown is set to stop at zero, or continue into negative values */
	readonly stopAtZero: boolean
}
