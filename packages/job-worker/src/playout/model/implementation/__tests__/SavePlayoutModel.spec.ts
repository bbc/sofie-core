import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlayoutSegmentModelImpl } from '../PlayoutSegmentModelImpl'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PlayoutRundownModelImpl } from '../PlayoutRundownModelImpl'
import { setupDefaultJobEnvironment } from '../../../../__mocks__/context'
import { writePartInstancesAndPieceInstances, writeScratchpadSegments } from '../SavePlayoutModel'
import { PlayoutPartInstanceModelImpl } from '../PlayoutPartInstanceModelImpl'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

describe('SavePlayoutModel', () => {
	function createRundownModel(segments?: DBSegment[]): PlayoutRundownModelImpl {
		const rundown: DBRundown = {
			_id: protectString('rd0'),
			organizationId: null,
			studioId: protectString('studio0'),
			showStyleBaseId: protectString('ssb0'),
			showStyleVariantId: protectString('ssv0'),
			created: 0,
			modified: 0,
			externalId: 'rd0',
			name: `my rundown`,
			importVersions: null as any,
			timing: null as any,
			externalNRCSName: 'FAKE',
			playlistId: protectString('playlist0'),
		}

		const segmentModels = (segments ?? []).map((s) => new PlayoutSegmentModelImpl(s, []))
		return new PlayoutRundownModelImpl(rundown, segmentModels, [])
	}

	describe('writeScratchpadSegments', () => {
		it('no rundowns', async () => {
			const context = setupDefaultJobEnvironment()

			await writeScratchpadSegments(context, [])

			expect(context.mockCollections.Segments.operations).toHaveLength(0)
		})

		it('no scratchpad segment', async () => {
			const context = setupDefaultJobEnvironment()

			const rundown0 = createRundownModel()
			const rundown1 = createRundownModel()
			rundown1.insertScratchpadSegment()
			rundown1.clearScratchPadSegmentChangedFlag()

			await writeScratchpadSegments(context, [rundown0, rundown1])

			expect(context.mockCollections.Segments.operations).toHaveLength(0)
		})

		it('scratchpads with changes', async () => {
			const context = setupDefaultJobEnvironment()

			// create a rundown with an inserted scratchpad
			const rundown0 = createRundownModel()
			rundown0.insertScratchpadSegment()

			// create a rundown with a removed scratchpad
			const rundown1 = createRundownModel()
			rundown1.insertScratchpadSegment()
			rundown1.clearScratchPadSegmentChangedFlag()
			rundown1.removeScratchpadSegment()

			// create a rundown with no changes
			const rundown2 = createRundownModel()
			rundown2.insertScratchpadSegment()
			rundown2.clearScratchPadSegmentChangedFlag()

			await writeScratchpadSegments(context, [rundown0, rundown1, rundown2])

			expect(context.mockCollections.Segments.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      3,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$ne": "randomId9001",
			        },
			        "orphaned": "scratchpad",
			        "rundownId": "rd0",
			      },
			    ],
			    "type": "remove",
			  },
			  {
			    "args": [
			      "randomId9001",
			    ],
			    "type": "replace",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$ne": "",
			        },
			        "orphaned": "scratchpad",
			        "rundownId": "rd0",
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
		})
	})

	describe('writePartInstancesAndPieceInstances', () => {
		it('no PartInstances', async () => {
			const context = setupDefaultJobEnvironment()

			await Promise.all(writePartInstancesAndPieceInstances(context, new Map()))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(0)
			expect(context.mockCollections.PieceInstances.operations).toHaveLength(0)
		})

		it('delete PartInstances', async () => {
			const context = setupDefaultJobEnvironment()

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), null)
			partInstances.set(protectString('id1'), null)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PartInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$in": [
			            "id0",
			            "id1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
			expect(context.mockCollections.PieceInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PieceInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      {
			        "partInstanceId": {
			          "$in": [
			            "id0",
			            "id1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
		})

		it('delete PieceInstances', async () => {
			const context = setupDefaultJobEnvironment()

			const pieceInstance = { _id: 'test0' } as unknown as PieceInstance
			const partInstanceModel = new PlayoutPartInstanceModelImpl(null as any, [pieceInstance], false)
			expect(partInstanceModel.removePieceInstance(pieceInstance._id)).toBeTruthy()

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), partInstanceModel)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(0)

			expect(context.mockCollections.PieceInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PieceInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$in": [
			            "test0",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
		})

		it('update PartInstance', async () => {
			const context = setupDefaultJobEnvironment()

			const partInstanceModel = new PlayoutPartInstanceModelImpl({ _id: 'id0' } as any, [], false)
			expect(partInstanceModel.partInstance.blockTakeUntil).toBeUndefined()
			partInstanceModel.blockTakeUntil(10000)
			expect(partInstanceModel.partInstance.blockTakeUntil).toEqual(10000)

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), partInstanceModel)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PartInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      "id0",
			    ],
			    "type": "replace",
			  },
			]
		`)
		})

		it('update PieceInstance', async () => {
			const context = setupDefaultJobEnvironment()

			const pieceInstance = { _id: 'test0' } as unknown as PieceInstance
			const partInstanceModel = new PlayoutPartInstanceModelImpl(null as any, [pieceInstance], false)
			expect(
				partInstanceModel.mergeOrInsertPieceInstance({
					...pieceInstance,
					adLibSourceId: protectString('adlib0'),
				})
			).toBeTruthy()

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), partInstanceModel)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(0)

			expect(context.mockCollections.PieceInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PieceInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      "test0",
			    ],
			    "type": "replace",
			  },
			]
		`)
		})

		it('combination of all ops', async () => {
			const context = setupDefaultJobEnvironment()

			const pieceInstance = { _id: 'test0' } as unknown as PieceInstance
			const pieceInstance2 = { _id: 'test1' } as unknown as PieceInstance
			const partInstanceModel = new PlayoutPartInstanceModelImpl(
				{ _id: 'id0' } as any,
				[pieceInstance, pieceInstance2],
				false
			)
			expect(
				partInstanceModel.mergeOrInsertPieceInstance({
					...pieceInstance,
					adLibSourceId: protectString('adlib0'),
				})
			).toBeTruthy()
			expect(partInstanceModel.removePieceInstance(pieceInstance2._id)).toBeTruthy()
			partInstanceModel.blockTakeUntil(10000)

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), partInstanceModel)
			partInstances.set(protectString('id1'), null)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(3)
			expect(context.mockCollections.PartInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      2,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      "id0",
			    ],
			    "type": "replace",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$in": [
			            "id1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)

			expect(context.mockCollections.PieceInstances.operations).toHaveLength(4)
			expect(context.mockCollections.PieceInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      3,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      "test0",
			    ],
			    "type": "replace",
			  },
			  {
			    "args": [
			      {
			        "partInstanceId": {
			          "$in": [
			            "id1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$in": [
			            "test1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
		})
	})
})