import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import {
	getSegmentTimingStateDocId,
	type SegmentTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { CountdownType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const SEGMENT_ID = protectString<SegmentId>('segment0')

/** What the mocked system clock reads */
let currentTime = 129000

/** The documents the mocked collection holds, by id */
const publishedDocs = new Map<unknown, TimingStateDoc>()

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => publishedDocs.get(id),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))

import { SegmentDuration } from '../SegmentDuration.js'
import { RundownTiming } from '../RundownTiming.js'

/** The moment the on-air segment's remaining time reaches zero: 60 ms past a whole second */
const SEGMENT_ZERO_TIME = 130060

const ON_AIR_SEGMENT_DOC: SegmentTimingStateDoc = {
	_id: getSegmentTimingStateDocId(SEGMENT_ID),
	type: 'segment',
	playlistId: PLAYLIST_ID,
	segmentId: SEGMENT_ID,
	countdownType: CountdownType.PART_EXPECTED_DURATION,
	plannedDuration: { paused: true, duration: 30000 },
	// on air since 30 s before its zero, counting up as a negative value
	playedOut: { paused: false, zeroTime: SEGMENT_ZERO_TIME - 30000 },
	remaining: { paused: false, zeroTime: SEGMENT_ZERO_TIME },
}

/** Dispatch a timing tick, as RundownTimingProvider does */
function dispatchTick(event: RundownTiming.Events, tickTime: number): void {
	act(() => {
		window.dispatchEvent(new CustomEvent(event, { detail: { currentTime: tickTime } }))
	})
}

function renderSegmentDuration(): HTMLElement | null {
	const segment = { _id: SEGMENT_ID } as DBSegment
	const { container } = render(<SegmentDuration segment={segment} parts={[]} />)
	return container.querySelector<HTMLElement>('[role="timer"]')
}

describe('SegmentDuration', () => {
	beforeEach(() => {
		currentTime = 129000
		publishedDocs.clear()
		publishedDocs.set(ON_AIR_SEGMENT_DOC._id, ON_AIR_SEGMENT_DOC)
	})

	it('reads the remaining time at the last whole second, as every other countdown does', () => {
		const timer = renderSegmentDuration()
		expect(timer?.textContent).toBe('00:02')

		// just after a whole second, the provider sends a high-resolution tick with the time, and the synced tick
		// with the time rounded down to the whole second: 60 ms before the zero
		dispatchTick(RundownTiming.Events.timeupdateHighResolution, 130003)
		dispatchTick(RundownTiming.Events.timeupdateSynced, 130000)
		expect(timer?.textContent).toBe('00:01')

		// the high-resolution ticks of the rest of that second, also those after the zero, leave it as it is
		dispatchTick(RundownTiming.Events.timeupdateHighResolution, 130500)
		dispatchTick(RundownTiming.Events.timeupdateHighResolution, 130983)
		expect(timer?.textContent).toBe('00:01')

		// it shows the overrun from the next whole second on
		dispatchTick(RundownTiming.Events.timeupdateHighResolution, 131001)
		dispatchTick(RundownTiming.Events.timeupdateSynced, 131000)
		expect(timer?.textContent).toBe('+00:01')
	})
})
