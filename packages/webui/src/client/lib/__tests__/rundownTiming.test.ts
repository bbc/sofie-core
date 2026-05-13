import {
	type DBRundownPlaylist,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString, protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { RundownTimingCalculator, type RundownTimingContext, findPartInstancesInQuickLoop } from '../rundownTiming.js'
import { PlaylistTimingType, type SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import type { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { PartInstance } from '@sofie-automation/corelib/src/dataModel/PartInstance.js'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/src/playout/stateCacheResolver'

const DEFAULT_DURATION = 0
const DEFAULT_NONZERO_DURATION = 4000

function makeMockPlaylist(): DBRundownPlaylist {
	return literal<DBRundownPlaylist>({
		_id: protectString('mock-playlist'),
		externalId: 'mock-playlist',
		studioId: protectString('studio0'),
		name: 'Mock Playlist',
		created: 0,
		modified: 0,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartInfo: null,
		timing: {
			type: PlaylistTimingType.None,
		},
		rundownIdsInOrder: [],

		tTimers: [
			{ index: 1, label: '', mode: null, state: null },
			{ index: 2, label: '', mode: null, state: null },
			{ index: 3, label: '', mode: null, state: null },
		],
	})
}

function makeMockPart(
	id: string,
	rank: number,
	rundownId: string,
	segmentId: string,
	durations: Pick<DBPart, 'displayDuration' | 'displayDurationGroup' | 'durations'>
): DBPart {
	return literal<DBPart>({
		_id: protectString(id),
		externalId: id,
		title: '',
		segmentId: protectString(segmentId),
		_rank: rank,
		rundownId: protectString(rundownId),
		...durations,
	})
}

function makeMockSegment(id: string, rank: number, rundownId: string, timing?: SegmentTimingInfo): DBSegment {
	return literal<DBSegment>({
		_id: protectString(id),
		name: 'mock-segment',
		externalId: id,
		_rank: rank,
		rundownId: protectString(rundownId),
		segmentTiming: timing,
	})
}

function makeMockRundown(id: string, playlist: DBRundownPlaylist) {
	playlist.rundownIdsInOrder.push(protectString(id))
	return literal<DBRundown>({
		_id: protectString(id),
		externalId: id,
		timing: {
			type: 'none' as any,
		},
		studioId: protectString('studio0'),
		showStyleBaseId: protectString(''),
		showStyleVariantId: protectString('variant0'),
		created: 0,
		modified: 0,
		importVersions: {} as any,
		name: 'test',
		source: {
			type: 'nrcs',
			peripheralDeviceId: protectString(''),
			nrcsName: 'mockNRCS',
		},
		playlistId: playlist._id,
	})
}

function convertPartsToPartInstances(parts: DBPart[]): PartInstance[] {
	return parts.map((part) => wrapPartToTemporaryInstance(protectString(''), part))
}

function makeMockPartsForQuickLoopTest() {
	const rundownId = 'rundown1'
	const segmentId1 = 'segment1'
	const segmentId2 = 'segment2'
	const segmentsMap: Map<SegmentId, DBSegment> = new Map()
	segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
	segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
	const parts: DBPart[] = []
	parts.push(
		makeMockPart('part1', 0, rundownId, segmentId1, {
			durations: { expectedDuration: 1000, transitionOverlap: undefined },
		})
	)
	parts.push(
		makeMockPart('part2', 0, rundownId, segmentId1, {
			durations: { expectedDuration: 1000, transitionOverlap: undefined },
		})
	)
	parts.push(
		makeMockPart('part3', 0, rundownId, segmentId2, {
			durations: { expectedDuration: 1000, transitionOverlap: undefined },
		})
	)
	parts.push(
		makeMockPart('part4', 0, rundownId, segmentId2, {
			durations: { expectedDuration: 1000, transitionOverlap: undefined },
		})
	)
	parts.push(
		makeMockPart('part5', 0, rundownId, segmentId2, {
			durations: { expectedDuration: 1000, transitionOverlap: undefined },
		})
	)
	const partInstances = convertPartsToPartInstances(parts)
	return { parts, partInstances }
}

describe('rundown Timing Calculator', () => {
	it('Provides output for empty playlist', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		const partInstances: PartInstance[] = []
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			[],
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 0,
				asPlayedPlaylistDuration: 0,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {},
				rundownAsPlayedDurations: {},
				partCountdown: {},
				partDisplayDurations: {},
				partDisplayStartsAt: {},
				partDurations: {},
				partExpectedDurations: {},
				partPlayed: {},
				partStartsAt: {},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 0,
				totalPlaylistDuration: 0,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Calculates time for unplayed playlist with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstances = convertPartsToPartInstances(parts)
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId]: 4000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Calculates time for unplayed playlist with end time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstances = convertPartsToPartInstances(parts)
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId]: 4000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Produces timing per rundown with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const rundownId2 = 'rundown2'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId2))
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId2, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId2, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstances = convertPartsToPartInstances(parts)
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown1 = makeMockRundown(rundownId1, playlist)
		const rundown2 = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown1, rundown2]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId1]: 2000,
					[rundownId2]: 2000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 2000,
					[rundownId2]: 2000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	describe('Display duration groups', () => {
		it('Handles groups when not playing', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId1 = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentId2 = 'segment2'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId1))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
					displayDuration: 2000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
					displayDuration: 3000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId1, segmentId2, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
					displayDuration: 4000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId1, segmentId2, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
					displayDuration: 5000,
					displayDurationGroup: 'test',
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId1, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				rundowns,
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 4000,
					asPlayedPlaylistDuration: 4000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: {
						[rundownId1]: 4000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 4000,
					},
					partCountdown: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
					},
					partDisplayDurations: {
						part1: 2000,
						part2: 3000,
						part3: 4000,
						part4: 5000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
					},
					partDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
					},
					partPlayed: {
						part1: 0,
						part2: 0,
						part3: 0,
						part4: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 4000,
					totalPlaylistDuration: 4000,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
				})
			)
		})

		it('Handles groups when playing', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId1 = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 5000, transitionOverlap: undefined },
					displayDuration: 1000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: undefined, transitionOverlap: undefined },
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			const partInstancesMap: Map<PartId, PartInstance> = new Map(
				parts.map((part) => {
					return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
				})
			)
			const partInstances = Array.from(partInstancesMap.values())
			partInstancesMap.get(parts[0]._id)!.timings = {
				// part1
				duration: 1000,
				take: 0,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 1000,
			}
			partInstancesMap.get(parts[1]._id)!.timings = {
				// part2
				duration: 2000,
				take: 1000,
				plannedStartedPlayback: 1000,
				plannedStoppedPlayback: 3000,
			}
			partInstancesMap.get(parts[2]._id)!.timings = {
				// part3
				take: 3000,
				plannedStartedPlayback: 3000,
			}
			const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
			const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
			playlist.currentPartInfo = {
				partInstanceId: currentPartInstanceId,
				rundownId: protectString<RundownId>(rundownId1),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: nextPartInstanceId,
				rundownId: protectString<RundownId>(rundownId1),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			const rundown = makeMockRundown(rundownId1, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				3500,
				false,
				playlist,
				rundowns,
				rundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: currentPartInstanceId,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 7000,
					asPlayedPlaylistDuration: 7000,
					currentPartWillAutoNext: false,
					currentSegmentId: protectString(segmentId1),
					currentTime: 3500,
					rundownExpectedDurations: {
						[rundownId1]: 7000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 7000,
					},
					partCountdown: {
						part1: null,
						part2: null,
						part3: null,
						part4: 2500,
					},
					partDisplayDurations: {
						part1: 1000,
						part2: 2000,
						part3: 3000,
						part4: 1000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 3000,
						part4: 6000,
					},
					partDurations: {
						part1: 1000,
						part2: 2000,
						part3: 500,
						part4: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 5000,
						part3: 3000,
						part4: 1000,
					},
					partPlayed: {
						part1: 1000,
						part2: 2000,
						part3: 500,
						part4: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 3000,
						part4: 3500,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 3500,
					totalPlaylistDuration: 7000,
					breakIsLastRundown: false,
					remainingTimeOnCurrentPart: 2500,
					rundownsBeforeNextBreak: [],
					nextRundownAnchor: undefined,
				})
			)
		})

		it("Handles groups when playing outside of displayDurationGroup's budget", () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId1 = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 5000, transitionOverlap: undefined },
					displayDuration: 1000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: undefined, transitionOverlap: undefined },
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			const partInstancesMap: Map<PartId, PartInstance> = new Map(
				parts.map((part) => {
					return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
				})
			)
			const partInstances = Array.from(partInstancesMap.values())
			partInstancesMap.get(parts[0]._id)!.timings = {
				// part1
				duration: 1000,
				take: 0,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 1000,
			}
			partInstancesMap.get(parts[1]._id)!.timings = {
				// part2
				duration: 2000,
				take: 1000,
				plannedStartedPlayback: 1000,
				plannedStoppedPlayback: 3000,
			}
			partInstancesMap.get(parts[2]._id)!.timings = {
				// part3
				take: 3000,
				plannedStartedPlayback: 3000,
			}
			const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
			const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
			playlist.currentPartInfo = {
				partInstanceId: currentPartInstanceId,
				rundownId: protectString<RundownId>(rundownId1),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: nextPartInstanceId,
				rundownId: protectString<RundownId>(rundownId1),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			const rundown = makeMockRundown(rundownId1, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				10000,
				false,
				playlist,
				rundowns,
				rundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: currentPartInstanceId,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 11000,
					asPlayedPlaylistDuration: 11000,
					currentPartWillAutoNext: false,
					currentSegmentId: protectString(segmentId1),
					currentTime: 10000,
					rundownExpectedDurations: {
						[rundownId1]: 7000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 11000,
					},
					partCountdown: {
						part1: null,
						part2: null,
						part3: null,
						part4: 0,
					},
					partDisplayDurations: {
						part1: 1000,
						part2: 2000,
						part3: 7000,
						part4: 1000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 3000,
						part4: 10000,
					},
					partDurations: {
						part1: 1000,
						part2: 2000,
						part3: 7000,
						part4: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 5000,
						part3: 3000,
						part4: 1000,
					},
					partPlayed: {
						part1: 1000,
						part2: 2000,
						part3: 7000,
						part4: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 3000,
						part4: 10000,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 1000,
					totalPlaylistDuration: 7000,
					breakIsLastRundown: false,
					remainingTimeOnCurrentPart: -4000,
					rundownsBeforeNextBreak: [],
					nextRundownAnchor: undefined,
				})
			)
		})
	})

	describe('Non-zero default Part duration', () => {
		it('Calculates time for unplayed playlist with start time and duration', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentId2 = 'segment2'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId, segmentId2, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId, segmentId2, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				rundowns,
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_NONZERO_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 4000,
					asPlayedPlaylistDuration: 4000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: {
						[rundownId]: 4000,
					},
					rundownAsPlayedDurations: {
						[rundownId]: 4000,
					},
					partCountdown: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
					},
					partDisplayDurations: {
						part1: 4000,
						part2: 4000,
						part3: 4000,
						part4: 4000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 4000,
						part3: 8000,
						part4: 12000,
					},
					partDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
					},
					partPlayed: {
						part1: 0,
						part2: 0,
						part3: 0,
						part4: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 4000,
					totalPlaylistDuration: 4000,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
				})
			)
		})

		it('Handles display duration groups', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId1 = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentId2 = 'segment2'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId1))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
					displayDuration: 2000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId1, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
					displayDuration: 3000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId1, segmentId2, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
					displayDuration: 4000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId1, segmentId2, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
					displayDuration: 5000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part5', 0, rundownId1, segmentId2, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId1, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				rundowns,
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_NONZERO_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 5000,
					asPlayedPlaylistDuration: 5000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: {
						[rundownId1]: 5000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 5000,
					},
					partCountdown: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
						part5: 14000,
					},
					partDisplayDurations: {
						part1: 2000,
						part2: 3000,
						part3: 4000,
						part4: 5000,
						part5: 4000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
						part5: 14000,
					},
					partDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
						part5: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
						part5: 1000,
					},
					partPlayed: {
						part1: 0,
						part2: 0,
						part3: 0,
						part4: 0,
						part5: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
						part5: 4000,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 5000,
					totalPlaylistDuration: 5000,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
				})
			)
		})
	})

	it('Handles budget duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { budgetDuration: 5000 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { budgetDuration: 3000 })
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstances = convertPartsToPartInstances(parts)
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 8000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 8000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 5000,
					part4: 6000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 8000,
				totalPlaylistDuration: 8000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Handles part with autonext', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, {
				budgetDuration: 5000,
			})
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, {
				budgetDuration: 3000,
			})
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		// set autonext and create partInstances
		parts[0].autoNext = true
		const partInstance1 = wrapPartToTemporaryInstance(protectString(''), parts[0])
		partInstance1.isTemporary = false
		partInstance1.timings = {
			plannedStartedPlayback: 0,
		}
		const partInstance2 = wrapPartToTemporaryInstance(protectString(''), parts[1])
		partInstance2.isTemporary = false
		partInstance2.timings = {
			plannedStartedPlayback: 1000, // start after part1's expectedDuration
		}
		const partInstances = [partInstance1, partInstance2, ...convertPartsToPartInstances([parts[2], parts[3]])]
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		// at t = 0
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 8000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				partsInQuickLoop: {},
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 8000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 5000,
					part4: 6000,
				},
				partDisplayDurations: {
					part1_tmp_instance: 1000,
					part2_tmp_instance: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1_tmp_instance: 1000,
					part2_tmp_instance: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1_tmp_instance: 1000,
					part2_tmp_instance: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 8000,
				totalPlaylistDuration: 8000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Handles part with postroll', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, {
				budgetDuration: 5000,
			})
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, {
				budgetDuration: 3000,
			})
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 2000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 2000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		// set autonext and create partInstances
		parts[0].autoNext = true
		const partInstance1 = wrapPartToTemporaryInstance(protectString(''), parts[0])
		partInstance1.isTemporary = false
		partInstance1.timings = {
			plannedStartedPlayback: 0,
			reportedStartedPlayback: 0,
			reportedStoppedPlayback: 2000,
		}
		partInstance1.partPlayoutTimings = {
			inTransitionStart: 0,
			toPartDelay: 0,
			toPartPostroll: 500,
			fromPartRemaining: 0,
			fromPartPostroll: 0,
			fromPartKeepalive: 0,
		}
		const partInstance2 = wrapPartToTemporaryInstance(protectString(''), parts[1])
		partInstance2.isTemporary = false
		partInstance2.timings = {
			plannedStartedPlayback: 2000, // start after part1's expectedDuration
			reportedStartedPlayback: 2000,
		}
		partInstance2.partPlayoutTimings = {
			inTransitionStart: 0,
			toPartDelay: 0,
			toPartPostroll: 0,
			fromPartRemaining: 500,
			fromPartPostroll: 500,
			fromPartKeepalive: 0,
		}
		const partInstances = [partInstance1, partInstance2, ...convertPartsToPartInstances([parts[2], parts[3]])]
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		// at t = 0
		const result = timing.updateDurations(
			3000,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 6000,
				asPlayedPlaylistDuration: 8000,
				currentPartWillAutoNext: false,
				currentTime: 3000,
				partsInQuickLoop: {},
				rundownExpectedDurations: {
					[rundownId1]: 6000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 8000,
				},
				partCountdown: {
					part1: 4000,
					part2: 6000,
					part3: 6000,
					part4: 7000,
				},
				partDisplayDurations: {
					part1_tmp_instance: 2000,
					part2_tmp_instance: 2000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 2000,
					part3: 4000,
					part4: 5000,
				},
				partDurations: {
					part1_tmp_instance: 2000,
					part2_tmp_instance: 2000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1_tmp_instance: 2000,
					part2_tmp_instance: 2000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 1000,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 2000,
					part3: 4000,
					part4: 5000,
				},
				remainingPlaylistDuration: 8000,
				totalPlaylistDuration: 8000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Back-time: Can find the next expectedStart rundown anchor when it is in a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		const partInstances = Array.from(partInstancesMap.values())
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			1500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId1),
				currentTime: 1500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 500,
					part4: 1500,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 1000,
					part2: 500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 2500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 2000,
			})
		)
	})

	it('Back-time: Can find the next expectedEnd rundown anchor when it is a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		const partInstances = Array.from(partInstancesMap.values())
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			3500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 5500,
				asPlayedPlaylistDuration: 5500,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId1),
				currentTime: 3500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 5500,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 0,
					part4: 1000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 2500,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partDurations: {
					part1: 1000,
					part2: 2500,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 1000,
					part2: 2500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 2000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: -1500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 4000,
			})
		)
	})

	it('Back-time: Can find the next expectedEnd rundown anchor when it is the current segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 3000 })
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		const partInstances = Array.from(partInstancesMap.values())
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			duration: 1000,
			take: 1000,
			plannedStartedPlayback: 1000,
			plannedStoppedPlayback: 2000,
		}
		partInstancesMap.get(parts[2]._id)!.timings = {
			take: 2000,
			plannedStartedPlayback: 2000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			2500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId2),
				currentTime: 2500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: null,
					part4: 500,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 1000,
					part2: 1000,
					part3: 500,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 1500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 3000,
			})
		)
	})

	it('Forward-time: Can find the next expectedStart rundown anchor when it is in a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const partInstances = Array.from(partInstancesMap.values())
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			1500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId1),
				currentTime: 1500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 500,
					part4: 1500,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 1000,
					part2: 500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 2500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 2000,
			})
		)
	})

	it('Forward-time: Can find the next expectedEnd rundown anchor when it is a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		const partInstances = Array.from(partInstancesMap.values())
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			3500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 5500,
				asPlayedPlaylistDuration: 5500,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId1),
				currentTime: 3500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 5500,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 0,
					part4: 1000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 2500,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partDurations: {
					part1: 1000,
					part2: 2500,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 1000,
					part2: 2500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 2000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: -1500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 4000,
			})
		)
	})

	it('Forward-time: Can find the next expectedEnd rundown anchor when it is the current segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 3000 })
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			duration: 1000,
			take: 1000,
			plannedStartedPlayback: 1000,
			plannedStoppedPlayback: 2000,
		}
		partInstancesMap.get(parts[2]._id)!.timings = {
			take: 2000,
			plannedStartedPlayback: 2000,
		}
		const partInstances = Array.from(partInstancesMap.values())
		const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			2500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId2),
				currentTime: 2500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: null,
					part4: 500,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 1000,
					part2: 1000,
					part3: 500,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 1500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 3000,
			})
		)
	})

	it('Passes partsInQuickLoop', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId, segmentId1, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId, segmentId2, {
				durations: { expectedDuration: 1000, transitionOverlap: undefined },
			})
		)
		const partInstances = convertPartsToPartInstances(parts)
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{
				part2: true,
				part3: true,
			}
		)
		expect(result).toMatchObject(
			literal<Partial<RundownTimingContext>>({
				partsInQuickLoop: {
					part2: true,
					part3: true,
				},
			})
		)
	})

	describe('transitionOverlap', () => {
		it('Calculates correctly with defined expectedDuration and positive transitionOverlap, unplayed', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId), makeMockSegment(segmentId, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId, segmentId, {
					// expectedDurationWithTransition = 1000 - 200 = 800
					durations: { expectedDuration: 1000, transitionOverlap: 200 },
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId, segmentId, {
					durations: { expectedDuration: 2000, transitionOverlap: 1000 },
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				[rundown],
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 1800,
					asPlayedPlaylistDuration: 1800,
					currentPartWillAutoNext: false,
					currentTime: 0,
					// rundownExpectedDurations accounts for transitionOverlap: (1000-200) + (2000-1000) = 1800
					rundownExpectedDurations: { [rundownId]: 1800 },
					rundownAsPlayedDurations: { [rundownId]: 1800 },
					partCountdown: { part1: 0, part2: 800 },
					partDisplayDurations: { part1: 800, part2: 1000 },
					partDisplayStartsAt: { part1: 0, part2: 800 },
					partDurations: { part1: 800, part2: 1000 },
					partExpectedDurations: { part1: 800, part2: 1000 },
					partPlayed: { part1: 0, part2: 0 },
					partStartsAt: { part1: 0, part2: 800 },
					partsInQuickLoop: {},
					remainingPlaylistDuration: 1800,
					totalPlaylistDuration: 1800,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
					nextRundownAnchor: undefined,
				})
			)
		})

		it('Does not produce negative durations with undefined expectedDuration and positive transitionOverlap, unplayed', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId), makeMockSegment(segmentId, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId, segmentId, {
					// undefined expectedDuration: the transitionOverlap should not cause negative durations
					durations: { expectedDuration: undefined, transitionOverlap: 200 },
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId, segmentId, {
					durations: { expectedDuration: 2000, transitionOverlap: 0 },
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				[rundown],
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					// part1 has no expectedDuration so contributes 0 to all totals
					asDisplayedPlaylistDuration: 2000,
					asPlayedPlaylistDuration: 2000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: { [rundownId]: 2000 },
					rundownAsPlayedDurations: { [rundownId]: 2000 },
					partCountdown: { part1: 0, part2: 0 },
					partDisplayDurations: { part1: 0, part2: 2000 },
					partDisplayStartsAt: { part1: 0, part2: 0 },
					partDurations: { part1: 0, part2: 2000 },
					partExpectedDurations: { part1: 0, part2: 2000 },
					partPlayed: { part1: 0, part2: 0 },
					partStartsAt: { part1: 0, part2: 0 },
					partsInQuickLoop: {},
					remainingPlaylistDuration: 2000,
					totalPlaylistDuration: 2000,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
					nextRundownAnchor: undefined,
				})
			)
		})

		it('Uses expectedDurationWithTransition not actual played duration when expectedDuration is defined, playing', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId), makeMockSegment(segmentId, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId, segmentId, {
					// expectedDurationWithTransition = 800, but will overrun to 1200ms
					durations: { expectedDuration: 1000, transitionOverlap: 200 },
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId, segmentId, {
					durations: { expectedDuration: 2000, transitionOverlap: 0 },
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId, segmentId, {
					durations: { expectedDuration: 1000, transitionOverlap: 0 },
				})
			)
			const partInstancesMap: Map<PartId, PartInstance> = new Map(
				parts.map((part) => [part._id, wrapPartToTemporaryInstance(protectString('active'), part)])
			)
			const partInstances = Array.from(partInstancesMap.values())
			partInstancesMap.get(parts[0]._id)!.timings = {
				// part1: actually played for 1200ms despite expectedDurationWithTransition=800
				duration: 1200,
				take: 0,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 1200,
			}
			partInstancesMap.get(parts[1]._id)!.timings = {
				// part2: currently on air, 500ms elapsed
				take: 1200,
				plannedStartedPlayback: 1200,
			}
			const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
			const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
			playlist.currentPartInfo = {
				partInstanceId: currentPartInstanceId,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: nextPartInstanceId,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				1700,
				false,
				playlist,
				[rundown],
				rundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId,
					currentSegmentId: protectString(segmentId),
					isLowResolution: false,
					asDisplayedPlaylistDuration: 4200,
					asPlayedPlaylistDuration: 4200,
					currentPartWillAutoNext: false,
					currentTime: 1700,
					rundownExpectedDurations: { [rundownId]: 3800 },
					rundownAsPlayedDurations: { [rundownId]: 4200 },
					partCountdown: { part1: null, part2: null, part3: 1500 },
					partDisplayDurations: { part1: 1200, part2: 2000, part3: 1000 },
					partDisplayStartsAt: { part1: 0, part2: 1200, part3: 3200 },
					partDurations: { part1: 1200, part2: 2000, part3: 1000 },
					// partExpectedDurations reflects expectedDurationWithTransition, not the actual 1200ms played
					partExpectedDurations: { part1: 800, part2: 2000, part3: 1000 },
					partPlayed: { part1: 1200, part2: 500, part3: 0 },
					partStartsAt: { part1: 0, part2: 1200, part3: 3200 },
					partsInQuickLoop: {},
					remainingPlaylistDuration: 2500,
					totalPlaylistDuration: 3800,
					breakIsLastRundown: false,
					remainingTimeOnCurrentPart: 1500,
					rundownsBeforeNextBreak: [],
					nextRundownAnchor: undefined,
				})
			)
		})

		it('Does not produce negative durations with undefined expectedDuration and positive transitionOverlap, playing', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId), makeMockSegment(segmentId, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId, segmentId, {
					// undefined expectedDuration: transitionOverlap should not cause negative durations
					durations: { expectedDuration: undefined, transitionOverlap: 200 },
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId, segmentId, {
					// undefined expectedDuration, currently on air
					durations: { expectedDuration: undefined, transitionOverlap: 0 },
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId, segmentId, {
					durations: { expectedDuration: 1000, transitionOverlap: 0 },
				})
			)
			const partInstancesMap: Map<PartId, PartInstance> = new Map(
				parts.map((part) => [part._id, wrapPartToTemporaryInstance(protectString('active'), part)])
			)
			const partInstances = Array.from(partInstancesMap.values())
			partInstancesMap.get(parts[0]._id)!.timings = {
				// part1: played 800ms, no expectedDuration
				duration: 800,
				take: 0,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 800,
			}
			partInstancesMap.get(parts[1]._id)!.timings = {
				// part2: currently on air, 200ms elapsed, no expectedDuration
				take: 800,
				plannedStartedPlayback: 800,
			}
			const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
			const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
			playlist.currentPartInfo = {
				partInstanceId: currentPartInstanceId,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: nextPartInstanceId,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				1000,
				false,
				playlist,
				[rundown],
				rundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId,
					currentSegmentId: protectString(segmentId),
					isLowResolution: false,
					// part1 and part2 have no expectedDuration, only part3 contributes to totalPlaylistDuration
					asDisplayedPlaylistDuration: 2000,
					asPlayedPlaylistDuration: 2000,
					currentPartWillAutoNext: false,
					currentTime: 1000,
					rundownExpectedDurations: { [rundownId]: 1000 },
					rundownAsPlayedDurations: { [rundownId]: 2000 },
					partCountdown: { part1: null, part2: null, part3: 0 },
					partDisplayDurations: { part1: 800, part2: 200, part3: 1000 },
					partDisplayStartsAt: { part1: 0, part2: 800, part3: 1000 },
					partDurations: { part1: 800, part2: 200, part3: 1000 },
					// partExpectedDurations falls back to as-played when no expectedDuration
					partExpectedDurations: { part1: 800, part2: 0, part3: 1000 },
					partPlayed: { part1: 800, part2: 200, part3: 0 },
					partStartsAt: { part1: 0, part2: 800, part3: 1000 },
					partsInQuickLoop: {},
					remainingPlaylistDuration: 1000,
					totalPlaylistDuration: 1000,
					breakIsLastRundown: false,
					// negative: part2 has no expected duration so it's already past its "end"
					remainingTimeOnCurrentPart: -200,
					rundownsBeforeNextBreak: [],
					nextRundownAnchor: undefined,
				})
			)
		})

		it('Accounts for transitionOverlap in over/under timing when transitioning from a known-duration part to an unknown-duration part', () => {
			// Scenario: A (5s known) → B (unknown dur, 2s overlap)
			// B's transition starts 2000ms before A ends, at t=3000ms.
			// The total expected wall-clock duration is therefore 3000ms — NOT 5000ms.
			// rundownExpectedDurations, totalPlaylistDuration, remainingPlaylistDuration, and
			// partStartsAt/partCountdown for B must all reflect the 2000ms reduction.
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId), makeMockSegment(segmentId, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('partA', 0, rundownId, segmentId, {
					durations: { expectedDuration: 5000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('partB', 0, rundownId, segmentId, {
					// B has no expectedDuration but its transition starts 2000ms before A ends
					durations: { expectedDuration: undefined, transitionOverlap: 2000 },
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				[rundown],
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					// Total = A.expectedDuration (5000) - B.transitionOverlap (2000) = 3000ms
					asDisplayedPlaylistDuration: 3000,
					asPlayedPlaylistDuration: 3000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: { [rundownId]: 3000 },
					rundownAsPlayedDurations: { [rundownId]: 3000 },
					// B's transition starts at 5000 - 2000 = 3000ms: countdown to B = 3000
					partCountdown: { partA: 0, partB: 3000 },
					// B has no expectedDuration so its own slot is 0ms wide
					partDisplayDurations: { partA: 5000, partB: 0 },
					// B physically starts at 3000ms (overlapping the last 2000ms of A)
					partDisplayStartsAt: { partA: 0, partB: 3000 },
					partDurations: { partA: 5000, partB: 0 },
					// B falls back to 0 since expectedDuration is undefined
					partExpectedDurations: { partA: 5000, partB: 0 },
					partPlayed: { partA: 0, partB: 0 },
					partStartsAt: { partA: 0, partB: 3000 },
					partsInQuickLoop: {},
					remainingPlaylistDuration: 3000,
					totalPlaylistDuration: 3000,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
					nextRundownAnchor: undefined,
				})
			)
		})

		it('Does not let a second unknown-duration+transitionOverlap part propagate beyond the previous part start', () => {
			// Scenario: A (5s) → B (unknown, 2s overlap) → C (unknown, 2s overlap)
			// B's -2000ms reduces A's effective schedule from 5000→3000.
			// C's -2000ms can only eat into B's contribution (which is 0), so C cannot
			// push the schedule position below B's own position (3000ms).
			// Total must stay at 3000ms, and C must not appear before B.
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId), makeMockSegment(segmentId, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('partA', 0, rundownId, segmentId, {
					durations: { expectedDuration: 5000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('partB', 0, rundownId, segmentId, {
					durations: { expectedDuration: undefined, transitionOverlap: 2000 },
				})
			)
			parts.push(
				makeMockPart('partC', 0, rundownId, segmentId, {
					// C's 2000ms overlap cannot propagate past B's start (3000ms)
					durations: { expectedDuration: undefined, transitionOverlap: 2000 },
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				[rundown],
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					// C's overlap cannot go past B's position — total stays at 3000ms
					asDisplayedPlaylistDuration: 3000,
					asPlayedPlaylistDuration: 3000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: { [rundownId]: 3000 },
					rundownAsPlayedDurations: { [rundownId]: 3000 },
					// B and C both start at 3000ms (B has 0 expected duration so C is co-located)
					partCountdown: { partA: 0, partB: 3000, partC: 3000 },
					partDisplayDurations: { partA: 5000, partB: 0, partC: 0 },
					partDisplayStartsAt: { partA: 0, partB: 3000, partC: 3000 },
					partDurations: { partA: 5000, partB: 0, partC: 0 },
					partExpectedDurations: { partA: 5000, partB: 0, partC: 0 },
					partPlayed: { partA: 0, partB: 0, partC: 0 },
					partStartsAt: { partA: 0, partB: 3000, partC: 3000 },
					partsInQuickLoop: {},
					remainingPlaylistDuration: 3000,
					totalPlaylistDuration: 3000,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
					nextRundownAnchor: undefined,
				})
			)
		})

		it('Does not produce negative durations with budgetDuration segment containing parts with undefined expectedDuration and positive transitionOverlap', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentId2 = 'segment2'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			// segment1 uses budgetDuration
			segmentsMap.set(
				protectString<SegmentId>(segmentId1),
				makeMockSegment(segmentId1, 0, rundownId, { budgetDuration: 5000 })
			)
			// segment2 has normal parts with transitionOverlap
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId, segmentId1, {
					durations: { expectedDuration: 1000, transitionOverlap: undefined },
				})
			)
			// parts in segment2: undefined expectedDuration but WITH transitionOverlap
			parts.push(
				makeMockPart('part3', 0, rundownId, segmentId2, {
					durations: { expectedDuration: undefined, transitionOverlap: 300 },
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId, segmentId2, {
					durations: { expectedDuration: 2000, transitionOverlap: 500 },
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				[rundown],
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					currentSegmentId: undefined,
					// segment1: budgetDuration=5000, segment2: part3 has transitionOverlap=300 (ewt=-300)
					// so asDisplayed = part1(1000)+part2(1000)+part3(ewt=-300→-300)→total=1700+part4(ewt=1500)=3200
					asDisplayedPlaylistDuration: 3200,
					asPlayedPlaylistDuration: 6500,
					currentPartWillAutoNext: false,
					currentTime: 0,
					// rundownExpectedDurations: non-budget parts only (schedule-advance based)
					// part3: scheduleAdvance=-300 → rundownExpectedDurations = max(0, prev+(-300)) = max(0, 0-300) = 0
					// part4: scheduleAdvance=1500 → rundownExpectedDurations = max(0, 0+1500) = 1500
					// BUT budget parts also contribute: prev accumulates to 2000 first, then part3 subtracts 300→1700,
					// part4 adds 1500→3200
					rundownExpectedDurations: { [rundownId]: 3200 },
					rundownAsPlayedDurations: { [rundownId]: 6500 },
					partCountdown: {
						part1: 0,
						part2: 1000,
						part3: 5000,
						part4: 5000,
					},
					partDisplayDurations: { part1: 1000, part2: 1000, part3: 0, part4: 1500 },
					// part3 starts 300ms before the nominal segment2 start (2000): 2000-300=1700
					partDisplayStartsAt: { part1: 0, part2: 1000, part3: 1700, part4: 1700 },
					partDurations: { part1: 1000, part2: 1000, part3: 0, part4: 1500 },
					partExpectedDurations: { part1: 1000, part2: 1000, part3: 0, part4: 1500 },
					partPlayed: { part1: 0, part2: 0, part3: 0, part4: 0 },
					// part3 overlaps 300ms into part2's slot; part4 starts where part3's 0-duration ends (=1700)
					partStartsAt: { part1: 0, part2: 1000, part3: 1700, part4: 1700 },
					partsInQuickLoop: {},
					remainingPlaylistDuration: 6500,
					totalPlaylistDuration: 6500,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
					nextRundownAnchor: undefined,
				})
			)
		})

		it('Countdown to B is reduced by B.transitionOverlap while A is playing', () => {
			// Scenario: A (5s known) → B (unknown, 2s overlap). A is currently live, 1s elapsed.
			// B's take fires at 3000ms from A's start. At elapsed=1000ms, countdown to B = 2000ms.
			// remainingTimeOnCurrentPart should also be 2000ms (time until next take, not A's own ewt).
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = { type: 'forward-time' as any, expectedStart: 0, expectedDuration: 40000 }
			const rundownId = 'rundown1'
			const segmentId = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId), makeMockSegment(segmentId, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('partA', 0, rundownId, segmentId, {
					durations: { expectedDuration: 5000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('partB', 0, rundownId, segmentId, {
					durations: { expectedDuration: undefined, transitionOverlap: 2000 },
				})
			)
			const partInstancesMap: Map<PartId, PartInstance> = new Map(
				parts.map((part) => [part._id, wrapPartToTemporaryInstance(protectString('active'), part)])
			)
			const partInstances = Array.from(partInstancesMap.values())
			partInstancesMap.get(parts[0]._id)!.timings = {
				// A started at t=1000, has been playing for 1000ms (now=2000)
				take: 1000,
				plannedStartedPlayback: 1000,
			}
			const currentPartInstanceId = partInstancesMap.get(parts[0]._id)!._id
			const nextPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
			playlist.currentPartInfo = {
				partInstanceId: currentPartInstanceId,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: nextPartInstanceId,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				2000, // now = 2000ms, elapsed since A started = 1000ms
				false,
				playlist,
				[rundown],
				rundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId,
					currentSegmentId: protectString(segmentId),
					isLowResolution: false,
					currentPartWillAutoNext: false,
					currentTime: 2000,
					// A has been playing 1000ms. Next take fires at 3000ms from A's start (5000 - 2000 overlap).
					// Elapsed = 1000ms so 2000ms remain until B fires.
					remainingTimeOnCurrentPart: 2000,
					// B's countdown = time until take = 2000ms
					partCountdown: { partA: null, partB: 2000 },
					// Total expected = 3000ms (A's 5s minus B's 2s overlap).
					// Remaining = 3000 - 1000 elapsed = 2000ms.
					remainingPlaylistDuration: 2000,
					totalPlaylistDuration: 3000,
					// asPlayed = max(ewt_A=5000, 1000ms elapsed) then reduced by B's overlap contribution
					// = max(0, 5000 + scheduleAdvance_B=-2000) = 3000ms
					asDisplayedPlaylistDuration: 3000,
					asPlayedPlaylistDuration: 3000,
					rundownExpectedDurations: { [rundownId]: 3000 },
					rundownAsPlayedDurations: { [rundownId]: 3000 },
					partDisplayDurations: { partA: 5000, partB: 0 },
					partDisplayStartsAt: { partA: 0, partB: 3000 },
					partDurations: { partA: 5000, partB: 0 },
					partExpectedDurations: { partA: 5000, partB: 0 },
					partPlayed: { partA: 1000, partB: 0 },
					partStartsAt: { partA: 0, partB: 3000 },
					partsInQuickLoop: {},
					breakIsLastRundown: false,
					rundownsBeforeNextBreak: [],
					nextRundownAnchor: undefined,
				})
			)
		})

		it('Shows correct remaining time and no over-run when B (unknown duration, transitionOverlap) is playing', () => {
			// Scenario: A (5s) → B (unknown, 2s overlap). A played for 3000ms, B is now live, 500ms elapsed.
			// totalPlaylistDuration = 3000ms (A's 5s minus B's 2s overlap).
			// B's content starts at 1000ms in the timeline (3000ms take - 2000ms overlap = 1000ms).
			// remainingTimeOnCurrentPart: uses original formula with ewt_B=-2000, shows overrun.
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = { type: 'forward-time' as any, expectedStart: 0, expectedDuration: 40000 }
			const rundownId = 'rundown1'
			const segmentId = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId), makeMockSegment(segmentId, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('partA', 0, rundownId, segmentId, {
					durations: { expectedDuration: 5000, transitionOverlap: undefined },
				})
			)
			parts.push(
				makeMockPart('partB', 0, rundownId, segmentId, {
					durations: { expectedDuration: undefined, transitionOverlap: 2000 },
				})
			)
			const partInstancesMap: Map<PartId, PartInstance> = new Map(
				parts.map((part) => [part._id, wrapPartToTemporaryInstance(protectString('active'), part)])
			)
			const partInstances = Array.from(partInstancesMap.values())
			// A played its full 5000ms including the 2000ms overlap with B.
			// The server sets timings.duration = plannedStoppedPlayback - plannedStartedPlayback
			// where plannedStoppedPlayback = B_start + overlap = 3100 + 2000 = 5100.
			partInstancesMap.get(parts[0]._id)!.timings = {
				duration: 5000,
				take: 0,
				plannedStartedPlayback: 100,
				plannedStoppedPlayback: 5100,
			}
			// B is on air, 500ms elapsed
			partInstancesMap.get(parts[1]._id)!.timings = {
				take: 3100,
				plannedStartedPlayback: 3100,
			}
			const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
			playlist.currentPartInfo = {
				partInstanceId: currentPartInstanceId,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			const rundown = makeMockRundown(rundownId, playlist)
			const result = timing.updateDurations(
				3600, // now = 3600ms (500ms after B started at 3100ms)
				false,
				playlist,
				[rundown],
				rundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId,
					currentSegmentId: protectString(segmentId),
					isLowResolution: false,
					currentPartWillAutoNext: false,
					currentTime: 3600,
					// No next part: falls back to original formula.
					// onAirPartDuration = ewt_B = -2000; remaining = min(3100,3600) + (-2000) - 3600 = -2500
					remainingTimeOnCurrentPart: -2500,
					// No next part: A countdown = 0 (past), B countdown = push position based on A's full 5000ms
					// waitDuration_A = 5000; waitAccumulator after A = 5000; scheduleAdvance_B = -2000 (negative
					// pre-push): B's push position = max(lastPartWaitStart=0, 5000 + (-2000)) = 3000
					partCountdown: { partA: 0, partB: 3000 },
					// B has no expected duration: remaining = 0
					remainingPlaylistDuration: 0,
					totalPlaylistDuration: 3000,
					// A played its full 5000ms (including overlap); B adds 500ms played so far
					asDisplayedPlaylistDuration: 5500,
					asPlayedPlaylistDuration: 5500,
					rundownExpectedDurations: { [rundownId]: 3000 },
					rundownAsPlayedDurations: { [rundownId]: 5500 },
					// A's display duration = timings.duration = 5000; B growing from 0
					partDisplayDurations: { partA: 5000, partB: 500 },
					// B's display start = displayAccum_after_A(5000) + min(0,-2000) = 3000
					partDisplayStartsAt: { partA: 0, partB: 3000 },
					partDurations: { partA: 5000, partB: 500 },
					partExpectedDurations: { partA: 5000, partB: 0 },
					partPlayed: { partA: 5000, partB: 500 },
					partStartsAt: { partA: 0, partB: 3000 },
					partsInQuickLoop: {},
					breakIsLastRundown: false,
					rundownsBeforeNextBreak: [],
					nextRundownAnchor: undefined,
				})
			)
		})
	})
})

describe('findPartInstancesInQuickLoop', () => {
	it('Returns no parts when QuickLoop is not defined', () => {
		const { partInstances } = makeMockPartsForQuickLoopTest()
		const playlist = makeMockPlaylist()

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({})
	})

	it('Returns parts between QuickLoop Part Markers when loop is not running', () => {
		const { parts, partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PART,
				id: parts[1]._id,
			},
			end: {
				type: QuickLoopMarkerType.PART,
				id: parts[3]._id,
			},
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({
			[unprotectString(parts[1]._id)]: true,
			[unprotectString(parts[2]._id)]: true,
			[unprotectString(parts[3]._id)]: true,
		})
	})

	it('Returns parts between QuickLoop Part Markers when loop is running', () => {
		const { parts, partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PART,
				id: parts[1]._id,
			},
			end: {
				type: QuickLoopMarkerType.PART,
				id: parts[3]._id,
			},
			running: true,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({
			[unprotectString(parts[1]._id)]: true,
			[unprotectString(parts[2]._id)]: true,
			[unprotectString(parts[3]._id)]: true,
		})
	})

	it('Returns no parts when the entire Playlist is looping', () => {
		// this may need to change if setting other than Part markers is allowed by the users
		const { partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PLAYLIST,
			},
			end: {
				type: QuickLoopMarkerType.PLAYLIST,
			},
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({})
	})

	it('Returns no parts when QuickLoop Part Markers are in the wrong order', () => {
		const { parts, partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PART,
				id: parts[3]._id,
			},
			end: {
				type: QuickLoopMarkerType.PART,
				id: parts[1]._id,
			},
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({})
	})

	it('Returns no parts when QuickLoop End Marker is not defined', () => {
		const { parts, partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PART,
				id: parts[3]._id,
			},
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({})
	})
})
