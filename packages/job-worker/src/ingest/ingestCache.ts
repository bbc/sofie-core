import { RundownId, SegmentId, IngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IngestDataCacheObj,
	IngestCacheType,
	IngestDataCacheObjRundown,
	IngestDataCacheObjSegment,
	IngestDataCacheObjPart,
} from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import _ = require('underscore')
import { IngestPart, IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs'
import { getPartId, getSegmentId } from './lib'
import { SetOptional } from 'type-fest'
import { groupByToMap, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { AnyBulkWriteOperation } from 'mongodb'
import { diffAndReturnLatestObjects } from './model/implementation/utils'
import { ICollection } from '../db'
import { getCurrentTime } from '../lib'

export class RundownIngestDataCache {
	readonly #changedDocumentIds = new Set<IngestDataCacheObjId>()

	private constructor(
		private readonly context: JobContext,
		private readonly collection: ICollection<IngestDataCacheObj>,
		private readonly rundownId: RundownId,
		private documents: IngestDataCacheObj[]
	) {}

	static async create(
		context: JobContext,
		collection: ICollection<IngestDataCacheObj>,
		rundownId: RundownId
	): Promise<RundownIngestDataCache> {
		const docs = await collection.findFetch({ rundownId })

		return new RundownIngestDataCache(context, collection, rundownId, docs)
	}

	/** Check whether this cache contains any documents */
	isEmpty(): boolean {
		return this.documents.length === 0
	}

	/**
	 * Fetch the IngestRundown contained in the cache
	 * Note: This does not deep clone the objects, so the returned object should not be modified
	 */
	fetchRundown(): IngestRundown | undefined {
		const span = this.context.startSpan('ingest.ingestCache.loadCachedRundownData')

		const cachedRundown = this.documents.find(
			(e): e is IngestDataCacheObjRundown => e.type === IngestCacheType.RUNDOWN
		)
		if (!cachedRundown) {
			span?.end()
			return undefined
		}

		const ingestRundown: IngestRundown = {
			...cachedRundown.data,
			segments: [],
		}

		const hasSegmentId = (obj: IngestDataCacheObj): obj is IngestDataCacheObjSegment | IngestDataCacheObjPart => {
			return !!obj.segmentId
		}

		const segmentMap = groupByToMap(this.documents.filter(hasSegmentId), 'segmentId')
		for (const objs of segmentMap.values()) {
			const segmentEntry = objs.find((e): e is IngestDataCacheObjSegment => e.type === IngestCacheType.SEGMENT)
			if (segmentEntry) {
				const ingestSegment: IngestSegment = {
					...segmentEntry.data,
					parts: [],
				}

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

	/**
	 * Replace the contents of the cache with the given IngestRundown
	 * This will diff and replace the documents in the cache
	 * @param ingestRundown The new IngestRundown to store in the cache
	 */
	replace(ingestRundown: IngestRundown): void {
		const generator = new RundownIngestDataCacheGenerator(this.rundownId)
		const cacheEntries: IngestDataCacheObj[] = generator.generateCacheForRundown(ingestRundown)

		this.documents = diffAndReturnLatestObjects(this.#changedDocumentIds, this.documents, cacheEntries)
	}

	/**
	 * Delete the contents of the cache
	 */
	delete(): void {
		// Mark each document for deletion
		for (const doc of this.documents) {
			this.#changedDocumentIds.add(doc._id)
		}

		this.documents = []
	}

	/**
	 * Remove all documents from the cache other than the ids provided
	 * @param documentIdsToKeep The IDs of the documents to keep in the cache
	 */
	removeAllOtherDocuments(documentIdsToKeep: IngestDataCacheObjId[]): void {
		const documentIdsToKeepSet = new Set<IngestDataCacheObjId>(documentIdsToKeep)

		const newDocuments: IngestDataCacheObj[] = []
		for (const document of this.documents) {
			if (!documentIdsToKeepSet.has(document._id)) {
				this.#changedDocumentIds.add(document._id)
			} else {
				newDocuments.push(document)
			}
		}
		this.documents = newDocuments
	}

	/**
	 * Replace/insert a set of documents into the cache
	 * This can be used to insert or update multiple documents at once
	 * This does not diff the documents, it assumes that has already been done prior to calling this method
	 * @param changedCacheObjects Documents to store in the cache
	 */
	replaceDocuments(changedCacheObjects: IngestDataCacheObj[]): void {
		const newDocumentsMap = normalizeArrayToMap(this.documents, '_id')

		for (const newDocument of changedCacheObjects) {
			this.#changedDocumentIds.add(newDocument._id)
			newDocumentsMap.set(newDocument._id, newDocument)
		}

		this.documents = Array.from(newDocumentsMap.values())
	}

	/**
	 * Write any changes in the cache to the database
	 */
	async saveToDatabase(): Promise<void> {
		if (this.#changedDocumentIds.size === 0) return

		const documentsMap = normalizeArrayToMap(this.documents, '_id')

		const modifiedTime = getCurrentTime()

		const updates: AnyBulkWriteOperation<IngestDataCacheObj>[] = []
		const removedIds: IngestDataCacheObjId[] = []
		for (const changedId of this.#changedDocumentIds) {
			const newDoc = documentsMap.get(changedId)
			if (!newDoc) {
				removedIds.push(changedId)
			} else {
				updates.push({
					replaceOne: {
						filter: {
							_id: changedId,
						},
						replacement: {
							...newDoc,
							modified: modifiedTime,
						},
						upsert: true,
					},
				})
			}
		}

		if (removedIds.length) {
			updates.push({
				deleteMany: {
					filter: {
						_id: { $in: removedIds as any },
					},
				},
			})
		}

		await this.collection.bulkWrite(updates)
	}
}

export class RundownIngestDataCacheGenerator {
	constructor(public readonly rundownId: RundownId) {}

	getPartObjectId(partExternalId: string): IngestDataCacheObjId {
		return protectString<IngestDataCacheObjId>(`${this.rundownId}_part_${partExternalId}`)
	}
	getSegmentObjectId(segmentExternalId: string): IngestDataCacheObjId {
		return protectString<IngestDataCacheObjId>(`${this.rundownId}_segment_${segmentExternalId}`)
	}
	getRundownObjectId(): IngestDataCacheObjId {
		return protectString<IngestDataCacheObjId>(unprotectString(this.rundownId))
	}

	generatePartObject(segmentId: SegmentId, part: IngestPart): IngestDataCacheObjPart {
		return {
			_id: this.getPartObjectId(part.externalId),
			type: IngestCacheType.PART,
			rundownId: this.rundownId,
			segmentId: segmentId,
			partId: getPartId(this.rundownId, part.externalId),
			modified: 0, // Populated when saving
			data: part,
		}
	}

	generateSegmentObject(ingestSegment: SetOptional<IngestSegment, 'parts'>): IngestDataCacheObjSegment {
		return {
			_id: this.getSegmentObjectId(ingestSegment.externalId),
			type: IngestCacheType.SEGMENT,
			rundownId: this.rundownId,
			segmentId: getSegmentId(this.rundownId, ingestSegment.externalId),
			modified: 0, // Populated when saving
			data: {
				...ingestSegment,
				parts: [], // omit the parts, they come as separate objects
			},
		}
	}

	generateRundownObject(ingestRundown: SetOptional<IngestRundown, 'segments'>): IngestDataCacheObjRundown {
		return {
			_id: this.getRundownObjectId(),
			type: IngestCacheType.RUNDOWN,
			rundownId: this.rundownId,
			modified: 0, // Populated when saving
			data: {
				...ingestRundown,
				segments: [], // omit the segments, they come as separate objects
			},
		}
	}

	generateCacheForRundown(ingestRundown: IngestRundown): IngestDataCacheObj[] {
		const cacheEntries: IngestDataCacheObj[] = []

		const rundown = this.generateRundownObject(ingestRundown)
		cacheEntries.push(rundown)

		for (const segment of ingestRundown.segments) {
			cacheEntries.push(...this.generateCacheForSegment(segment))
		}

		return cacheEntries
	}

	private generateCacheForSegment(ingestSegment: IngestSegment): IngestDataCacheObj[] {
		const cacheEntries: Array<IngestDataCacheObjSegment | IngestDataCacheObjPart> = []

		const segment = this.generateSegmentObject(ingestSegment)
		cacheEntries.push(segment)

		const segmentId = getSegmentId(this.rundownId, ingestSegment.externalId)
		for (const part of ingestSegment.parts) {
			cacheEntries.push(this.generatePartObject(segmentId, part))
		}

		return cacheEntries
	}
}
