import {
	TriggersAsyncCollection,
	TriggersContext,
	TriggerTrackerComputation,
} from '@sofie-automation/meteor-lib/dist/triggers/triggersContext'
import { hashSingleUseToken } from '../lib'
import { MeteorCall } from '../meteorApi'
import { IBaseFilterLink } from '@sofie-automation/blueprints-integration'
import { doUserAction } from '../clientUserAction'
import { memoizedIsolatedAutorun } from '../memoizedIsolatedAutorun'
import { Tracker } from 'meteor/tracker'
import {
	AdLibActions,
	AdLibPieces,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,
} from '../../collections'
import { logger } from '../logging'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReactivePlaylistActionContext } from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import { MongoReadOnlyCollection } from '../../collections/lib'
import { ProtectedString } from '../tempLib'

class TriggersCollection2<DBInterface extends { _id: ProtectedString<any> }>
	implements TriggersAsyncCollection<DBInterface>
{
	readonly #collection: MongoReadOnlyCollection<DBInterface>

	constructor(collection: MongoReadOnlyCollection<DBInterface>) {
		this.#collection = collection
	}

	async findFetchAsync(
		computation: TriggerTrackerComputation | null,
		selector: any,
		options?: any
	): Promise<Array<DBInterface>> {
		return Tracker.withComputation(computation as Tracker.Computation | null, async () => {
			return this.#collection.find(selector, options).fetch()
		})
	}

	async findOneAsync(
		computation: TriggerTrackerComputation | null,
		selector: any,
		options?: any
	): Promise<DBInterface | undefined> {
		return Tracker.withComputation(computation as Tracker.Computation | null, async () => {
			return this.#collection.findOne(selector, options)
		})
	}
}

export const UiTriggersContext: TriggersContext = {
	MeteorCall,

	logger,

	isClient: true,

	AdLibActions: new TriggersCollection2(AdLibActions),
	AdLibPieces: new TriggersCollection2(AdLibPieces),
	Parts: new TriggersCollection2(Parts),
	RundownBaselineAdLibActions: new TriggersCollection2(RundownBaselineAdLibActions),
	RundownBaselineAdLibPieces: new TriggersCollection2(RundownBaselineAdLibPieces),
	RundownPlaylists: new TriggersCollection2(RundownPlaylists),
	Rundowns: new TriggersCollection2(Rundowns),
	Segments: new TriggersCollection2(Segments),

	hashSingleUseToken,

	doUserAction,

	withComputation: async (computation, func) => {
		return Tracker.withComputation(computation as Tracker.Computation | null, func)
	},

	memoizedIsolatedAutorun: (computation, fcn, functionName, ...params) => {
		return Tracker.withComputation(computation as Tracker.Computation | null, () => {
			return memoizedIsolatedAutorun(fcn, functionName, ...params)
		})
	},

	async createContextForRundownPlaylistChain(
		_studioId: StudioId,
		_filterChain: IBaseFilterLink[]
	): Promise<ReactivePlaylistActionContext | undefined> {
		// Server only

		throw new Error('Invalid filter combination')
	},
}
