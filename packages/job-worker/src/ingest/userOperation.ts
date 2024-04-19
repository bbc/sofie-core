import { UserExecuteChangeOperationProps } from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../jobs'
import { UpdateIngestRundownResult, runIngestUpdateOperationBase } from './runOperation'

export async function handleUserExecuteChangeOperation(
	context: JobContext,
	data: UserExecuteChangeOperationProps
): Promise<void> {
	return runIngestUpdateOperationBase(context, data, async (nrcsIngestObjectCache) => {
		const nrcsIngestRundown = nrcsIngestObjectCache.fetchRundown()
		if (!nrcsIngestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

		return {
			ingestRundown: nrcsIngestRundown,
			changes: {
				source: 'user',
				operation: data.operation as unknown as any,
				operationTarget: data.operationTarget,
			},
		} satisfies UpdateIngestRundownResult
	})
}
