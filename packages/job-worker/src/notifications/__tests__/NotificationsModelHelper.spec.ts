import { DBNotificationObj, DBNotificationTargetType } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { setupDefaultJobEnvironment } from '../../__mocks__/context'
import { NotificationsModelHelper } from '../NotificationsModelHelper'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { INotificationWithTarget } from '../NotificationsModel'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'
import exp = require('constants')

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
							'relatedTo.studioId': 'mockStudio0',
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
							'relatedTo.studioId': 'mockStudio0',
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
							'relatedTo.studioId': 'mockStudio0',
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
							'relatedTo.studioId': 'mockStudio0',
						},
					],
				},
			])
		})
	})

	describe('created timestamp persisted', () => {
		function runTest(runGetAllNotifications: boolean) {
			it(`loading existing: ${runGetAllNotifications}`, async () => {
				const context = setupDefaultJobEnvironment()
				const notificationsCollection = context.mockCollections.Notifications
				const playlistId = protectString('playlist0')

				const expectedNotificationId = protectString('b8ynzcdIk5RXEAkIHXShWJ26FTQ_') // Taken from a previous run

				await notificationsCollection.insertOne({
					_id: expectedNotificationId,
					category: 'test:my-category',
					created: 12345,
					localId: 'abc',
					message: {
						key: 'test2',
					},
					modified: 6789,
					relatedTo: {
						playlistId: playlistId,
						studioId: context.studioId,
						type: DBNotificationTargetType.PLAYLIST,
					},
					severity: NoteSeverity.WARNING,
				})
				notificationsCollection.clearOpLog()

				{
					const updateHelper = new NotificationsModelHelper(context, 'test', playlistId)

					if (runGetAllNotifications) {
						// eslint-disable-next-line jest/no-conditional-expect
						expect(await updateHelper.getAllNotifications('my-category')).toHaveLength(1)
					}

					updateHelper.setNotification('my-category', {
						id: 'abc',
						message: generateTranslation('test2'),
						severity: NoteSeverity.WARNING,
						relatedTo: { type: 'playlist' },
					})
					await updateHelper.saveAllToDatabase()
					expect(notificationsCollection.operations).toHaveLength(runGetAllNotifications ? 4 : 2)
					notificationsCollection.clearOpLog()
				}

				// Check what was in the db
				expect(await notificationsCollection.findFetch()).toEqual([
					{
						_id: expectedNotificationId,
						category: 'test:my-category',
						created: 12345,
						localId: 'abc',
						message: {
							key: 'test2',
						},
						modified: expect.any(Number),
						relatedTo: {
							playlistId: playlistId,
							studioId: context.studioId,
							type: DBNotificationTargetType.PLAYLIST,
						},
						severity: NoteSeverity.WARNING,
					},
				] satisfies DBNotificationObj[])
			})
		}

		runTest(true)
		// runTest(false) // nocommit - this test is failing
	})

	// TODO - combinations
})
