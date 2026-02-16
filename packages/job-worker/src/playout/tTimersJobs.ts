import { JobContext } from '../jobs/index.js'
import { SetTimerVisibilityProps } from '@sofie-automation/corelib/dist/worker/studio'
import { validateTTimerIndex } from './tTimers.js'
import { runJobWithPlayoutModel } from './lock.js'

export async function handleSetTimerVisibility(context: JobContext, data: SetTimerVisibilityProps): Promise<void> {
	return runJobWithPlayoutModel(context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timerArrayIndex = data.timerIndex - 1
		const timer = playoutModel.playlist.tTimers[timerArrayIndex]

		const currentVisibility = timer.visibility ?? {
			rundownView: true,
			directorScreen: true,
			presenterScreen: true,
			prompterScreen: true,
		}

		const updatedTimer = {
			...timer,
			visibility: {
				rundownView: data.visibility.rundownView ?? currentVisibility.rundownView,
				directorScreen: data.visibility.directorScreen ?? currentVisibility.directorScreen,
				presenterScreen: data.visibility.presenterScreen ?? currentVisibility.presenterScreen,
				prompterScreen: data.visibility.prompterScreen ?? currentVisibility.prompterScreen,
			},
		}

		playoutModel.updateTTimer(updatedTimer)
	})
}
