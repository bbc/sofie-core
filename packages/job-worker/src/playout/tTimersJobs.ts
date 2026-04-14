import {
	TTimerClearProjectedProps,
	TTimerPauseProps,
	TTimerRestartProps,
	TTimerResumeProps,
	TTimerSetProjectedAnchorPartProps,
	TTimerSetProjectedDurationProps,
	TTimerSetProjectedTimeProps,
	TTimerStartCountdownProps,
	TTimerStartFreeRunProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runWithPlayoutModel, runWithPlaylistLock } from './lock.js'
import {
	createCountdownTTimer,
	createFreeRunTTimer,
	pauseTTimer,
	recalculateTTimerProjections,
	restartTTimer,
	resumeTTimer,
	validateTTimerIndex,
} from './tTimers.js'
import { runJobWithPlayoutModel } from './lock.js'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getCurrentTime } from '../lib/index.js'

/**
 * Handle RecalculateTTimerProjections job
 * This is called after setNext, takes, and ingest changes to update T-Timer projections
 * Since this job doesn't take a playlistId parameter, it finds the active playlist in the studio
 */
export async function handleRecalculateTTimerProjections(context: JobContext): Promise<void> {
	// Find active playlists in this studio (projection to just get IDs)
	const activePlaylistIds = await context.directCollections.RundownPlaylists.findFetch(
		{
			studioId: context.studioId,
			activationId: { $exists: true },
		},
		{
			projection: {
				_id: 1,
			},
		}
	)

	if (activePlaylistIds.length === 0) {
		// No active playlist, nothing to do
		return
	}

	// Process each active playlist (typically there's only one)
	for (const playlistRef of activePlaylistIds) {
		await runWithPlaylistLock(context, playlistRef._id, async (lock) => {
			// Fetch the full playlist object
			const playlist = await context.directCollections.RundownPlaylists.findOne(playlistRef._id)
			if (!playlist) {
				// Playlist was removed between query and lock
				return
			}

			await runWithPlayoutModel(context, playlist, lock, null, async (playoutModel) => {
				recalculateTTimerProjections(context, playoutModel)
			})
		})
	}
}

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

export async function handleTTimerClearProjected(_context: JobContext, data: TTimerClearProjectedProps): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const currentTimer = playoutModel.playlist.tTimers[data.timerIndex - 1]
		playoutModel.updateTTimer({
			...currentTimer,
			anchorPartId: undefined,
			projectedState: undefined,
		})
	})
}

export async function handleTTimerSetProjectedAnchorPart(
	_context: JobContext,
	data: TTimerSetProjectedAnchorPartProps
): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const currentTimer = playoutModel.playlist.tTimers[data.timerIndex - 1]

		const providedPartId = data.partId ? unprotectString(data.partId) : undefined

		const part =
			(data.externalId
				? playoutModel.getAllOrderedParts().find((p) => p.externalId === data.externalId)
				: undefined) ??
			(providedPartId
				? playoutModel
						.getAllOrderedParts()
						.find((p) => p._id === protectString<PartId>(providedPartId) || p.externalId === providedPartId)
				: undefined)

		if (!part) return

		playoutModel.updateTTimer({
			...currentTimer,
			anchorPartId: part._id,
			projectedState: undefined, // Clear manual projection
		})

		recalculateTTimerProjections(_context, playoutModel)
	})
}

export async function handleTTimerSetProjectedTime(
	_context: JobContext,
	data: TTimerSetProjectedTimeProps
): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const projectedState: TimerState = data.paused
			? literal<TimerState>({ paused: true, duration: data.time - getCurrentTime() })
			: literal<TimerState>({ paused: false, zeroTime: data.time })

		const currentTimer = playoutModel.playlist.tTimers[data.timerIndex - 1]
		playoutModel.updateTTimer({
			...currentTimer,
			anchorPartId: undefined, // Clear automatic anchor
			projectedState,
		})
	})
}

export async function handleTTimerSetProjectedDuration(
	_context: JobContext,
	data: TTimerSetProjectedDurationProps
): Promise<void> {
	return runJobWithPlayoutModel(_context, data, null, async (playoutModel) => {
		validateTTimerIndex(data.timerIndex)

		const projectedState: TimerState = data.paused
			? literal<TimerState>({ paused: true, duration: data.duration })
			: literal<TimerState>({ paused: false, zeroTime: getCurrentTime() + data.duration })

		const currentTimer = playoutModel.playlist.tTimers[data.timerIndex - 1]
		playoutModel.updateTTimer({
			...currentTimer,
			anchorPartId: undefined, // Clear automatic anchor
			projectedState,
		})
	})
}
