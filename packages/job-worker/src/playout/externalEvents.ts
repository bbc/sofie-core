import { OnExternalEventsProps } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../logging.js'
import { JobContext } from '../jobs/index.js'

/**
 * Called by sofie-core when one or more external events have been received from a gateway.
 *
 * Events from multiple gateways, or from rapid bursts on a single gateway, are merged into a
 * single job invocation by the queue manager to prevent flooding.
 *
 * @stub — blueprint processing is not yet implemented; this will be wired up in a follow-up.
 */
export async function handleOnExternalEvents(_context: JobContext, data: OnExternalEventsProps): Promise<void> {
	logger.debug(`handleOnExternalEvents: received ${data.events.length} event(s) (not yet processed)`)
}
