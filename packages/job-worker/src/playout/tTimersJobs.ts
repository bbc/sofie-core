import {
	TTimerPauseProps,
	TTimerRestartProps,
	TTimerResumeProps,
	TTimerStartCountdownProps,
	TTimerStartFreeRunProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runJobWithPlayoutModel } from './lock.js'
import {
	createCountdownTTimer,
	createFreeRunTTimer,
	pauseTTimer,
	restartTTimer,
	resumeTTimer,
	validateTTimerIndex,
} from './tTimers.js'

export async function handleTTimerStartCountdown(_context: JobContext, data: TTimerStartCountdownProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const currentTimer = playoutModel.playlist.tTimers[data.timerIndex - 1]
		playoutModel.updateTTimer({
			...currentTimer,
			...createCountdownTTimer(data.duration * 1000, {
				stopAtZero: data.stopAtZero,
				startPaused: data.startPaused,
			}),
		})
	})
}

export async function handleTTimerStartFreeRun(_context: JobContext, data: TTimerStartFreeRunProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const currentTimer = playoutModel.playlist.tTimers[data.timerIndex - 1]
		playoutModel.updateTTimer({
			...currentTimer,
			...createFreeRunTTimer({
				startPaused: data.startPaused,
			}),
		})
	})
}

export async function handleTTimerPause(_context: JobContext, data: TTimerPauseProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timerIndex = data.timerIndex - 1
		const currentTimer = playoutModel.playlist.tTimers[timerIndex]
		if (!currentTimer.mode) return

		const updatedTimer = pauseTTimer(currentTimer)
		if (updatedTimer) {
			playoutModel.updateTTimer(updatedTimer)
		}
	})
}

export async function handleTTimerResume(_context: JobContext, data: TTimerResumeProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timerIndex = data.timerIndex - 1
		const currentTimer = playoutModel.playlist.tTimers[timerIndex]
		if (!currentTimer.mode) return

		const updatedTimer = resumeTTimer(currentTimer)
		if (updatedTimer) {
			playoutModel.updateTTimer(updatedTimer)
		}
	})
}

export async function handleTTimerRestart(_context: JobContext, data: TTimerRestartProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const timerIndex = data.timerIndex - 1
		const currentTimer = playoutModel.playlist.tTimers[timerIndex]
		if (!currentTimer.mode) return

		const updatedTimer = restartTTimer(currentTimer)
		if (updatedTimer) {
			playoutModel.updateTTimer(updatedTimer)
		}
	})
}
