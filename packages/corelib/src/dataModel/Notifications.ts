import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ITranslatableMessage } from '../TranslatableMessage'
import { RundownId, SegmentId, PartId, PieceId } from './Ids'

export interface NotificationObj {
	id: string
	parentId?: string
	son?: INoteBase | NotificationObj
}

export interface INoteBase {
	type: NoteSeverity
	message: ITranslatableMessage
	origin?: {
		name: string
	}
	timestamp?: Date
	autoTimeout?: Date
}

export interface TrackedNote extends NotificationObj {
	rank: number
	origin: {
		name: string
		segmentName?: string
		rundownId?: RundownId
		segmentId?: SegmentId
		partId?: PartId
		pieceId?: PieceId
	}
}

const noteTest: NotificationObj = {
	id: 'PART_idunique1',
	son: {
		id: 'SEGMENT_unique1',
		parentId: 'PART_iduniqeu1',
		son: {
			type: NoteSeverity.INFO,
			message: {
				key: 'test',
				args: {},
			},
		},
	},
}

console.log(noteTest)

const notificationTest: NotificationObj = {
	id: 'studioId',
	son: {
		parentId: 'studioId',
		id: 'jobworkerplayout',
		son: {
			parentId: 'jobworkerplayout',
			id: 'ABPlayback',
			son: {
				type: NoteSeverity.WARNING,
				message: {
					key: 'unique',
					args: {
						text: 'Your computer will explode in 10 sec',
					},
				},
			},
		},
	},
}

console.log(notificationTest)
