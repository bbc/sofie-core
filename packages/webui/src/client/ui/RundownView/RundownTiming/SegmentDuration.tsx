import classNames from 'classnames'
import type { ReactNode } from 'react'
import { useTiming } from './withTiming.js'
import { RundownUtils } from '../../../lib/rundown.js'
import type { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer.js'
import { getPartInstanceTimingId } from '../../../lib/rundownTiming.js'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CountdownType } from '@sofie-automation/blueprints-integration'

interface ISegmentDurationProps {
	segment: DBSegment
	parts: PartUi[]
	label?: ReactNode
	className?: string
	/** If set, the timer will display just the played out duration */
	countUp?: boolean
	/** Always show planned segment duration instead of counting up/down */
	fixed?: boolean
}

/**
 * A presentational component that will render a counter that will show how much content
 * is left in a segment consisting of given parts
 */
export function SegmentDuration(props: ISegmentDurationProps): JSX.Element | null {
	const timingDurations = useTiming()

	let duration: number | undefined = undefined
	let playedOut = 0

	const segmentBudgetDuration = props.segment.segmentTiming?.budgetDuration
	const segmentTimingType = props.segment.segmentTiming?.countdownType ?? CountdownType.PART_EXPECTED_DURATION

	let budget = segmentBudgetDuration ?? 0
	let hardFloor = false

	if (segmentTimingType === CountdownType.SEGMENT_BUDGET_DURATION) {
		hardFloor = true

		if (timingDurations.currentSegmentId === props.segment._id) {
			duration = timingDurations.remainingBudgetOnCurrentSegment ?? segmentBudgetDuration ?? 0
		} else {
			duration = segmentBudgetDuration ?? 0
		}
	} else {
		if (props.parts && timingDurations.partPlayed) {
			const { partPlayed } = timingDurations

			if (segmentBudgetDuration === undefined) {
				// Compute the segment budget using the blueprint's static transitionOverlap values
				// (part.durations.transitionOverlap), NOT partPlayoutTimings. This keeps the budget
				// stable across the take event — partPlayoutTimings is only computed at take time
				// and would otherwise cause a visible jump in the displayed duration.
				let position = 0
				let prevContrib = 0
				for (const part of props.parts) {
					if (part.instance.orphaned || part.instance.part.untimed) continue
					const d = part.instance.part.durations
					const ewt = (d.expectedDuration ?? 0) - (d.transitionOverlap ?? 0)
					const advance = Math.max(ewt, -prevContrib)
					prevContrib = Math.max(0, ewt)
					position = Math.max(0, position + advance)
				}
				budget = position
			}

			// Compute playedOut, adjusting completed parts for shared overlap time.
			// timings.duration for a completed part A includes the overlap period:
			//   A.timings.duration = B_start + B.partPlayoutTimings.fromPartRemaining - A_start
			// Subtracting fromPartRemaining gives A's actual schedule advance (B_start - A_start).
			for (let i = 0; i < props.parts.length; i++) {
				const part = props.parts[i]
				if (part.instance.part.untimed) continue
				const played = partPlayed[getPartInstanceTimingId(part.instance)] ?? 0
				if (part.instance.timings?.duration) {
					// Part has completed — subtract the next part's overlap to undo the inflation
					const nextPart = props.parts[i + 1]
					const nextOverlap = nextPart ? (nextPart.instance.part.durations.transitionOverlap ?? 0) : 0
					playedOut += Math.max(0, played - nextOverlap)
				} else {
					playedOut += played
				}
			}
		}

		duration = budget - playedOut
	}

	const showNegativeStyling = !props.fixed && !props.countUp

	let value = duration
	if (props.fixed) {
		value = budget
	} else if (props.countUp) {
		value = playedOut
	}

	if (duration !== undefined) {
		return (
			<>
				{props.label}
				<span
					className={classNames(props.className, {
						negative: showNegativeStyling && duration < 0,
					})}
					role="timer"
				>
					{RundownUtils.formatDiffToTimecode(value, false, false, true, false, true, '+', false, hardFloor)}
				</span>
			</>
		)
	}

	return null
}
