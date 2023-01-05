import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExecutableAction, ReactivePlaylistActionContext } from '../../../lib/api/triggers/actionFactory'
import { DeviceActionId } from '../../../lib/api/triggers/MountedTriggers'

/**
 * `StudioActionManager` allows to store the current, runtime ReactivePlaylistActionContext for a given studio
 * and also store the functions that need to be executed server-side, once an action is triggered. These functions
 * are compiled runtime, based on TriggeredAction configuration and it doesn't make sense to compile them when
 * they are triggered.
 */
export class StudioActionManager {
	private allDeviceActions = new Map<DeviceActionId, ExecutableAction>()
	private currentStudioContext: ReactivePlaylistActionContext | undefined

	setAction(actionId: DeviceActionId, action: ExecutableAction) {
		this.allDeviceActions.set(actionId, action)
	}

	deleteAction(actionId: DeviceActionId) {
		this.allDeviceActions.delete(actionId)
	}

	getAction(actionId: DeviceActionId): ExecutableAction | undefined {
		return this.allDeviceActions.get(actionId)
	}

	setContext(context: ReactivePlaylistActionContext) {
		this.currentStudioContext = context
	}

	deleteContext() {
		this.currentStudioContext = undefined
	}

	getContext(): ReactivePlaylistActionContext | undefined {
		return this.currentStudioContext
	}
}

/**
 * A collection of StudioActionManagers for every studio. Items are added and removed from this collection
 * by StudioDeviceTriggerManager instances. The context and cached actions are then used by `receiveInputDeviceTrigger()`
 * in `.\observer.ts`.
 */
export const StudioActionManagers: Map<StudioId, StudioActionManager> = new Map()
