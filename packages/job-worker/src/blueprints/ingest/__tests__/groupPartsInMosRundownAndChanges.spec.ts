import {
	NrcsIngestChangeDetails,
	NrcsIngestPartChangeDetails,
	NrcsIngestRundownChangeDetails,
	NrcsIngestSegmentChangeDetailsEnum,
	IngestRundown,
	GroupPartsInMosRundownAndChangesResult,
	IngestChangeType,
} from '@sofie-automation/blueprints-integration'
import { Complete, clone } from '@sofie-automation/corelib/dist/lib'
import { groupMosPartsIntoIngestSegments, groupPartsInRundownAndChanges } from '../groupPartsInRundownAndChanges'
import { updateRanksBasedOnOrder } from '../../../ingest/mosDevice/lib'

describe('groupPartsInMosRundownAndChanges', () => {
	function groupMosPartsInRundownAndChanges(
		nrcsIngestRundown: IngestRundown,
		previousNrcsIngestRundown: IngestRundown | undefined,
		ingestChanges: Omit<NrcsIngestChangeDetails, 'segmentOrderChanged'>
	) {
		return groupPartsInRundownAndChanges(nrcsIngestRundown, previousNrcsIngestRundown, ingestChanges, (segments) =>
			groupMosPartsIntoIngestSegments(nrcsIngestRundown.externalId, segments, ';')
		)
	}

	function createBasicMosIngestRundown(): { nrcsIngestRundown: IngestRundown; combinedIngestRundown: IngestRundown } {
		const rawRundown: IngestRundown = {
			externalId: 'rundown0',
			type: 'mos',
			name: 'Rundown',
			segments: [
				{
					externalId: 'segment-s1p1',
					name: 'SEGMENT1;PART1',
					rank: 0,
					parts: [
						{
							externalId: 's1p1',
							name: 'SEGMENT1;PART1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment-s1p2',
					name: 'SEGMENT1;PART2',
					rank: 1,
					parts: [
						{
							externalId: 's1p2',
							name: 'SEGMENT1;PART2',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment-s2p1',
					name: 'SEGMENT2;PART1',
					rank: 2,
					parts: [
						{
							externalId: 's2p1',
							name: 'SEGMENT2;PART1',
							rank: 0,
						},
					],
				},
				{
					externalId: 'segment-s2p2',
					name: 'SEGMENT2;PART2',
					rank: 3,
					parts: [
						{
							externalId: 's2p2',
							name: 'SEGMENT2;PART2',
							rank: 0,
						},
					],
				},
			],
		}
		const groupedRundown: IngestRundown = {
			externalId: 'rundown0',
			type: 'mos',
			name: 'Rundown',
			segments: [
				{
					externalId: 'rundown0_SEGMENT1_s1p1',
					name: 'SEGMENT1',
					rank: 0,
					parts: [
						{
							externalId: 's1p1',
							name: 'SEGMENT1;PART1',
							rank: 0,
						},
						{
							externalId: 's1p2',
							name: 'SEGMENT1;PART2',
							rank: 1,
						},
					],
				},
				{
					externalId: 'rundown0_SEGMENT2_s2p1',
					name: 'SEGMENT2',
					rank: 1,
					parts: [
						{
							externalId: 's2p1',
							name: 'SEGMENT2;PART1',
							rank: 0,
						},
						{
							externalId: 's2p2',
							name: 'SEGMENT2;PART2',
							rank: 1,
						},
					],
				},
			],
		}

		return {
			nrcsIngestRundown: rawRundown,
			combinedIngestRundown: groupedRundown,
		}
	}

	it('no previous rundown, always performs full regeneration', () => {
		const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

		const ingestChanges: NrcsIngestChangeDetails = {
			source: IngestChangeType.Ingest,
			segmentChanges: {
				'segment-s1p1': NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
			},
			segmentOrderChanged: true,
		}

		const result = groupMosPartsInRundownAndChanges(clone(nrcsIngestRundown), undefined, ingestChanges)

		expect(result).toEqual({
			nrcsIngestRundown: combinedIngestRundown,
			ingestChanges: {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
	})

	it('no change in rundown', () => {
		const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

		const ingestChanges: NrcsIngestChangeDetails = { source: IngestChangeType.Ingest }

		const result = groupMosPartsInRundownAndChanges(clone(nrcsIngestRundown), nrcsIngestRundown, ingestChanges)

		expect(result).toEqual({
			nrcsIngestRundown: combinedIngestRundown,
			ingestChanges: {
				source: IngestChangeType.Ingest,
				changedSegmentExternalIds: {},
				segmentChanges: {},
				segmentOrderChanged: false,
			},
		} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
	})

	it('propogate full regeneration', () => {
		const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

		const ingestChanges: NrcsIngestChangeDetails = {
			source: IngestChangeType.Ingest,
			rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			segmentOrderChanged: true,
		}

		const result = groupMosPartsInRundownAndChanges(clone(nrcsIngestRundown), nrcsIngestRundown, ingestChanges)

		expect(result).toEqual({
			nrcsIngestRundown: combinedIngestRundown,
			ingestChanges: {
				source: IngestChangeType.Ingest,
				changedSegmentExternalIds: {},
				segmentChanges: {},
				segmentOrderChanged: false,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
	})

	describe('segment changes', () => {
		it('part added to end of segment', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			previousIngestRundown.segments.splice(1, 1)

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {},
					segmentChanges: {
						rundown0_SEGMENT1_s1p1: {
							partChanges: {
								s1p2: NrcsIngestPartChangeDetails.Inserted,
							},
							partOrderChanged: true,
						},
					},
					segmentOrderChanged: false,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('part added to beginning of segment', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			previousIngestRundown.segments.splice(2, 1)

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {
						rundown0_SEGMENT2_s2p2: 'rundown0_SEGMENT2_s2p1',
					},
					segmentChanges: {
						rundown0_SEGMENT2_s2p1: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
					},
					segmentOrderChanged: true,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('part removed from end of segment', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			previousIngestRundown.segments.splice(2, 0, {
				externalId: 'segment-s1p3',
				name: 'SEGMENT1;PART3',
				rank: 3,
				parts: [
					{
						externalId: 's1p3',
						name: 'SEGMENT1;PART3',
						rank: 0,
					},
				],
			})

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {},
					segmentChanges: {
						rundown0_SEGMENT1_s1p1: {
							partChanges: {
								s1p3: NrcsIngestPartChangeDetails.Deleted,
							},
							partOrderChanged: true,
						},
					},
					segmentOrderChanged: false,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('part removed from beginning of segment', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			previousIngestRundown.segments.splice(2, 0, {
				externalId: 'segment-s2p0',
				name: 'SEGMENT2;PART0',
				rank: 3,
				parts: [
					{
						externalId: 's2p0',
						name: 'SEGMENT2;PART0',
						rank: 0,
					},
				],
			})

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {
						rundown0_SEGMENT2_s2p0: 'rundown0_SEGMENT2_s2p1',
					},
					segmentChanges: {
						rundown0_SEGMENT2_s2p1: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
					},
					segmentOrderChanged: true,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('part has changes', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					// Note: this is ignored for inserts/deletes
					'segment-s1p2': { anything: 'here' } as any, // Note: contents is ignored
					'segment-s2p2': NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated, // Explicitly force regeneration
				},
			}

			const previousIngestRundown = clone(nrcsIngestRundown)

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {},
					segmentChanges: {
						rundown0_SEGMENT1_s1p1: {
							partChanges: {
								s1p2: NrcsIngestPartChangeDetails.Updated,
							},
							partOrderChanged: false,
						},
						rundown0_SEGMENT2_s2p1: {
							partChanges: {
								s2p2: NrcsIngestPartChangeDetails.Updated,
							},
							partOrderChanged: false,
						},
					},
					segmentOrderChanged: false,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('segment renamed', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			previousIngestRundown.segments[0].name = 'SEGMENT0;PART1'
			previousIngestRundown.segments[0].parts[0].name = 'SEGMENT0;PART1'
			previousIngestRundown.segments[1].name = 'SEGMENT0;PART2'
			previousIngestRundown.segments[1].parts[0].name = 'SEGMENT0;PART2'

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {
						rundown0_SEGMENT0_s1p1: 'rundown0_SEGMENT1_s1p1',
					},
					segmentChanges: {
						rundown0_SEGMENT1_s1p1: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
					},
					segmentOrderChanged: true,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('segment renamed and moved', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			previousIngestRundown.segments[0].name = 'SEGMENT0;PART1'
			previousIngestRundown.segments[0].parts[0].name = 'SEGMENT0;PART1'
			previousIngestRundown.segments[1].name = 'SEGMENT0;PART2'
			previousIngestRundown.segments[1].parts[0].name = 'SEGMENT0;PART2'
			previousIngestRundown.segments = [
				previousIngestRundown.segments[2],
				previousIngestRundown.segments[3],
				previousIngestRundown.segments[0],
				previousIngestRundown.segments[1],
			]
			updateRanksBasedOnOrder(previousIngestRundown)

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {
						rundown0_SEGMENT0_s1p1: 'rundown0_SEGMENT1_s1p1',
					},
					segmentChanges: {
						rundown0_SEGMENT1_s1p1: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
					},
					segmentOrderChanged: true,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('swap segment parts', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			previousIngestRundown.segments = [
				previousIngestRundown.segments[1],
				previousIngestRundown.segments[0],
				previousIngestRundown.segments[2],
				previousIngestRundown.segments[3],
			]
			updateRanksBasedOnOrder(previousIngestRundown)

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {
						rundown0_SEGMENT1_s1p2: 'rundown0_SEGMENT1_s1p1',
					},
					segmentChanges: {
						rundown0_SEGMENT1_s1p1: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
					},
					segmentOrderChanged: true,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('merge segments', () => {
			const { nrcsIngestRundown, combinedIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			previousIngestRundown.segments = [
				previousIngestRundown.segments[0],
				previousIngestRundown.segments[2],
				previousIngestRundown.segments[1],
				previousIngestRundown.segments[3],
			]
			updateRanksBasedOnOrder(previousIngestRundown)

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: combinedIngestRundown,
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {},
					segmentChanges: {
						rundown0_SEGMENT1_s1p1: {
							partChanges: {
								s1p2: NrcsIngestPartChangeDetails.Inserted,
							},
							partOrderChanged: true,
						},
						rundown0_SEGMENT1_s1p2: NrcsIngestSegmentChangeDetailsEnum.Deleted,
						rundown0_SEGMENT2_s2p1: {
							partChanges: {
								s2p2: NrcsIngestPartChangeDetails.Inserted,
							},
							partOrderChanged: true,
						},
						rundown0_SEGMENT2_s2p2: NrcsIngestSegmentChangeDetailsEnum.Deleted,
					},
					segmentOrderChanged: true,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})

		it('split segments', () => {
			const { nrcsIngestRundown } = createBasicMosIngestRundown()

			const ingestChanges: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {}, // Note: this is ignored for inserts/deletes
			}

			const previousIngestRundown = clone(nrcsIngestRundown)
			nrcsIngestRundown.segments = [
				nrcsIngestRundown.segments[0],
				nrcsIngestRundown.segments[2],
				nrcsIngestRundown.segments[1],
				nrcsIngestRundown.segments[3],
			]
			updateRanksBasedOnOrder(nrcsIngestRundown)

			const result = groupMosPartsInRundownAndChanges(nrcsIngestRundown, previousIngestRundown, ingestChanges)

			expect(result).toEqual({
				nrcsIngestRundown: {
					externalId: 'rundown0',
					type: 'mos',
					name: 'Rundown',
					segments: [
						{
							externalId: 'rundown0_SEGMENT1_s1p1',
							name: 'SEGMENT1',
							rank: 0,
							parts: [
								{
									externalId: 's1p1',
									name: 'SEGMENT1;PART1',
									rank: 0,
								},
							],
						},
						{
							externalId: 'rundown0_SEGMENT2_s2p1',
							name: 'SEGMENT2',
							rank: 1,
							parts: [
								{
									externalId: 's2p1',
									name: 'SEGMENT2;PART1',
									rank: 0,
								},
							],
						},
						{
							externalId: 'rundown0_SEGMENT1_s1p2',
							name: 'SEGMENT1',
							rank: 2,
							parts: [
								{
									externalId: 's1p2',
									name: 'SEGMENT1;PART2',
									rank: 0,
								},
							],
						},
						{
							externalId: 'rundown0_SEGMENT2_s2p2',
							name: 'SEGMENT2',
							rank: 3,
							parts: [
								{
									externalId: 's2p2',
									name: 'SEGMENT2;PART2',
									rank: 0,
								},
							],
						},
					],
				},
				ingestChanges: {
					source: IngestChangeType.Ingest,
					changedSegmentExternalIds: {},
					segmentChanges: {
						rundown0_SEGMENT1_s1p1: {
							partChanges: {
								s1p2: NrcsIngestPartChangeDetails.Deleted,
							},
							partOrderChanged: true,
						},
						rundown0_SEGMENT1_s1p2: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
						rundown0_SEGMENT2_s2p1: {
							partChanges: {
								s2p2: NrcsIngestPartChangeDetails.Deleted,
							},
							partOrderChanged: true,
						},
						rundown0_SEGMENT2_s2p2: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
					},
					segmentOrderChanged: true,
				},
			} satisfies Complete<GroupPartsInMosRundownAndChangesResult>)
		})
	})
})
