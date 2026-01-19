/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useFakeCurrentTime, useRealCurrentTime, adjustFakeTime } from '../../__mocks__/time.js'
import {
	validateTTimerIndex,
	pauseTTimer,
	resumeTTimer,
	restartTTimer,
	createCountdownTTimer,
	createFreeRunTTimer,
	calculateTTimerCurrentTime,
	calculateNextTimeOfDayTarget,
	createTimeOfDayTTimer,
} from '../tTimers.js'
import type {
	RundownTTimerMode,
	RundownTTimerModeTimeOfDay,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

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

	describe('calculateNextTimeOfDayTarget', () => {
		// Mock date to 2026-01-19 10:00:00 UTC for predictable tests
		const MOCK_DATE = new Date('2026-01-19T10:00:00Z').getTime()

		beforeEach(() => {
			jest.useFakeTimers()
			jest.setSystemTime(MOCK_DATE)
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it('should return number input unchanged (unix timestamp)', () => {
			const timestamp = 1737331200000 // Some future timestamp
			expect(calculateNextTimeOfDayTarget(timestamp)).toBe(timestamp)
		})

		it('should return null for null/undefined/empty input', () => {
			expect(calculateNextTimeOfDayTarget('' as string)).toBeNull()
			expect(calculateNextTimeOfDayTarget('   ')).toBeNull()
		})

		// 24-hour time formats
		it('should parse 24-hour time HH:mm', () => {
			const result = calculateNextTimeOfDayTarget('13:34')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T13:34:00.000Z')
		})

		it('should parse 24-hour time H:mm (single digit hour)', () => {
			const result = calculateNextTimeOfDayTarget('9:05')
			expect(result).not.toBeNull()
			// 9:05 is in the past (before 10:00), so chrono bumps to tomorrow
			expect(new Date(result!).toISOString()).toBe('2026-01-20T09:05:00.000Z')
		})

		it('should parse 24-hour time with seconds HH:mm:ss', () => {
			const result = calculateNextTimeOfDayTarget('14:30:45')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T14:30:45.000Z')
		})

		// 12-hour time formats
		it('should parse 12-hour time with pm', () => {
			const result = calculateNextTimeOfDayTarget('5:13pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T17:13:00.000Z')
		})

		it('should parse 12-hour time with PM (uppercase)', () => {
			const result = calculateNextTimeOfDayTarget('5:13PM')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T17:13:00.000Z')
		})

		it('should parse 12-hour time with am', () => {
			const result = calculateNextTimeOfDayTarget('9:30am')
			expect(result).not.toBeNull()
			// 9:30am is in the past (before 10:00), so chrono bumps to tomorrow
			expect(new Date(result!).toISOString()).toBe('2026-01-20T09:30:00.000Z')
		})

		it('should parse 12-hour time with space before am/pm', () => {
			const result = calculateNextTimeOfDayTarget('3:45 pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:45:00.000Z')
		})

		it('should parse 12-hour time with seconds', () => {
			const result = calculateNextTimeOfDayTarget('11:30:15pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T23:30:15.000Z')
		})

		// Date + time formats
		it('should parse date with time (slash separator)', () => {
			const result = calculateNextTimeOfDayTarget('1/19/2026 15:43')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:43:00.000Z')
		})

		it('should parse date with time and seconds', () => {
			const result = calculateNextTimeOfDayTarget('1/19/2026 15:43:30')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:43:30.000Z')
		})

		it('should parse date with 12-hour time', () => {
			const result = calculateNextTimeOfDayTarget('1/19/2026 3:43pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:43:00.000Z')
		})

		// ISO 8601 format
		it('should parse ISO 8601 format', () => {
			const result = calculateNextTimeOfDayTarget('2026-01-19T15:43:00')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:43:00.000Z')
		})

		it('should parse ISO 8601 with timezone', () => {
			const result = calculateNextTimeOfDayTarget('2026-01-19T15:43:00+01:00')
			expect(result).not.toBeNull()
			// +01:00 means the time is 1 hour ahead of UTC, so 15:43 +01:00 = 14:43 UTC
			expect(new Date(result!).toISOString()).toBe('2026-01-19T14:43:00.000Z')
		})

		// Natural language formats (chrono-node strength)
		it('should parse natural language date', () => {
			const result = calculateNextTimeOfDayTarget('January 19, 2026 at 3:30pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:30:00.000Z')
		})

		it('should parse "noon"', () => {
			const result = calculateNextTimeOfDayTarget('noon')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T12:00:00.000Z')
		})

		it('should parse "midnight"', () => {
			const result = calculateNextTimeOfDayTarget('midnight')
			expect(result).not.toBeNull()
			// Midnight is in the past (before 10:00), so chrono bumps to tomorrow
			expect(new Date(result!).toISOString()).toBe('2026-01-20T00:00:00.000Z')
		})

		// Edge cases
		it('should return null for invalid time string', () => {
			expect(calculateNextTimeOfDayTarget('not a time')).toBeNull()
		})

		it('should return null for gibberish', () => {
			expect(calculateNextTimeOfDayTarget('asdfghjkl')).toBeNull()
		})
	})

	describe('createTimeOfDayTTimer', () => {
		// Mock date to 2026-01-19 10:00:00 UTC for predictable tests
		const MOCK_DATE = new Date('2026-01-19T10:00:00Z').getTime()

		beforeEach(() => {
			jest.useFakeTimers()
			jest.setSystemTime(MOCK_DATE)
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it('should create a timeOfDay timer with valid time string', () => {
			const result = createTimeOfDayTTimer('15:30', { stopAtZero: true })

			expect(result).toEqual({
				type: 'timeOfDay',
				stopAtZero: true,
				targetTime: expect.any(Number), // new target time
				targetRaw: '15:30',
			})
		})

		it('should create a timeOfDay timer with numeric timestamp', () => {
			const timestamp = 1737331200000
			const result = createTimeOfDayTTimer(timestamp, { stopAtZero: false })

			expect(result).toEqual({
				type: 'timeOfDay',
				targetTime: timestamp,
				targetRaw: timestamp,
				stopAtZero: false,
			})
		})

		it('should throw for invalid time string', () => {
			expect(() => createTimeOfDayTTimer('invalid', { stopAtZero: true })).toThrow(
				'Unable to parse target time for timeOfDay T-timer'
			)
		})

		it('should throw for empty string', () => {
			expect(() => createTimeOfDayTTimer('', { stopAtZero: true })).toThrow(
				'Unable to parse target time for timeOfDay T-timer'
			)
		})
	})

	describe('restartTTimer with timeOfDay', () => {
		// Mock date to 2026-01-19 10:00:00 UTC for predictable tests
		const MOCK_DATE = new Date('2026-01-19T10:00:00Z').getTime()

		beforeEach(() => {
			jest.useFakeTimers()
			jest.setSystemTime(MOCK_DATE)
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it('should restart a timeOfDay timer with valid targetRaw', () => {
			const timer: RundownTTimerMode = {
				type: 'timeOfDay',
				targetTime: 1737300000000,
				targetRaw: '15:30',
				stopAtZero: true,
			}

			const result = restartTTimer(timer)

			expect(result).toEqual({
				...timer,
				targetTime: expect.any(Number), // new target time
			})
			expect((result as RundownTTimerModeTimeOfDay).targetTime).toBeGreaterThan(timer.targetTime)
		})

		it('should return null for timeOfDay timer with invalid targetRaw', () => {
			const timer: RundownTTimerMode = {
				type: 'timeOfDay',
				targetTime: 1737300000000,
				targetRaw: 'invalid',
				stopAtZero: true,
			}

			const result = restartTTimer(timer)

			expect(result).toBeNull()
		})

		it('should return null for timeOfDay timer with unix timestamp', () => {
			const timer: RundownTTimerMode = {
				type: 'timeOfDay',
				targetTime: 1737300000000,
				targetRaw: 1737300000000,
				stopAtZero: true,
			}

			const result = restartTTimer(timer)

			expect(result).toBeNull()
		})
	})
})
