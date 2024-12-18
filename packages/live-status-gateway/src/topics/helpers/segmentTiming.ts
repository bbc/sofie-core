import { CountdownType } from '@sofie-automation/blueprints-integration'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { SegmentCountdownType, SegmentTiming } from '@sofie-automation/live-status-gateway-api'

export interface CurrentSegmentTiming extends SegmentTiming {
	projectedEndTime: number
}

export function calculateCurrentSegmentTiming(
	segment: DBSegment,
	currentPartInstance: DBPartInstance,
	firstInstanceInSegmentPlayout: DBPartInstance | undefined,
	segmentPartInstances: DBPartInstance[],
	segmentParts: DBPart[]
): CurrentSegmentTiming {
	const segmentTiming = calculateSegmentTiming(segment, segmentParts)
	const playedDurations = segmentPartInstances.reduce((sum, partInstance) => {
		return (partInstance.timings?.duration ?? 0) + sum
	}, 0)
	const currentPartInstanceStart =
		currentPartInstance.timings?.reportedStartedPlayback ??
		currentPartInstance.timings?.plannedStartedPlayback ??
		Date.now()
	const leftToPlay = segmentTiming.expectedDurationMs - playedDurations
	const projectedEndTime = leftToPlay + currentPartInstanceStart
	const projectedBudgetEndTime =
		(firstInstanceInSegmentPlayout?.timings?.reportedStartedPlayback ??
			firstInstanceInSegmentPlayout?.timings?.plannedStartedPlayback ??
			Date.now()) + (segmentTiming.budgetDurationMs ?? 0)
	return {
		...segmentTiming,
		projectedEndTime: segmentTiming.budgetDurationMs != null ? projectedBudgetEndTime : projectedEndTime,
	}
}

export function calculateSegmentTiming(segment: DBSegment, segmentParts: DBPart[]): SegmentTiming {
	return {
		budgetDurationMs: segment.segmentTiming?.budgetDuration,
		expectedDurationMs: segmentParts.reduce<number>((sum, part): number => {
			return part.expectedDurationWithTransition != null && !part.untimed
				? sum + part.expectedDurationWithTransition
				: sum
		}, 0),
		countdownType: translateSegmentCountdownType(segment.segmentTiming?.countdownType),
	}
}

function translateSegmentCountdownType(type: CountdownType | undefined): SegmentCountdownType | undefined {
	switch (type) {
		case undefined:
			return undefined
		case CountdownType.PART_EXPECTED_DURATION:
			return SegmentCountdownType.PART_EXPECTED_DURATION
		case CountdownType.SEGMENT_BUDGET_DURATION:
			return SegmentCountdownType.SEGMENT_BUDGET_DURATION
		default:
			assertNever(type)
			// Cast and return the value anyway, so that the application works
			return type as any as SegmentCountdownType
	}
}
