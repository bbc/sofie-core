import { useFakeCurrentTime, useRealCurrentTime, adjustFakeTime } from '../../__mocks__/time.js'
import {
	validateTTimerIndex,
	pauseTTimer,
	resumeTTimer,
	restartTTimer,
	createCountdownTTimer,
	createFreeRunTTimer,
	calculateTTimerCurrentTime,
} from '../tTimers.js'
import type { RundownTTimerMode } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

describe('tTimers utils', () => {
	beforeEach(() => {
		useFakeCurrentTime(10000) // Set a fixed time for tests
	})

	afterEach(() => {
		useRealCurrentTime()
	})

	describe('validateTTimerIndex', () => {
		it('should accept valid indices 1, 2, 3', () => {
			expect(() => validateTTimerIndex(1)).not.toThrow()
			expect(() => validateTTimerIndex(2)).not.toThrow()
			expect(() => validateTTimerIndex(3)).not.toThrow()
		})

		it('should reject index 0', () => {
			expect(() => validateTTimerIndex(0)).toThrow('T-timer index out of range: 0')
		})

		it('should reject index 4', () => {
			expect(() => validateTTimerIndex(4)).toThrow('T-timer index out of range: 4')
		})

		it('should reject negative indices', () => {
			expect(() => validateTTimerIndex(-1)).toThrow('T-timer index out of range: -1')
		})

		it('should reject NaN', () => {
			expect(() => validateTTimerIndex(NaN)).toThrow('T-timer index out of range: NaN')
		})
	})

	describe('pauseTTimer', () => {
		it('should pause a running countdown timer', () => {
			const timer: RundownTTimerMode = {
				type: 'countdown',
				startTime: 5000,
				pauseTime: null,
				duration: 60000,
				stopAtZero: true,
			}

			const result = pauseTTimer(timer)

			expect(result).toEqual({
				type: 'countdown',
				startTime: 5000,
				pauseTime: 10000, // getCurrentTime()
				duration: 60000,
				stopAtZero: true,
			})
		})

		it('should pause a running freeRun timer', () => {
			const timer: RundownTTimerMode = {
				type: 'freeRun',
				startTime: 5000,
				pauseTime: null,
			}

			const result = pauseTTimer(timer)

			expect(result).toEqual({
				type: 'freeRun',
				startTime: 5000,
				pauseTime: 10000,
			})
		})

		it('should return unchanged countdown timer if already paused', () => {
			const timer: RundownTTimerMode = {
				type: 'countdown',
				startTime: 5000,
				pauseTime: 7000, // already paused
				duration: 60000,
				stopAtZero: true,
			}

			const result = pauseTTimer(timer)

			expect(result).toBe(timer) // same reference, unchanged
		})

		it('should return unchanged freeRun timer if already paused', () => {
			const timer: RundownTTimerMode = {
				type: 'freeRun',
				startTime: 5000,
				pauseTime: 7000, // already paused
			}

			const result = pauseTTimer(timer)

			expect(result).toBe(timer) // same reference, unchanged
		})

		it('should return null for null timer', () => {
			expect(pauseTTimer(null)).toBeNull()
		})
	})

	describe('resumeTTimer', () => {
		it('should resume a paused countdown timer', () => {
			const timer: RundownTTimerMode = {
				type: 'countdown',
				startTime: 5000,
				pauseTime: 8000, // paused 3 seconds after start
				duration: 60000,
				stopAtZero: true,
			}

			const result = resumeTTimer(timer)

			// pausedOffset = 5000 - 8000 = -3000
			// newStartTime = 10000 + (-3000) = 7000
			expect(result).toEqual({
				type: 'countdown',
				startTime: 7000, // 3 seconds before now
				pauseTime: null,
				duration: 60000,
				stopAtZero: true,
			})
		})

		it('should resume a paused freeRun timer', () => {
			const timer: RundownTTimerMode = {
				type: 'freeRun',
				startTime: 2000,
				pauseTime: 6000, // paused 4 seconds after start
			}

			const result = resumeTTimer(timer)

			// pausedOffset = 2000 - 6000 = -4000
			// newStartTime = 10000 + (-4000) = 6000
			expect(result).toEqual({
				type: 'freeRun',
				startTime: 6000, // 4 seconds before now
				pauseTime: null,
			})
		})

		it('should return countdown timer unchanged if already running', () => {
			const timer: RundownTTimerMode = {
				type: 'countdown',
				startTime: 5000,
				pauseTime: null, // already running
				duration: 60000,
				stopAtZero: true,
			}

			const result = resumeTTimer(timer)

			expect(result).toBe(timer) // same reference
		})

		it('should return freeRun timer unchanged if already running', () => {
			const timer: RundownTTimerMode = {
				type: 'freeRun',
				startTime: 5000,
				pauseTime: null, // already running
			}

			const result = resumeTTimer(timer)

			expect(result).toBe(timer) // same reference
		})

		it('should return null for null timer', () => {
			expect(resumeTTimer(null)).toBeNull()
		})
	})

	describe('restartTTimer', () => {
		it('should restart a running countdown timer', () => {
			const timer: RundownTTimerMode = {
				type: 'countdown',
				startTime: 5000,
				pauseTime: null,
				duration: 60000,
				stopAtZero: true,
			}

			const result = restartTTimer(timer)

			expect(result).toEqual({
				type: 'countdown',
				startTime: 10000, // now
				pauseTime: null,
				duration: 60000,
				stopAtZero: true,
			})
		})

		it('should restart a paused countdown timer (stays paused)', () => {
			const timer: RundownTTimerMode = {
				type: 'countdown',
				startTime: 5000,
				pauseTime: 8000,
				duration: 60000,
				stopAtZero: false,
			}

			const result = restartTTimer(timer)

			expect(result).toEqual({
				type: 'countdown',
				startTime: 10000, // now
				pauseTime: 10000, // also now (paused at start)
				duration: 60000,
				stopAtZero: false,
			})
		})

		it('should return null for freeRun timer', () => {
			const timer: RundownTTimerMode = {
				type: 'freeRun',
				startTime: 5000,
				pauseTime: null,
			}

			expect(restartTTimer(timer)).toBeNull()
		})

		it('should return null for null timer', () => {
			expect(restartTTimer(null)).toBeNull()
		})
	})

	describe('createCountdownTTimer', () => {
		it('should create a running countdown timer', () => {
			const result = createCountdownTTimer(60000, {
				stopAtZero: true,
				startPaused: false,
			})

			expect(result).toEqual({
				type: 'countdown',
				startTime: 10000,
				pauseTime: null,
				duration: 60000,
				stopAtZero: true,
			})
		})

		it('should create a paused countdown timer', () => {
			const result = createCountdownTTimer(30000, {
				stopAtZero: false,
				startPaused: true,
			})

			expect(result).toEqual({
				type: 'countdown',
				startTime: 10000,
				pauseTime: 10000,
				duration: 30000,
				stopAtZero: false,
			})
		})

		it('should throw for zero duration', () => {
			expect(() =>
				createCountdownTTimer(0, {
					stopAtZero: true,
					startPaused: false,
				})
			).toThrow('Duration must be greater than zero')
		})

		it('should throw for negative duration', () => {
			expect(() =>
				createCountdownTTimer(-1000, {
					stopAtZero: true,
					startPaused: false,
				})
			).toThrow('Duration must be greater than zero')
		})
	})

	describe('createFreeRunTTimer', () => {
		it('should create a running freeRun timer', () => {
			const result = createFreeRunTTimer({ startPaused: false })

			expect(result).toEqual({
				type: 'freeRun',
				startTime: 10000,
				pauseTime: null,
			})
		})

		it('should create a paused freeRun timer', () => {
			const result = createFreeRunTTimer({ startPaused: true })

			expect(result).toEqual({
				type: 'freeRun',
				startTime: 10000,
				pauseTime: 10000,
			})
		})
	})

	describe('calculateTTimerCurrentTime', () => {
		it('should calculate time for a running timer', () => {
			// Timer started at 5000, current time is 10000
			const result = calculateTTimerCurrentTime(5000, null)

			expect(result).toBe(5000) // 10000 - 5000
		})

		it('should calculate time for a paused timer', () => {
			// Timer started at 5000, paused at 8000
			const result = calculateTTimerCurrentTime(5000, 8000)

			expect(result).toBe(3000) // 8000 - 5000
		})

		it('should handle timer that just started', () => {
			const result = calculateTTimerCurrentTime(10000, null)

			expect(result).toBe(0)
		})

		it('should handle timer paused immediately', () => {
			const result = calculateTTimerCurrentTime(10000, 10000)

			expect(result).toBe(0)
		})

		it('should update as time progresses', () => {
			const startTime = 5000

			expect(calculateTTimerCurrentTime(startTime, null)).toBe(5000)

			adjustFakeTime(2000) // Now at 12000

			expect(calculateTTimerCurrentTime(startTime, null)).toBe(7000)
		})
	})
})
