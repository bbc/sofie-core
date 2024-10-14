import { getCurrentTime } from '../lib'
import type { JobContext } from '../jobs'
import type { INotification, INotificationsModel } from './NotificationsModel'
import {
	DBNotificationTargetType,
	type DBNotificationObj,
} from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { getHash } from '@sofie-automation/corelib/dist/hash'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import type { Complete } from '@sofie-automation/corelib/dist/lib'
import type { AnyBulkWriteOperation } from 'mongodb'

export class NotificationsModelHelper implements INotificationsModel {
	readonly #context: JobContext
	readonly #categoryPrefix: string

	/**
	 * These properties track both the loaded state, and what will be written to the database when saving
	 * If a category is included in #loadedCategories, it has either been loaded from the database or the in memory version is the source of truth (ie, it has been cleared)
	 * An entry of a cateogy in #notificationsByCategory indicates that it has been modified in memory and has data to be written to the database.
	 * Only when a category is in both #loadedCategories and #notificationsByCategory is it considered to be fully loaded and up to date, otherwise it is considered to be a partial 'diff'
	 */
	readonly #loadedCategories = new Set<string>()
	readonly #notificationsByCategory = new Map<string, Map<string, DBNotificationObj | null>>()

	constructor(context: JobContext, categoryPrefix: string) {
		this.#context = context
		this.#categoryPrefix = categoryPrefix
	}

	#getFullCategoryName(category: string): string {
		return `${this.#categoryPrefix}:${category}`
	}

	async getAllNotifications(category: string): Promise<INotification[]> {
		const notificationsForCategory = this.#getOrCategoryEntry(category)

		if (!this.#loadedCategories.has(category)) {
			const dbNotifications = await this.#context.directCollections.Notifications.findFetch({
				category: this.#getFullCategoryName(category),
				// nocommit - any better ownership?
			})

			// Interleave into the store, for any which haven't already been updated
			for (const dbNotification of dbNotifications) {
				if (!notificationsForCategory.has(dbNotification.localId)) {
					notificationsForCategory.set(dbNotification.localId, dbNotification)
				} else {
					// Preserve the created time from the db
					const existingNotification = notificationsForCategory.get(dbNotification.localId)
					if (existingNotification) {
						existingNotification.created = dbNotification.created
					}
				}
			}

			// Indicate that this is now fully loaded in memory
			this.#loadedCategories.add(category)
		}

		return Array.from(notificationsForCategory.values())
			.filter((n): n is DBNotificationObj => !!n)
			.map((notification) => ({
				id: notification.localId,
				severity: notification.severity,
				message: notification.message,
				// nocommit - relatedTo
			}))
	}

	clearNotification(category: string, notificationId: string): void {
		const notificationsForCategory = this.#getOrCategoryEntry(category)

		// The notification may or may not be loaded, but this indicates that to the saving that we intend to delete it
		notificationsForCategory.delete(notificationId)
	}

	setNotification(category: string, notification: INotification): void {
		const notificationsForCategory = this.#getOrCategoryEntry(category)

		const existingNotification = notificationsForCategory.get(notification.id)

		notificationsForCategory.set(notification.id, {
			_id: protectString(getHash(`${this.#categoryPrefix}:${category}:${notification.id}`)), // nocommit - needs something about the relatedTo?
			category: this.#getFullCategoryName(category),
			localId: notification.id,
			severity: notification.severity,
			message: notification.message,
			relatedTo: {
				type: DBNotificationTargetType.EVERYWHERE, // nocommit - proper relatedTo
			},
			created: existingNotification?.created || 0, // 0 will be filled in when saving
			modified: 0, // Filled in when saving
		} satisfies Complete<DBNotificationObj>)
	}

	clearAllNotifications(category: string): void {
		// Tell this store that the category is loaded, and so should perform a full write to the db
		this.#loadedCategories.add(category)

		// Clear any known in memory notifications
		this.#notificationsByCategory.get(category)?.clear()
	}

	#getOrCategoryEntry(category: string): Map<string, DBNotificationObj | null> {
		let notificationsForCategory = this.#notificationsByCategory.get(category)
		if (!notificationsForCategory) {
			notificationsForCategory = new Map<string, DBNotificationObj | null>()
			this.#notificationsByCategory.set(category, notificationsForCategory)
		}
		return notificationsForCategory
	}

	async saveAllToDatabase(): Promise<void> {
		// Quick return if there is nothing to save
		if (this.#loadedCategories.size === 0 && this.#notificationsByCategory.size === 0) return

		const updates: AnyBulkWriteOperation<DBNotificationObj>[] = []

		const allCategoriesToUpdate = new Set<string>([
			...this.#loadedCategories,
			...this.#notificationsByCategory.keys(),
		])
		for (const category of allCategoriesToUpdate) {
			const notificationsForCategory = this.#notificationsByCategory.get(category)
			const isFullyInMemory = this.#loadedCategories.has(category)

			const idsToDelete: string[] = []
			const idsToUpdate: string[] = []
			for (const [id, notification] of notificationsForCategory || []) {
				if (notification) {
					idsToUpdate.push(id)
				} else {
					idsToDelete.push(id)
				}
			}

			// If the category is fully in memory, we want to delete everything except those being updated
			if (isFullyInMemory) {
				updates.push({
					deleteMany: {
						filter: {
							category: this.#getFullCategoryName(category),
							localId: { $nin: idsToUpdate },
						},
					},
				})
			} else {
				// If the category is only partially in memory, delete only the ones explicitly marked for deletion
				updates.push({
					deleteMany: {
						filter: {
							category: this.#getFullCategoryName(category),
							localId: { $in: idsToDelete },
						},
					},
				})
			}

			// Update each notification
			if (notificationsForCategory) {
				for (const notification of notificationsForCategory.values()) {
					if (!notification) continue

					updates.push({
						replaceOne: {
							filter: {
								category: this.#getFullCategoryName(category),
								localId: notification.localId,
							},
							replacement: {
								...notification,
								created: notification.created || getCurrentTime(), // nocommit - preserve created time from db?
								modified: getCurrentTime(),
							},
							upsert: true,
						},
					})
				}
			}
		}

		if (updates.length > 0) {
			await this.#context.directCollections.Notifications.bulkWrite(updates)
		}
	}
}
