import type { TSR } from '@sofie-automation/shared-lib/dist/tsr'

/**
 * A TSR state event, wrapped with a `type` discriminant so it can be distinguished
 * from other future event sources in the {@link BlueprintExternalEvent} union.
 */
export type BlueprintExternalTSREvent = TSR.SomeTSRStateEvent & { type: 'tsr' }

/**
 * An event from an external source, received by the blueprint's {@link onExternalEvent} handler.
 *
 * Currently only TSR state events are supported. This union will be extended in future to cover
 * other event sources
 */
export type BlueprintExternalEvent = BlueprintExternalTSREvent
// | { type: 'input'; ... }  // example future scope

/** A subscription to a single named event on a TSR playout device */
export interface TSRExternalEventSubscription {
	/** The id of the playout device, e.g. `'atem0'` */
	deviceId: string
	/** The event key to subscribe to, e.g. `'me.0.programInput'` */
	event: string
}

/**
 * The set of external event subscriptions declared alongside a rundown.
 * Sofie will forward these to the relevant devices so that only subscribed events
 * are delivered to the blueprint's {@link onExternalEvent} handler.
 */
export interface BlueprintExternalEventSubscriptions {
	tsr: TSRExternalEventSubscription[]
}
