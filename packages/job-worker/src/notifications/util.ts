import type { INotification, INotificationsModel } from './NotificationsModel'

export async function replaceAllNotificationsForCategory(
	model: INotificationsModel,
	category: string,
	newNotifications: INotification[]
): Promise<void> {
	const existingNotifications = await model.getAllNotifications(category)

	// Add any new notifications
	for (const notification of newNotifications) {
		model.setNotification(category, notification)
	}

	// Remove any notifications that are no longer present
	const newNotificationKeys = new Set(newNotifications.map((n) => n.id))
	for (const notification of existingNotifications) {
		if (!newNotificationKeys.has(notification.id)) {
			model.removeNotification(category, notification.id)
		}
	}
}
