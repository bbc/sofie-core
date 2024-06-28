import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { clone } from '@sofie-automation/corelib/dist/lib'
import {
	IngestChangeType,
	IngestRundown,
	NrcsIngestRundownChangeDetails,
} from '@sofie-automation/blueprints-integration'
import { ComputedIngestChangeAction, UpdateIngestRundownChange } from '../runOperation'
import {
	handleRegenerateRundown,
	handleRemovedRundown,
	handleUpdatedRundown,
	handleUpdatedRundownMetaData,
	handleUserUnsyncRundown,
} from '../ingestRundownJobs'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown, RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'

function getDefaultIngestRundown(): IngestRundown {
	return {
		externalId: 'rundown0',
		type: 'mos',
		name: 'Rundown',
		segments: [
			{
				externalId: 'segment0',
				name: 'Segment 0',
				rank: 0,
				parts: [
					{
						externalId: 'part0',
						name: 'Part 0',
						rank: 0,
					},
					{
						externalId: 'part1',
						name: 'Part 1',
						rank: 1,
					},
				],
			},
			{
				externalId: 'segment1',
				name: 'Segment 1',
				rank: 1,
				parts: [
					{
						externalId: 'part2',
						name: 'Part 2',
						rank: 0,
					},
					{
						externalId: 'part3',
						name: 'Part 3',
						rank: 1,
					},
				],
			},
		],
	}
}

describe('handleRemovedRundown', () => {
	it('no rundown, normal delete', () => {
		const context = setupDefaultJobEnvironment()

		expect(
			handleRemovedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					// forceDelete: false,
				},
				undefined
			)
		).toBe(ComputedIngestChangeAction.DELETE)
	})

	it('no rundown, force delete', () => {
		const context = setupDefaultJobEnvironment()

		expect(
			handleRemovedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					forceDelete: true,
				},
				undefined
			)
		).toBe(ComputedIngestChangeAction.FORCE_DELETE)
	})

	it('with rundown, normal delete', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(
			handleRemovedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					forceDelete: false,
				},
				ingestRundown
			)
		).toBe(ComputedIngestChangeAction.DELETE)
	})

	it('with rundown, force delete', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(
			handleRemovedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					forceDelete: true,
				},
				ingestRundown
			)
		).toBe(ComputedIngestChangeAction.FORCE_DELETE)
	})
})

// TODO: handleUserRemoveRundown

describe('handleRegenerateRundown', () => {
	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleRegenerateRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('good', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleRegenerateRundown(
			context,
			{
				peripheralDeviceId: null,
				rundownExternalId: 'rundown0',
			},
			clone(ingestRundown)
		)

		expect(changes).toEqual({
			ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleUserUnsyncRundown', () => {
	const rundownId: RundownId = protectString('rundown0')

	async function createRundown(context: MockJobContext, fragment?: Partial<DBRundown>) {
		await context.mockCollections.Rundowns.insertOne({
			_id: rundownId,
			organizationId: protectString('organization0'),
			studioId: context.studioId,
			showStyleBaseId: protectString('showStyleBase0'),
			showStyleVariantId: protectString('showStyleVariant0'),
			peripheralDeviceId: undefined,
			created: 0,
			modified: 0,
			importVersions: {} as any,
			externalId: 'rundownExternal0',
			name: 'Rundown',
			timing: {} as any,
			playlistId: protectString('playlist0'),
			externalNRCSName: 'NRCS',
			...fragment,
		})
		context.mockCollections.Rundowns.clearOpLog()
	}

	it('no rundown', async () => {
		const context = setupDefaultJobEnvironment()

		await handleUserUnsyncRundown(context, { rundownId })

		expect(context.mockCollections.Rundowns.operations).toHaveLength(1)
		expect(context.mockCollections.Rundowns.operations[0]).toEqual({
			type: 'findOne',
			args: ['rundown0', undefined],
		})
	})

	it('already orphaned', async () => {
		const context = setupDefaultJobEnvironment()

		await createRundown(context, { orphaned: RundownOrphanedReason.MANUAL })

		await handleUserUnsyncRundown(context, { rundownId })

		expect(context.mockCollections.Rundowns.operations).toHaveLength(1)
		expect(context.mockCollections.Rundowns.operations[0]).toEqual({
			type: 'findOne',
			args: ['rundown0', undefined],
		})
	})

	it('good', async () => {
		const context = setupDefaultJobEnvironment()

		await createRundown(context, {})

		await handleUserUnsyncRundown(context, { rundownId })

		expect(context.mockCollections.Rundowns.operations).toHaveLength(2)
		expect(context.mockCollections.Rundowns.operations[0]).toEqual({
			type: 'findOne',
			args: ['rundown0', undefined],
		})
		expect(context.mockCollections.Rundowns.operations[1]).toEqual({
			type: 'update',
			args: [
				'rundown0',
				{
					$set: {
						orphaned: RundownOrphanedReason.MANUAL,
					},
				},
			],
		})
	})
})

describe('handleUpdatedRundown', () => {
	const newIngestRundown: IngestRundown = {
		externalId: 'rundown0',
		type: 'mos',
		name: 'Rundown2',
		segments: [
			{
				externalId: 'segment0',
				name: 'Segment 0b',
				rank: 0,
				parts: [
					{
						externalId: 'part0',
						name: 'Part 0b',
						rank: 0,
					},
					{
						externalId: 'part1',
						name: 'Part 1b',
						rank: 1,
					},
				],
			},
			{
				externalId: 'segment2',
				name: 'Segment 2',
				rank: 1,
				parts: [
					{
						externalId: 'part4',
						name: 'Part 4',
						rank: 0,
					},
					{
						externalId: 'part5',
						name: 'Part 5',
						rank: 1,
					},
				],
			},
		],
	}

	it('create rundown', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedRundown(
			context,
			{
				peripheralDeviceId: null,
				rundownExternalId: 'rundown0',
				ingestRundown: clone(ingestRundown),
				isCreateAction: true,
			},
			undefined
		)

		expect(changes).toEqual({
			ingestRundown: ingestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		} satisfies UpdateIngestRundownChange)
	})

	it('update missing rundown', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		expect(() =>
			handleUpdatedRundown(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					ingestRundown: clone(ingestRundown),
					isCreateAction: false,
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('update existing rundown', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedRundown(
			context,
			{
				peripheralDeviceId: null,
				rundownExternalId: 'rundown0',
				ingestRundown: clone(newIngestRundown),
				isCreateAction: false,
			},
			clone(ingestRundown)
		)

		expect(changes).toEqual({
			ingestRundown: newIngestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
			},
		} satisfies UpdateIngestRundownChange)
	})
})

describe('handleUpdatedRundownMetaData', () => {
	const newIngestRundown: IngestRundown = {
		externalId: 'rundown0',
		type: 'mos',
		name: 'Rundown2',
		segments: [],
		payload: {
			key: 'value',
		},
	}

	it('no rundown', () => {
		const context = setupDefaultJobEnvironment()

		expect(() =>
			handleUpdatedRundownMetaData(
				context,
				{
					peripheralDeviceId: null,
					rundownExternalId: 'rundown0',
					ingestRundown: clone(newIngestRundown),
				},
				undefined
			)
		).toThrow(/Rundown(.*)not found/)
	})

	it('update existing rundown', () => {
		const context = setupDefaultJobEnvironment()

		const ingestRundown = getDefaultIngestRundown()

		const changes = handleUpdatedRundownMetaData(
			context,
			{
				peripheralDeviceId: null,
				rundownExternalId: 'rundown0',
				ingestRundown: clone(newIngestRundown),
			},
			clone(ingestRundown)
		)

		// update the expected ingestRundown
		const expectedIngestRundown: IngestRundown = {
			...newIngestRundown,
			segments: ingestRundown.segments,
		}

		expect(changes).toEqual({
			ingestRundown: expectedIngestRundown,
			changes: {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Payload,
			},
		} satisfies UpdateIngestRundownChange)
	})
})
