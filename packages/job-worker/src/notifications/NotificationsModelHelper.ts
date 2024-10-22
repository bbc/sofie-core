import { getCurrentTime } from '../lib'
import type { JobContext } from '../jobs'
import type { INotificationsModel, INotificationTarget, INotificationWithTarget } from './NotificationsModel'
import {
	DBNotificationTarget,
	DBNotificationTargetType,
	type DBNotificationObj,
} from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { getHash } from '@sofie-automation/corelib/dist/hash'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { assertNever, flatten, type Complete } from '@sofie-automation/corelib/dist/lib'
import { type AnyBulkWriteOperation } from 'mongodb'
import { StudioId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface NotificationsLoadState {
	hasBeenLoaded: boolean
	hasBeenCleared: boolean

	// dbNotifications: ReadonlyMap<string, DBNotificationObj> | null
	notifications: Map<string, DBNotificationObj | null>
	createdTimestamps: Map<string, number>
}

export class NotificationsModelHelper implements INotificationsModel {
	readonly #context: JobContext
	readonly #categoryPrefix: string
	readonly #playlistId: RundownPlaylistId | null

	readonly #notificationsByCategory = new Map<string, NotificationsLoadState>()

	constructor(context: JobContext, categoryPrefix: string, playlistId: RundownPlaylistId | null) {
		this.#context = context
		this.#categoryPrefix = categoryPrefix
		this.#playlistId = playlistId
	}

	#getFullCategoryName(category: string): string {
		return `${this.#categoryPrefix}:${category}`
	}

	async getAllNotifications(category: string): Promise<INotificationWithTarget[]> {
		const notificationsForCategory = this.#getOrCategoryEntry(category)

		if (!notificationsForCategory.hasBeenLoaded && !notificationsForCategory.hasBeenCleared) {
			const dbNotifications = await this.#context.directCollections.Notifications.findFetch({
				// Ensure notifiations are owned by the current studio
				'relatedTo.studioId': this.#context.studioId,
				// Limit to the current category
				category: this.#getFullCategoryName(category),
			})

			// Interleave into the store, for any which haven't already been updated
			for (const dbNotification of dbNotifications) {
				notificationsForCategory.createdTimestamps.set(dbNotification.localId, dbNotification.created)

				if (!notificationsForCategory.notifications.has(dbNotification.localId)) {
					notificationsForCategory.notifications.set(dbNotification.localId, dbNotification)
				} else {
					// Preserve the created time from the db
					const existingNotification = notificationsForCategory.notifications.get(dbNotification.localId)
					if (existingNotification) {
						existingNotification.created = dbNotification.created
					}
				}
			}

			// Indicate that this is now fully loaded in memory
			notificationsForCategory.hasBeenLoaded = true
		}

		return Array.from(notificationsForCategory.notifications.values())
			.map((notification) => {
				const relatedTo = notification && translateRelatedToFromDbType(notification.relatedTo)
				if (!relatedTo) return null

				return {
					id: notification.localId,
					severity: notification.severity,
					message: notification.message,
					relatedTo: relatedTo,
				}
			})
			.filter((n): n is INotificationWithTarget => !!n)
	}

	clearNotification(category: string, notificationId: string): void {
		const notificationsForCategory = this.#getOrCategoryEntry(category)

		// The notification may or may not be loaded, but this indicates that to the saving that we intend to delete it
		notificationsForCategory.notifications.set(notificationId, null)
	}

	setNotification(category: string, notification: INotificationWithTarget): void {
		const notificationsForCategory = this.#getOrCategoryEntry(category)

		const existingNotification = notificationsForCategory.notifications.get(notification.id)

		const fullCategory = this.#getFullCategoryName(category)
		notificationsForCategory.notifications.set(notification.id, {
			_id: protectString(getHash(`${this.#context.studioId}:${fullCategory}:${notification.id}`)),
			category: fullCategory,
			localId: notification.id,
			severity: notification.severity,
			message: notification.message,
			relatedTo: translateRelatedToIntoDbType(this.#context.studioId, this.#playlistId, notification.relatedTo),
			created: existingNotification?.created || 0, // 0 will be filled in when saving
			modified: 0, // Filled in when saving
		} satisfies Complete<DBNotificationObj>)
	}

	clearAllNotifications(category: string): void {
		const notificationsForCategory = this.#getOrCategoryEntry(category)

		// Tell this store that the category is loaded, and so should perform a full write to the db
		// notificationsForCategory.hasBeenLoaded = true
		notificationsForCategory.hasBeenCleared = true

		// Clear any known in memory notifications
		notificationsForCategory.notifications.clear()
	}

	#getOrCategoryEntry(category: string): NotificationsLoadState {
		let notificationsForCategory = this.#notificationsByCategory.get(category)
		if (!notificationsForCategory) {
			notificationsForCategory = {
				hasBeenLoaded: false,
				hasBeenCleared: false,
				notifications: new Map(),
				createdTimestamps: new Map(),
			}
			this.#notificationsByCategory.set(category, notificationsForCategory)
		}
		return notificationsForCategory
	}

	async saveAllToDatabase(): Promise<void> {
		// Quick return if there is nothing to save
		if (this.#notificationsByCategory.size === 0) return

		const allUpdates = flatten(
			await Promise.all(
				Array.from(this.#notificationsByCategory).map(async ([category, notificationsForCategory]) => {
					const updates: AnyBulkWriteOperation<DBNotificationObj>[] = []

					const idsToDelete: string[] = []
					const idsToUpdate: string[] = []
					const idsToFetchCreatedTime: string[] = []
					for (const [id, notification] of notificationsForCategory.notifications) {
						if (notification) {
							idsToUpdate.push(id)

							if (
								!notificationsForCategory.hasBeenLoaded &&
								!notificationsForCategory.createdTimestamps.has(id)
							)
								idsToFetchCreatedTime.push(id)
						} else {
							idsToDelete.push(id)
						}
					}

					// If the category is fully in memory, we want to delete everything except those being updated
					if (notificationsForCategory.hasBeenLoaded) {
						updates.push({
							deleteMany: {
								filter: {
									category: this.#getFullCategoryName(category),
									localId: { $nin: idsToUpdate },
									'relatedTo.studioId': this.#context.studioId,
								},
							},
						})
					} else if (idsToDelete.length > 0) {
						// If the category is only partially in memory, delete only the ones explicitly marked for deletion
						updates.push({
							deleteMany: {
								filter: {
									category: this.#getFullCategoryName(category),
									localId: { $in: idsToDelete },
									'relatedTo.studioId': this.#context.studioId,
								},
							},
						})
					}

					// Fetch current created timestamps for notifications that are being updated
					const dbNotificationsToPreserveTimestamps =
						idsToFetchCreatedTime.length > 0
							? ((await this.#context.directCollections.Notifications.findFetch(
									{
										category: this.#getFullCategoryName(category),
										localId: { $in: idsToFetchCreatedTime },
										'relatedTo.studioId': this.#context.studioId,
									},
									{
										projection: {
											localId: 1,
											created: 1,
										},
									}
							  )) as Pick<DBNotificationObj, 'localId' | 'created'>[])
							: []
					const dbNotificationCreatedMap = new Map<string, number>()
					for (const notification of dbNotificationsToPreserveTimestamps) {
						dbNotificationCreatedMap.set(notification.localId, notification.created)
					}

					// Update each notification
					for (const notification of notificationsForCategory.notifications.values()) {
						if (!notification) continue

						updates.push({
							replaceOne: {
								filter: {
									category: this.#getFullCategoryName(category),
									localId: notification.localId,
									'relatedTo.studioId': this.#context.studioId,
								},
								replacement: {
									...notification,
									created:
										notification.created ||
										notificationsForCategory.createdTimestamps.get(notification.localId) ||
										dbNotificationCreatedMap.get(notification.localId) ||
										getCurrentTime(), // nocommit - preserve created time from db?
									modified: getCurrentTime(),
								},
								upsert: true,
							},
						})
					}

					return updates
				})
			)
		)

		if (allUpdates.length > 0) {
			await this.#context.directCollections.Notifications.bulkWrite(allUpdates)
		}
	}
}

function translateRelatedToIntoDbType(
	studioId: StudioId,
	playlistId: RundownPlaylistId | null,
	relatedTo: INotificationTarget
): DBNotificationTarget {
	switch (relatedTo.type) {
		case 'playlist':
			if (!playlistId) throw new Error('Cannot create a playlist related notification without a playlist')
			return { type: DBNotificationTargetType.PLAYLIST, studioId, playlistId }
		case 'rundown':
			return {
				type: DBNotificationTargetType.RUNDOWN,
				studioId,
				rundownId: relatedTo.rundownId,
			}
		case 'partInstance':
			return {
				type: DBNotificationTargetType.PARTINSTANCE,
				studioId,
				rundownId: relatedTo.rundownId,
				partInstanceId: relatedTo.partInstanceId,
			}
		case 'pieceInstance':
			return {
				type: DBNotificationTargetType.PIECEINSTANCE,
				studioId,
				rundownId: relatedTo.rundownId,
				partInstanceId: relatedTo.partInstanceId,
				pieceInstanceId: relatedTo.pieceInstanceId,
			}
		default:
			assertNever(relatedTo)
			throw new Error(`Unknown relatedTo type: ${relatedTo}`)
	}
}

function translateRelatedToFromDbType(relatedTo: DBNotificationTarget): INotificationTarget | null {
	switch (relatedTo.type) {
		case DBNotificationTargetType.PLAYLIST:
			return { type: 'playlist' }
		case DBNotificationTargetType.RUNDOWN:
			return {
				type: 'rundown',
				rundownId: relatedTo.rundownId,
			}
		case DBNotificationTargetType.PARTINSTANCE:
			return {
				type: 'partInstance',
				rundownId: relatedTo.rundownId,
				partInstanceId: relatedTo.partInstanceId,
			}
		case DBNotificationTargetType.PIECEINSTANCE:
			return {
				type: 'pieceInstance',
				rundownId: relatedTo.rundownId,
				partInstanceId: relatedTo.partInstanceId,
				pieceInstanceId: relatedTo.pieceInstanceId,
			}
		// case DBNotificationTargetType.EVERYWHERE:
		// case DBNotificationTargetType.STUDIO:
		// case DBNotificationTargetType.SEGMENT:
		// case DBNotificationTargetType.PART:
		// case DBNotificationTargetType.PIECE:
		// return null
		default:
			assertNever(relatedTo)
			return null
	}
}
