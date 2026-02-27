import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

/**
 * Compute the sum of expected durations of all parts after the current part.
 * Uses partStartsAt to determine ordering and partExpectedDurations for the values.
 * Returns 0 if the current part can't be found or there are no future parts.
 */
export function getRemainingDurationFromCurrentPart(
	currentPartInstanceId: PartInstanceId,
	partStartsAt: Record<string, number>,
	partExpectedDurations: Record<string, number>
): number | null {
	const currentKey = unprotectString(currentPartInstanceId)
	const currentStartsAt = partStartsAt[currentKey]

	if (currentStartsAt == null) return null

	let remaining = 0
	for (const [partId, startsAt] of Object.entries<number>(partStartsAt)) {
		if (startsAt > currentStartsAt) {
			remaining += partExpectedDurations[partId] ?? 0
		}
	}
	return remaining
}
