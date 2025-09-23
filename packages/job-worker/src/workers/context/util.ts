import type { QueueJobOptions } from '../../jobs'

export type QueueJobFunc = (
	queueName: string,
	jobName: string,
	jobData: unknown,
	options: QueueJobOptions | undefined
) => Promise<void>
