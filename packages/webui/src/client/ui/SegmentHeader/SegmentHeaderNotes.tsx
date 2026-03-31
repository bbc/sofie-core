import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { UIPieceContentStatus } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnes } from '@sofie-automation/corelib/dist/mongo'
import { UISegmentPartNote } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { literal } from 'shuttle-webhid'
import { Notifications } from '../../collections'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'
import { UISegmentPartNotes, UIPieceContentStatuses, UIPartInstances, UIParts } from '../Collections'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import type { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'

export interface SegmentHeaderNotesProps {
	/** Override the classname of the root div */
	classname?: string
	segmentId: SegmentId
	onHeaderNoteClick?: (segmentId: SegmentId, level: NoteSeverity) => void
}
interface SegmentNoteCounts {
	criticalNotes: number
	warningNotes: number
	headerNotes: ITranslatableMessage[]
}

export function SegmentHeaderNotes({ classname, segmentId, onHeaderNoteClick }: SegmentHeaderNotesProps): JSX.Element {
	const { t } = useTranslation()

	const { criticalNotes, warningNotes, headerNotes } = useTracker<SegmentNoteCounts>(
		() => getReactivePieceNoteCountsForSegment(segmentId),
		[segmentId],
		{ criticalNotes: 0, warningNotes: 0, headerNotes: [] }
	)

	return (
		<>
			{(criticalNotes > 0 || warningNotes > 0) && (
				<div className={classname ?? 'segment-timeline__title__notes'}>
					{criticalNotes > 0 && (
						<div
							className="segment-timeline__title__notes__note segment-timeline__title__notes__note--critical"
							onClick={() => onHeaderNoteClick?.(segmentId, NoteSeverity.ERROR)}
							aria-label={t('Critical problems')}
						>
							<CriticalIconSmall />
							<div className="segment-timeline__title__notes__count">{criticalNotes}</div>
						</div>
					)}
					{warningNotes > 0 && (
						<div
							className="segment-timeline__title__notes__note segment-timeline__title__notes__note--warning"
							onClick={() => onHeaderNoteClick?.(segmentId, NoteSeverity.WARNING)}
							aria-label={t('Warnings')}
						>
							<WarningIconSmall />
							<div className="segment-timeline__title__notes__count">{warningNotes}</div>
						</div>
					)}
				</div>
			)}

			{headerNotes.map((event, index) => (
				<div key={index} className="segment-timeline__segment-event-identifier">
					{event.key}
				</div>
			))}
		</>
	)
}

function getReactivePieceNoteCountsForSegment(segmentId: SegmentId): SegmentNoteCounts {
	const segmentNoteCounts: SegmentNoteCounts = {
		criticalNotes: 0,
		warningNotes: 0,
		headerNotes: [],
	}

	const rawNotes = UISegmentPartNotes.find({ segmentId }, { fields: { note: 1 } }).fetch() as Pick<
		UISegmentPartNote,
		'note'
	>[]
	for (const note of rawNotes) {
		switch (note.note.type) {
			case NoteSeverity.ERROR:
				segmentNoteCounts.criticalNotes++
				break
			case NoteSeverity.WARNING:
				segmentNoteCounts.warningNotes++
				break
			case NoteSeverity.INFO:
				// Ignore
				break
			default:
				assertNever(note.note.type)
		}
	}

	const mediaObjectStatuses = UIPieceContentStatuses.find(
		{
			segmentId,
		},
		{
			fields: literal<MongoFieldSpecifierOnes<UIPieceContentStatus>>({
				_id: 1,
				// @ts-expect-error deep property
				'status.status': 1,
			}),
		}
	).fetch() as Array<Pick<UIPieceContentStatus, '_id'> & { status: Pick<UIPieceContentStatus['status'], 'status'> }>

	if (!getIgnorePieceContentStatus()) {
		for (const obj of mediaObjectStatuses) {
			switch (obj.status.status) {
				case PieceStatusCode.OK:
				case PieceStatusCode.SOURCE_NOT_READY:
				case PieceStatusCode.UNKNOWN:
					// Ignore
					break
				case PieceStatusCode.SOURCE_NOT_SET:
					segmentNoteCounts.criticalNotes++
					break
				case PieceStatusCode.SOURCE_HAS_ISSUES:
				case PieceStatusCode.SOURCE_BROKEN:
				case PieceStatusCode.SOURCE_MISSING:
				case PieceStatusCode.SOURCE_UNKNOWN_STATE:
					segmentNoteCounts.warningNotes++
					break
				default:
					assertNever(obj.status.status)
					segmentNoteCounts.warningNotes++
					break
			}
		}
	}

	// Find any relevant notifications
	const partInstancesForSegment = UIPartInstances.find(
		{ segmentId: segmentId, reset: { $ne: true } },
		{
			fields: {
				_id: 1,
				// @ts-expect-error deep property
				'part._id': 1,
				'part._rank': 1,
				'part.segmentHeaderNotes': 1,
			},
		}
	).fetch() as Array<
		Pick<PartInstance, '_id'> & { part: Pick<PartInstance['part'], '_id' | '_rank' | 'segmentHeaderNotes'> }
	>
	const rawNotifications = Notifications.find(
		{
			$or: [
				{ 'relatedTo.segmentId': segmentId },
				{
					'relatedTo.partInstanceId': { $in: partInstancesForSegment.map((p) => p._id) },
				},
			],
		},
		{
			fields: {
				severity: 1,
				message: 1,
			},
		}
	).fetch() as Array<Pick<DBNotificationObj, 'severity' | 'message'>>
	for (const notification of rawNotifications) {
		switch (notification.severity) {
			case NoteSeverity.ERROR:
				segmentNoteCounts.criticalNotes++
				break
			case NoteSeverity.WARNING:
				segmentNoteCounts.warningNotes++
				break
			case NoteSeverity.INFO:
				// Ignore
				break
			default:
				assertNever(notification.severity)
		}
	}

	const partsForSegment = UIParts.find(
		{ segmentId },
		{
			fields: {
				_id: 1,
				_rank: 1,
				segmentHeaderNotes: 1,
			},
		}
	).fetch() as Array<Pick<DBPart, '_id' | '_rank' | 'segmentHeaderNotes'>>

	// Collect the segment header notes from the parts in part rank order, with partinstance taking priority over the part
	const partIdsWithInstance = new Set(partInstancesForSegment.map((pi) => pi.part._id))

	const mergedNoteEntries: Array<{ rank: number; notes: ITranslatableMessage[] }> = []
	for (const partInstance of partInstancesForSegment) {
		if (partInstance.part.segmentHeaderNotes?.length) {
			mergedNoteEntries.push({ rank: partInstance.part._rank, notes: partInstance.part.segmentHeaderNotes })
		}
	}
	for (const part of partsForSegment) {
		if (partIdsWithInstance.has(part._id)) continue
		if (part.segmentHeaderNotes?.length) {
			mergedNoteEntries.push({ rank: part._rank, notes: part.segmentHeaderNotes })
		}
	}

	mergedNoteEntries.sort((a, b) => a.rank - b.rank)
	for (const entry of mergedNoteEntries) {
		segmentNoteCounts.headerNotes.push(...entry.notes)
	}

	return segmentNoteCounts
}
