export interface ITTimersContext {
	/**
	 * Get a T-timer by its index
	 * Note: Index is 1-based (1, 2, 3)
	 * @param index Number of the timer to retrieve
	 */
	getTimer(index: 1 | 2 | 3): IPlaylistTTimer
}

export interface IPlaylistTTimer {
	readonly index: number

	/** The label of the T-timer */
	readonly label: string

	/** Set the label of the T-timer */
	setLabel(label: string): void

	/** Clear the T-timer back to an uninitialized state */
	clearTimer(): void

	/**
	 * If the current mode supports being paused, pause the timer
	 * Note: This only works for the countdown and freerun modes
	 * @returns True if the timer was paused, false if it could not be paused
	 */
	pause(): boolean

	/**
	 * If the timer can be restarted, restart it
	 * Note: This only works for the countdown mode
	 * @returns True if the timer was restarted, false if it could not be restarted
	 */
	restart(): boolean

	// TODO
}
