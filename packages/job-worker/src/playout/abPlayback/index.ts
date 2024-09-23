import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionAssignments, DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { getCurrentTime } from '../../lib'
import { resolveAbAssignmentsFromRequests, SessionRequest } from './abPlaybackResolver'
import { calculateSessionTimeRanges } from './abPlaybackSessions'
import { applyAbPlayerObjectAssignments } from './applyAssignments'
import { AbSessionHelper } from './abSessionHelper'
import { ShowStyleContext } from '../../blueprints/context'
import { logger } from '../../logging'
import { ABPlayerDefinition } from '@sofie-automation/blueprints-integration'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioRouteSet } from '@sofie-automation/shared-lib/dist/core/model/StudioRouteSet'

interface MembersOfRouteSets {
	poolName: string
	playerId: string | number
	disabled: boolean
}

/**
 * Resolve and apply AB-playback for the given timeline
 * @param context Context of the job
 * @param abSessionHelper Helper for generation sessionId
 * @param blueprint Blueprint of the currently playing ShowStyle
 * @param showStyle The currently playing ShowStyle
 * @param playoutModel The current playout model
 * @param resolvedPieces All the PieceInstances on the timeline, resolved to have 'accurate' playback timings
 * @param timelineObjects The current timeline
 * @returns New AB assignments to be persisted on the playlist for the next call
 */
export function applyAbPlaybackForTimeline(
	context: JobContext,
	abSessionHelper: AbSessionHelper,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjects: OnGenerateTimelineObjExt[]
): Record<string, ABSessionAssignments> {
	if (!blueprint.blueprint.getAbResolverConfiguration) return {}

	const blueprintContext = new ShowStyleContext(
		{
			name: playlist.name,
			identifier: `playlistId=${playlist._id},previousPartInstance=${playlist.previousPartInfo?.partInstanceId},currentPartInstance=${playlist.currentPartInfo?.partInstanceId},nextPartInstance=${playlist.nextPartInfo?.partInstanceId}`,
		},
		context.studio,
		context.getStudioBlueprintConfig(),
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle)
	)

	const newAbSessionsResult: Record<string, ABSessionAssignments> = {}

	const span = context.startSpan('blueprint.abPlaybackResolver')
	const influxTrace = startTrace('blueprints:abPlaybackResolver')

	const now = getCurrentTime()

	const abConfiguration = blueprint.blueprint.getAbResolverConfiguration(blueprintContext)
	const routeSetMembers = findPlayersInRouteSets(applyAndValidateOverrides(context.studio.routeSetsWithOverrides).obj)

	for (const [poolName, players] of Object.entries<ABPlayerDefinition[]>(abConfiguration.pools)) {
		// Filter out offline devices
		const filteredPlayers = abPoolFilterDisabled(context, poolName, players, routeSetMembers)

		const previousAssignmentMap: ReadonlyDeep<ABSessionAssignments> | undefined =
			playlist.assignedAbSessions?.[poolName]
		const sessionRequests = calculateSessionTimeRanges(
			abSessionHelper,
			resolvedPieces,
			timelineObjects,
			previousAssignmentMap,
			poolName
		)

		const assignments = resolveAbAssignmentsFromRequests(
			abConfiguration.resolverOptions,
			filteredPlayers.map((player) => player.playerId),
			sessionRequests,
			now
		)

		Object.values<SessionRequest>(assignments.requests).forEach((assignment) => {
			logger.silly(
				`ABPlayback resolved session for "${poolName}" - ${assignment.id}" to player "${assignment.playerId}"`
			)
		})
		if (assignments.failedRequired.length > 0) {
			logger.warn(
				`ABPlayback failed to assign sessions for "${poolName}": ${JSON.stringify(assignments.failedRequired)}`
			)
		}
		if (assignments.failedOptional.length > 0) {
			logger.info(
				`ABPlayback failed to assign optional sessions for "${poolName}": ${JSON.stringify(
					assignments.failedOptional
				)}`
			)
		}

		newAbSessionsResult[poolName] = applyAbPlayerObjectAssignments(
			abSessionHelper,
			blueprintContext,
			abConfiguration,
			timelineObjects,
			previousAssignmentMap,
			assignments.requests,
			poolName
		)
	}

	sendTrace(endTrace(influxTrace))
	if (span) span.end()

	return newAbSessionsResult
}

function findPlayersInRouteSets(routeSets: Record<string, StudioRouteSet>): MembersOfRouteSets[] {
	const players: MembersOfRouteSets[] = []
	for (const [_key, routeSet] of Object.entries<StudioRouteSet>(routeSets)) {
		routeSet.abPlayers.forEach((abPlayer) => {
			players.push({
				playerId: abPlayer.playerId,
				poolName: abPlayer.poolName,
				disabled: !routeSet.active,
			})
		})
	}
	return players
}

function abPoolFilterDisabled(
	context: JobContext,
	poolName: string,
	players: ABPlayerDefinition[],
	membersOfRouteSets: MembersOfRouteSets[]
): ABPlayerDefinition[] {
	if (membersOfRouteSets.length == 0) return players

	// Filter out any disabled players:
	return players.filter((player) => {
		const disabled = membersOfRouteSets.find((abPlayer) => abPlayer.playerId === player.playerId)?.disabled
		if (disabled) {
			logger.info(`${context.studio._id} - AB Pool ${poolName} playerId : ${player.playerId} are disabled`)
			return false
		}
		return true
	})
}
