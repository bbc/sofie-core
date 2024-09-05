import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'
import { logger } from '../../../lib/logging'
import { profiler } from '../profiler'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { NrcsIngestDataCache } from '../../collections'
import {
	IngestCacheType,
	IngestDataCacheObj,
	IngestDataCacheObjRundown,
	IngestDataCacheObjSegment,
} from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { groupByToMap } from '@sofie-automation/corelib/dist/lib'

export class RundownIngestDataCache {
	private constructor(private readonly rundownId: RundownId, private readonly documents: IngestDataCacheObj[]) {}

	static async create(rundownId: RundownId): Promise<RundownIngestDataCache> {
		const docs = await NrcsIngestDataCache.findFetchAsync({ rundownId })

		return new RundownIngestDataCache(rundownId, docs)
	}

	fetchRundown(): IngestRundown | undefined {
		const span = profiler.startSpan('ingest.ingestCache.loadCachedRundownData')

		const cachedRundown = this.documents.find(
			(e): e is IngestDataCacheObjRundown => e.type === IngestCacheType.RUNDOWN
		)
		if (!cachedRundown) {
			span?.end()
			return undefined
		}

		const ingestRundown = cachedRundown.data

		const segmentMap = groupByToMap(this.documents, 'segmentId')
		for (const objs of segmentMap.values()) {
			const segmentEntry = objs.find((e): e is IngestDataCacheObjSegment => e.type === IngestCacheType.SEGMENT)
			if (segmentEntry) {
				const ingestSegment = segmentEntry.data

				for (const entry of objs) {
					if (entry.type === IngestCacheType.PART) {
						ingestSegment.parts.push(entry.data)
					}
				}

				ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)
				ingestRundown.segments.push(ingestSegment)
			}
		}

		ingestRundown.segments = _.sortBy(ingestRundown.segments, (s) => s.rank)

		span?.end()
		return ingestRundown
	}

	fetchSegment(segmentId: SegmentId): IngestSegment | undefined {
		const cacheEntries = this.documents.filter((d) => d.segmentId && d.segmentId === segmentId)

		const segmentEntries = cacheEntries.filter(
			(e): e is IngestDataCacheObjSegment => e.type === IngestCacheType.SEGMENT
		)
		if (segmentEntries.length > 1)
			logger.warn(
				`There are multiple segments (${cacheEntries.length}) in IngestDataCache for rundownId: "${this.rundownId}", segmentId: "${segmentId}"`
			)

		const segmentEntry = segmentEntries[0]
		if (!segmentEntry) return undefined
		if (segmentEntry.type !== IngestCacheType.SEGMENT) throw new Meteor.Error(500, 'Wrong type on cached segment')

		const ingestSegment = segmentEntry.data

		for (const entry of cacheEntries) {
			if (entry.type === IngestCacheType.PART) {
				ingestSegment.parts.push(entry.data)
			}
		}

		ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)

		return ingestSegment
	}
}
