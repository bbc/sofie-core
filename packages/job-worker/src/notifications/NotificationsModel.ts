import type { NoteSeverity } from '@sofie-automation/blueprints-integration'
import type { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

export interface INotification {
	id: string

	severity: NoteSeverity
	message: ITranslatableMessage

	// TODO
}

export interface INotificationsModel {
	/**
	 * Get the current notifications for a category
	 * This may fetch the notifications from the database if they are not already loaded
	 * @param category category of notifications to get
	 */
	getAllNotifications(category: string): Promise<INotification[]>

	/**
	 * Remove a notification from the list
	 * @param category category of the notification
	 * @param notificationId id of the notification to remove
	 */
	clearNotification(category: string, notificationId: string): void

	/**
	 * Add/replace a notification to the list
	 * @param category category of the notification
	 * @param notification notification to add
	 */
	setNotification(category: string, notification: INotification): void

	/**
	 * Clear all notifications for a category
	 * @param category category of notifications to clear
	 */
	clearAllNotifications(category: string): void
}
