import type { JobContext } from '../jobs'
import type { INotification, INotificationsModel } from './NotificationsModel'

export class NotificationsModelHelper implements INotificationsModel {
	constructor(context: JobContext, categoryPrefix: string) {
		// TODO
	}

	async getAllNotifications(category: string): Promise<INotification[]> {
		throw new Error('Method not implemented.')
	}
	removeNotification(category: string, notificationId: string): void {
		throw new Error('Method not implemented.')
	}
	setNotification(category: string, notification: INotification): void {
		throw new Error('Method not implemented.')
	}
	clearAllNotifications(category: string): void {
		throw new Error('Method not implemented.')
	}

	async saveAllToDatabase(): Promise<void> {
		throw new Error('Method not implemented.')
	}
}
