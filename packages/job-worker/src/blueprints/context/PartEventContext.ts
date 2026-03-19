import { IBlueprintPartInstance, IPartEventContext } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getCurrentTime } from '../../lib/index.js'
import { ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config.js'
import { JobContext, JobStudio, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { convertPartInstanceToBlueprints } from './lib.js'
import { RundownContext } from './RundownContext.js'
import { TTimersService } from './services/TTimersService.js'
import { PlayoutModel } from '../../playout/model/PlayoutModel.js'
import { IPlaylistTTimer } from '@sofie-automation/blueprints-integration/dist/context/tTimersContext.js'
import { RundownTTimerIndex } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist.js'

export class PartEventContext extends RundownContext implements IPartEventContext {
	readonly #tTimersService: TTimersService

	readonly part: Readonly<IBlueprintPartInstance>

	constructor(
		readonly context: JobContext,
		readonly playoutModel: PlayoutModel,
		eventName: string,
		studio: ReadonlyDeep<JobStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>,
		partInstance: ReadonlyDeep<DBPartInstance>
	) {
		super(
			{
				name: `Event: ${eventName}`,
				identifier: `rundownId=${rundown._id},blueprintId=${showStyleCompound.blueprintId}`,
			},
			studio,
			studioBlueprintConfig,
			showStyleCompound,
			showStyleBlueprintConfig,
			rundown
		)

		this.part = convertPartInstanceToBlueprints(partInstance)
		this.#tTimersService = TTimersService.withPlayoutModel(playoutModel, context)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	getTimer(index: RundownTTimerIndex): IPlaylistTTimer {
		return this.#tTimersService.getTimer(index)
	}
	clearAllTimers(): void {
		return this.#tTimersService.clearAllTimers()
	}
}
