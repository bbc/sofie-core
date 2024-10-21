import { DBNotificationTargetType } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { setupDefaultJobEnvironment } from '../../__mocks__/context'
import { NotificationsModelHelper } from '../NotificationsModelHelper'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { INotificationWithTarget } from '../NotificationsModel'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'

describe('NotificationsModelHelper', () => {
	it('no changes has no mongo write', async () => {
		const context = setupDefaultJobEnvironment()
		const notificationsCollection = context.mockCollections.Notifications

		const helper = new NotificationsModelHelper(context, 'test', null)
		expect(notificationsCollection.operations).toHaveLength(0)

		await helper.saveAllToDatabase()
		expect(notificationsCollection.operations).toHaveLength(0)
	})

	describe('from empty', () => {
		it('do nothing', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', null)

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toHaveLength(0)
		})

		it('clearNotification', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', null)

			helper.clearNotification('my-category', 'id0')

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'bulkWrite',
					args: [1],
				},
				{
					type: 'remove',
					args: [
						{
							category: 'test:my-category',
							localId: { $in: ['id0'] },
						},
					],
				},
			])
		})

		it('getAllNotifications - empty db', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', null)

			const notifications = await helper.getAllNotifications('my-category')
			expect(notifications).toHaveLength(0)

			expect(notificationsCollection.operations).toEqual([
				{
					type: 'findFetch',
					args: [
						{
							category: 'test:my-category',
							'relatedTo.studioId': context.studioId,
						},
					],
				},
			])

			// Save performs some cleanup
			notificationsCollection.clearOpLog()
			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'bulkWrite',
					args: [1],
				},
				{
					type: 'remove',
					args: [
						{
							category: 'test:my-category',
							localId: { $nin: [] },
						},
					],
				},
			])
		})

		it('getAllNotifications - with documents', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			await notificationsCollection.insertOne({
				_id: protectString('id0'),
				category: 'test:my-category',
				relatedTo: {
					type: DBNotificationTargetType.PLAYLIST,
					studioId: context.studioId,
					playlistId: protectString('test'),
				},
				created: 1,
				modified: 2,
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				localId: 'abc',
			})
			notificationsCollection.clearOpLog()

			const helper = new NotificationsModelHelper(context, 'test', null)

			const notifications = await helper.getAllNotifications('my-category')
			expect(notifications).toEqual([
				{
					id: 'abc',
					message: generateTranslation('test'),
					severity: NoteSeverity.INFO,
					relatedTo: { type: 'playlist' },
				} satisfies INotificationWithTarget,
			])

			expect(notificationsCollection.operations).toEqual([
				{
					type: 'findFetch',
					args: [
						{
							category: 'test:my-category',
							'relatedTo.studioId': context.studioId,
						},
					],
				},
			])

			// Save performs some cleanup
			notificationsCollection.clearOpLog()
			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'bulkWrite',
					args: [2],
				},
				{
					type: 'remove',
					args: [
						{
							category: 'test:my-category',
							localId: { $nin: ['abc'] },
						},
					],
				},
				{
					type: 'replace',
					args: ['id0'],
				},
			])
		})

		it('setNotification', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', protectString('playlist0'))

			helper.setNotification('my-category', {
				id: 'abc',
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				relatedTo: { type: 'playlist' },
			})

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'bulkWrite',
					args: [1],
				},
				{
					type: 'replace',
					args: ['b8ynzcdIk5RXEAkIHXShWJ26FTQ_'],
				},
			])
		})

		it('clearAllNotifications', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', null)

			helper.clearAllNotifications('my-category')

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'bulkWrite',
					args: [1],
				},
				{
					type: 'remove',
					args: [
						{
							category: 'test:my-category',
							localId: { $nin: [] },
						},
					],
				},
			])
		})
	})

	// TODO - combinations
})
