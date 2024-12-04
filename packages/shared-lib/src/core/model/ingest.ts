export enum DefaultUserOperationsIDs {
	MoveSegment = '__sofie-move-segment',
	ImportMOSItem = '__sofie-import-mos',
}

export type DefaultUserOperations = MoveSegmentUserOperations | ImportMOSItemUserOperation

export type MoveSegmentUserOperations = {
	id: DefaultUserOperationsIDs.MoveSegment
	payload: Record<string, never> // Future: define properly
}

export type ImportMOSItemUserOperation = {
	id: DefaultUserOperationsIDs.ImportMOSItem

	payloadType: string
	payload: any
}
