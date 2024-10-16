import {
	ITranslatableMessage,
	wrapTranslatableMessageFromBlueprints,
} from '@sofie-automation/corelib/dist/TranslatableMessage'
import type { INotification, INotificationWithTarget, INotificationsModel } from './NotificationsModel'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getHash } from '@sofie-automation/corelib/dist/hash'

export async function replaceAllNotificationsForCategory(
	model: INotificationsModel,
	category: string,
	newNotifications: INotificationWithTarget[]
): Promise<void> {
	const existingNotifications = await model.getAllNotifications(category)

	// Remove any notifications that are no longer present
	const newNotificationKeys = new Set(newNotifications.map((n) => n.id))
	for (const notification of existingNotifications) {
		if (!newNotificationKeys.has(notification.id)) {
			model.clearNotification(category, notification.id)
		}
	}

	// Add any new notifications
	for (const notification of newNotifications) {
		model.setNotification(category, notification)
	}
}

/** Generate the translation for a string, to be applied later when it gets rendered */
export function generateTranslation(
	key: string,
	args?: { [k: string]: any },
	namespaces?: string[]
): ITranslatableMessage {
	return {
		key,
		args,
		namespaces,
	}
}

export function translateNoteToNotification(note: INoteBase, blueprintIds: BlueprintId[]): INotification {
	return {
		id: getHash(JSON.stringify(note.message)),
		severity: note.type,
		message: wrapTranslatableMessageFromBlueprints(note.message, blueprintIds),
	}
}
