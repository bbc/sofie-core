import type { IExecuteTSRActionsContext } from './executeTsrActionContext.js'
import type { IShowStyleContext } from './showStyleContext.js'
import type { IStudioContext } from './studioContext.js'

export type BlueprintSnapshotType = 'system' | 'debug'

export interface IBlueprintSystemSnapshotOptions {
	studioId?: string
	withDeviceSnapshots?: boolean
	/** True when the snapshot includes all studios (not filtered to a single studio) */
	fullSystem?: boolean
}

export interface IBlueprintSystemSnapshotInfo {
	snapshotId: string
	reason: string
	type: BlueprintSnapshotType
	options: IBlueprintSystemSnapshotOptions
	/** Number of playout peripheral devices in the studio at snapshot time */
	deviceCount: number
}

export interface ISystemSnapshotCreatedContext extends IStudioContext, IExecuteTSRActionsContext {}

export interface IBlueprintPlaylistSnapshotOptions {
	full: boolean
	withTimeline: boolean
}

export interface IBlueprintPlaylistSnapshotPlaylistInfo {
	name: string
	active: boolean
	rehearsal: boolean
}

export interface IBlueprintPlaylistSnapshotInfo {
	snapshotId: string
	playlistId: string
	reason: string
	options: IBlueprintPlaylistSnapshotOptions
	playlist: IBlueprintPlaylistSnapshotPlaylistInfo
}

export interface IPlaylistSnapshotCreatedContext extends IShowStyleContext, IExecuteTSRActionsContext {}
