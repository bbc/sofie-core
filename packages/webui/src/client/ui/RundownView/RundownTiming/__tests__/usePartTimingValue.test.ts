import { renderHook, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getPartTimingStateDocId, type PartTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const SEGMENT_ID = protectString<SegmentId>('segment0')
const PART_ID = protectString<PartId>('part0')
const NOW = 100000

/** The document the mocked collection will return */
let publishedDoc: PartTimingStateDoc | undefined

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => (publishedDoc && publishedDoc._id === id ? publishedDoc : undefined),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => NOW,
}))

import { TimerValueMode, usePartTimingValue, type PartTimerKey } from '../usePlaylistTimingValue.js'
import { RundownTiming, TimingTickResolution } from '../RundownTiming.js'

function makeDoc(fields: Partial<PartTimingStateDoc>): PartTimingStateDoc {
	return {
		_id: getPartTimingStateDocId(PART_ID),
		type: 'part',
		playlistId: PLAYLIST_ID,
		segmentId: SEGMENT_ID,
		partId: PART_ID,
		rank: 0,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
		...fields,
	}
}

/** Dispatch a timing tick, as RundownTimingProvider does */
function tick(currentTime: number): void {
	act(() => {
		window.dispatchEvent(new CustomEvent(RundownTiming.Events.timeupdateSynced, { detail: { currentTime } }))
	})
}

/** Dispatch high-resolution ticks a frame apart, as RundownTimingProvider does */
function dispatchHighResolutionTicks(count: number, startingAt: number): void {
	for (let i = 0; i < count; i++) {
		act(() => {
			window.dispatchEvent(
				new CustomEvent(RundownTiming.Events.timeupdateHighResolution, {
					detail: { currentTime: startingAt + i * 16 },
				})
			)
		})
	}
}

/**
 * Read a timer on every high-resolution tick while it moves and on no tick while it holds, counting
 * how many times the caller is rendered
 */
function renderHighResolutionOnlyWhileMoving(timer: PartTimerKey, mode: TimerValueMode) {
	const renders = { count: 0 }
	const hook = renderHook(() => {
		renders.count++
		return usePartTimingValue(PART_ID, timer, mode, {
			tickResolution: TimingTickResolution.High,
			tickResolutionWhileHolding: TimingTickResolution.None,
		})
	})
	return { ...hook, renders }
}

describe('usePartTimingValue', () => {
	beforeEach(() => {
		publishedDoc = undefined
	})

	it('returns null when nothing is published for the part', () => {
		const { result } = renderHook(() => usePartTimingValue(PART_ID, 'expectedDuration', TimerValueMode.Duration))

		expect(result.current).toBeNull()
	})

	it('returns null when the document omits the requested timer', () => {
		publishedDoc = makeDoc({ expectedDuration: { paused: true, duration: 10000 } })

		const { result } = renderHook(() => usePartTimingValue(PART_ID, 'played', TimerValueMode.CountUp))

		expect(result.current).toBeNull()
	})

	it('reads a static duration', () => {
		publishedDoc = makeDoc({ expectedDuration: { paused: true, duration: 10000 } })

		const { result } = renderHook(() => usePartTimingValue(PART_ID, 'expectedDuration', TimerValueMode.Duration))
		expect(result.current).toBe(10000)

		tick(NOW + 60000)
		expect(result.current).toBe(10000)
	})

	describe('count-up values', () => {
		it('reads played time as a positive, growing number', () => {
			// on air since 95000
			publishedDoc = makeDoc({ played: { paused: true, duration: 0, resumesAt: 95000 } })

			const { result } = renderHook(() => usePartTimingValue(PART_ID, 'played', TimerValueMode.CountUp))
			expect(result.current).toBe(5000)

			tick(105000)
			expect(result.current).toBe(10000)
		})

		it('reads a finished part as its frozen played time', () => {
			publishedDoc = makeDoc({ played: { paused: true, duration: 0 - 8000 } })

			const { result } = renderHook(() => usePartTimingValue(PART_ID, 'played', TimerValueMode.CountUp))
			expect(result.current).toBe(8000)

			tick(NOW + 60000)
			expect(result.current).toBe(8000)
		})

		it('stays at zero until a start that is still in the future', () => {
			// a take in a multi-gateway studio, where the part starts a moment from now
			publishedDoc = makeDoc({ played: { paused: true, duration: 0, resumesAt: 100200 } })

			const { result } = renderHook(() => usePartTimingValue(PART_ID, 'played', TimerValueMode.CountUp))
			expect(result.current).toBe(0)

			tick(100100)
			expect(result.current).toBe(0)

			// and starts counting the moment it arrives, with no new document needed
			tick(100200)
			expect(result.current).toBe(0)
			tick(101200)
			expect(result.current).toBe(1000)
		})

		it('holds the display duration at its planned value until the part overruns it', () => {
			// on air since 95000, planned for 10s, so it starts growing at 105000
			publishedDoc = makeDoc({ liveDisplayDuration: { paused: true, duration: 0 - 10000, resumesAt: 105000 } })

			const { result } = renderHook(() =>
				usePartTimingValue(PART_ID, 'liveDisplayDuration', TimerValueMode.CountUp)
			)
			expect(result.current).toBe(10000)

			tick(104000)
			expect(result.current).toBe(10000)

			tick(112000)
			expect(result.current).toBe(17000)
		})

		it('gives zero rather than -0 for nothing elapsed', () => {
			publishedDoc = makeDoc({ played: { paused: true, duration: 0 } })

			const { result } = renderHook(() => usePartTimingValue(PART_ID, 'played', TimerValueMode.CountUp))

			expect(Object.is(result.current, 0)).toBe(true)
		})
	})

	describe('with no ticks while the timer holds', () => {
		it('is not re-rendered by any tick while the timer holds its value', () => {
			// a part that has played for 8s and is done
			publishedDoc = makeDoc({ played: { paused: true, duration: 0 - 8000 } })

			const { result, renders } = renderHighResolutionOnlyWhileMoving('played', TimerValueMode.CountUp)
			const rendersBeforeTicks = renders.count

			dispatchHighResolutionTicks(60, NOW + 16)

			expect(renders.count - rendersBeforeTicks).toBe(0)
			expect(result.current).toBe(8000)
		})

		it('is re-rendered on every tick while the timer moves', () => {
			// on air since 95000
			publishedDoc = makeDoc({ played: { paused: true, duration: 0, resumesAt: 95000 } })

			const { result, renders } = renderHighResolutionOnlyWhileMoving('played', TimerValueMode.CountUp)
			const rendersBeforeTicks = renders.count

			dispatchHighResolutionTicks(60, NOW + 16)

			expect(renders.count - rendersBeforeTicks).toBe(60)
			// the last tick was at 100960
			expect(result.current).toBe(5960)
		})

		it('keeps ticking for a timestamp, since the moment a timer that holds would reach zero moves with the clock', () => {
			// holding at 30s, so it reaches zero 30s after whenever it is read
			publishedDoc = makeDoc({ expectedDuration: { paused: true, duration: 30000 } })

			const { result, renders } = renderHighResolutionOnlyWhileMoving(
				'expectedDuration',
				TimerValueMode.Timestamp
			)
			const rendersBeforeTicks = renders.count

			dispatchHighResolutionTicks(60, NOW + 16)

			expect(renders.count - rendersBeforeTicks).toBe(60)
			// the last tick was at 100960
			expect(result.current).toBe(100960 + 30000)
		})
	})

	it('ignores a document of another type sharing the collection', () => {
		publishedDoc = {
			...makeDoc({ expectedDuration: { paused: true, duration: 10000 } }),
			type: 'segment' as unknown as 'part',
		}

		const { result } = renderHook(() => usePartTimingValue(PART_ID, 'expectedDuration', TimerValueMode.Duration))

		expect(result.current).toBeNull()
	})
})
