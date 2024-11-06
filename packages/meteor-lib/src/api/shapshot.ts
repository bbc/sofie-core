import type { RundownPlaylistId, SnapshotId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'

export interface NewSnapshotAPI {
	storeSystemSnapshot(hashedToken: string, studioId: StudioId | null, reason: string): Promise<SnapshotId>
	storeRundownPlaylist(
		hashedToken: string,
		playlistId: RundownPlaylistId,
		reason: string,
		full?: boolean
	): Promise<SnapshotId>
	storeDebugSnapshot(hashedToken: string, studioId: StudioId, reason: string): Promise<SnapshotId>
	restoreSnapshot(snapshotId: SnapshotId, restoreDebugData: boolean): Promise<void>
	removeSnapshot(snapshotId: SnapshotId): Promise<void>
}

export enum SnapshotAPIMethods {
	storeSystemSnapshot = 'snapshot.systemSnapshot',
	storeRundownPlaylist = 'snapshot.rundownPlaylistSnapshot',
	storeDebugSnapshot = 'snapshot.debugSnaphot',

	restoreSnapshot = 'snapshot.restoreSnaphot',
	removeSnapshot = 'snapshot.removeSnaphot',
}
