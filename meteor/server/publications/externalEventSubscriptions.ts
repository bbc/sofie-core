import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReadonlyDeep } from 'type-fest'
import {
	CustomPublish,
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../lib/customPublication'
import { logger } from '../logging'
import { RundownPlaylists, Rundowns } from '../collections'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
	RundownExternalEventSubscriptions,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { checkAccessAndGetPeripheralDevice } from '../security/check'
import { check } from '../lib/check'

type RundownPlaylistFields = '_id' | 'activationId'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	activationId: 1,
})

type RundownFields = '_id' | 'playlistId' | 'externalEventSubscriptions'
const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundown, RundownFields>>>({
	_id: 1,
	playlistId: 1,
	externalEventSubscriptions: 1,
})

interface ExternalEventSubscriptionsArgs {
	readonly studioId: StudioId
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExternalEventSubscriptionsState {}

interface ExternalEventSubscriptionsUpdateProps {
	invalidateAll: true
}

async function setupExternalEventSubscriptionsObservers(
	args: ReadonlyDeep<ExternalEventSubscriptionsArgs>,
	triggerUpdate: TriggerUpdate<ExternalEventSubscriptionsUpdateProps>
): Promise<SetupObserversResult> {
	const trigger = () => triggerUpdate({ invalidateAll: true })

	return [
		// Observe active playlists in the studio — activation/deactivation changes which rundowns are in scope
		RundownPlaylists.observeChanges(
			{ studioId: args.studioId },
			{ added: trigger, changed: trigger, removed: trigger },
			{ projection: rundownPlaylistFieldSpecifier }
		),
		// Observe rundowns in the studio — react only when externalEventSubscriptions or playlistId changes
		Rundowns.observeChanges(
			{ studioId: args.studioId },
			{ added: trigger, changed: trigger, removed: trigger },
			{ projection: rundownFieldSpecifier }
		),
	]
}

async function manipulateExternalEventSubscriptionsData(
	args: ReadonlyDeep<ExternalEventSubscriptionsArgs>,
	_state: Partial<ExternalEventSubscriptionsState>,
	collection: CustomPublishCollection<RundownExternalEventSubscriptions>,
	_updateProps: Partial<ReadonlyDeep<ExternalEventSubscriptionsUpdateProps>> | undefined
): Promise<void> {
	// Find all active playlists in the studio
	const activePlaylists = (await RundownPlaylists.findFetchAsync(
		{ studioId: args.studioId, activationId: { $exists: true } },
		{ projection: rundownPlaylistFieldSpecifier }
	)) as Pick<DBRundownPlaylist, RundownPlaylistFields>[]
	const activePlaylistIds = activePlaylists.map((p) => p._id)

	// Find rundowns belonging to active playlists
	const activeRundowns = (await Rundowns.findFetchAsync(
		{ studioId: args.studioId, playlistId: { $in: activePlaylistIds } },
		{ projection: rundownFieldSpecifier }
	)) as Pick<DBRundown, RundownFields>[]

	const activeRundownIds = new Set(activeRundowns.map((r) => r._id))

	// Remove docs for rundowns that are no longer active
	collection.remove((doc) => !activeRundownIds.has(doc._id))

	// Upsert docs for currently active rundowns that have subscriptions
	for (const rundown of activeRundowns) {
		const subscriptions = rundown.externalEventSubscriptions
		if (subscriptions && subscriptions.length > 0) {
			collection.replace({ _id: rundown._id, externalEventSubscriptions: subscriptions })
		} else {
			collection.remove(rundown._id)
		}
	}
}

async function startOrJoinExternalEventSubscriptionsPublication(
	pub: CustomPublish<RundownExternalEventSubscriptions>,
	studioId: StudioId
) {
	await setUpCollectionOptimizedObserver<
		RundownExternalEventSubscriptions,
		ExternalEventSubscriptionsArgs,
		ExternalEventSubscriptionsState,
		ExternalEventSubscriptionsUpdateProps
	>(
		`pub_${PeripheralDevicePubSub.externalEventSubscriptionsForDevice}_${studioId}`,
		{ studioId },
		setupExternalEventSubscriptionsObservers,
		manipulateExternalEventSubscriptionsData,
		pub,
		100
	)
}

meteorCustomPublish(
	PeripheralDevicePubSub.externalEventSubscriptionsForDevice,
	PeripheralDevicePubSubCollectionsNames.rundownExternalEventSubscriptions,
	async function (
		pub: CustomPublish<RundownExternalEventSubscriptions>,
		deviceId: PeripheralDeviceId,
		token: string | undefined
	) {
		check(deviceId, String)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) {
			logger.warn(
				`Publication ${PeripheralDevicePubSub.externalEventSubscriptionsForDevice}: device ${deviceId} has no studio`
			)
			return
		}

		await startOrJoinExternalEventSubscriptionsPublication(pub, studioId)
	}
)
