import React, { PropsWithChildren } from 'react'
import _ from 'underscore'
import Velocity from 'velocity-animate'
import ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Route } from 'react-router-dom'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { parse as queryStringParse } from 'query-string'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { firstIfArray, literal, protectString } from '../../../lib/lib'
import { PrompterData, PrompterAPI, PrompterDataPart } from './prompter'
import { PrompterControlManager } from './controller/manager'
import { PubSub } from '../../../lib/api/pubsub'
import { documentTitle } from '../../lib/DocumentTitleProvider'
import { StudioScreenSaver } from '../StudioScreenSaver/StudioScreenSaver'
import { RundownTimingProvider } from '../RundownView/RundownTiming/RundownTimingProvider'
import { OverUnderTimer } from './OverUnderTimer'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PartInstanceId, PieceId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIStudios } from '../Collections'
import { UIStudio } from '../../../lib/api/studios'
import { RundownPlaylists, Rundowns } from '../../collections'
import { RundownPlaylistCollectionUtil } from '../../../lib/collections/rundownPlaylistUtil'
import { logger } from '../../../lib/logging'

const DEFAULT_UPDATE_THROTTLE = 250 //ms
const PIECE_MISSING_UPDATE_THROTTLE = 2000 //ms

interface PrompterConfig {
	mirror?: boolean
	mirrorv?: boolean
	mode?: Array<PrompterConfigMode | string | undefined>
	controlMode?: string
	followTake?: boolean
	fontSize?: number
	margin?: number
	joycon_invertJoystick: boolean
	joycon_speedMap?: number[]
	joycon_reverseSpeedMap?: number[]
	joycon_rangeRevMin?: number
	joycon_rangeNeutralMin?: number
	joycon_rangeNeutralMax?: number
	joycon_rangeFwdMax?: number
	pedal_speedMap?: number[]
	pedal_reverseSpeedMap?: number[]
	pedal_rangeRevMin?: number
	pedal_rangeNeutralMin?: number
	pedal_rangeNeutralMax?: number
	pedal_rangeFwdMax?: number
	shuttle_speedMap?: number[]
	marker?: 'center' | 'top' | 'bottom' | 'hide'
	showMarker: boolean
	showScroll: boolean
	debug: boolean
	showOverUnder: boolean
	addBlankLine: boolean
}

export enum PrompterConfigMode {
	MOUSE = 'mouse',
	KEYBOARD = 'keyboard',
	SHUTTLEKEYBOARD = 'shuttlekeyboard',
	JOYCON = 'joycon',
	PEDAL = 'pedal',
}

export interface IPrompterControllerState {
	source: PrompterConfigMode
	lastEvent: string
	lastSpeed: number
}

interface IProps {
	studioId: StudioId
}

interface ITrackedProps {
	rundownPlaylist?: RundownPlaylist
	studio?: UIStudio
}

interface IState {
	subsReady: boolean
}

function asArray<T>(value: T | T[] | null): T[] {
	if (Array.isArray(value)) {
		return value
	} else if (value) {
		return [value]
	} else {
		return []
	}
}

export class PrompterViewInner extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	autoScrollPreviousPartInstanceId: PartInstanceId | null = null

	configOptions: PrompterConfig

	// @ts-expect-error The manager inspects this instance
	private _controller: PrompterControlManager

	private checkWindowScroll: number | null = null

	constructor(props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			subsReady: false,
		}
		// Disable the context menu:
		document.addEventListener('contextmenu', (e) => {
			e.preventDefault()
		})

		const queryParams = queryStringParse(location.search, {
			arrayFormat: 'comma',
		})

		this.configOptions = {
			mirror: firstIfArray(queryParams['mirror']) === '1',
			mirrorv: firstIfArray(queryParams['mirrorv']) === '1',
			mode: asArray(queryParams['mode']),
			controlMode: firstIfArray(queryParams['controlmode']) || undefined,
			followTake: queryParams['followtake'] === undefined ? true : queryParams['followtake'] === '1',
			fontSize: parseInt(firstIfArray(queryParams['fontsize']) as string, 10) || undefined,
			margin: parseInt(firstIfArray(queryParams['margin']) as string, 10) || undefined,
			joycon_invertJoystick:
				queryParams['joycon_invertJoystick'] === undefined ? true : queryParams['joycon_invertJoystick'] === '1',
			joycon_speedMap:
				queryParams['joycon_speedMap'] === undefined
					? undefined
					: asArray(queryParams['joycon_speedMap']).map((value) => parseInt(value, 10)),
			joycon_reverseSpeedMap:
				queryParams['joycon_reverseSpeedMap'] === undefined
					? undefined
					: asArray(queryParams['joycon_reverseSpeedMap']).map((value) => parseInt(value, 10)),
			joycon_rangeRevMin: parseInt(firstIfArray(queryParams['joycon_rangeRevMin']) as string, 10) || undefined,
			joycon_rangeNeutralMin: parseInt(firstIfArray(queryParams['joycon_rangeNeutralMin']) as string, 10) || undefined,
			joycon_rangeNeutralMax: parseInt(firstIfArray(queryParams['joycon_rangeNeutralMax']) as string, 10) || undefined,
			joycon_rangeFwdMax: parseInt(firstIfArray(queryParams['joycon_rangeFwdMax']) as string, 10) || undefined,
			pedal_speedMap:
				queryParams['pedal_speedMap'] === undefined
					? undefined
					: asArray(queryParams['pedal_speedMap']).map((value) => parseInt(value, 10)),
			pedal_reverseSpeedMap:
				queryParams['pedal_reverseSpeedMap'] === undefined
					? undefined
					: asArray(queryParams['pedal_reverseSpeedMap']).map((value) => parseInt(value, 10)),
			pedal_rangeRevMin: parseInt(firstIfArray(queryParams['pedal_rangeRevMin']) as string, 10) || undefined,
			pedal_rangeNeutralMin: parseInt(firstIfArray(queryParams['pedal_rangeNeutralMin']) as string, 10) || undefined,
			pedal_rangeNeutralMax: parseInt(firstIfArray(queryParams['pedal_rangeNeutralMax']) as string, 10) || undefined,
			pedal_rangeFwdMax: parseInt(firstIfArray(queryParams['pedal_rangeFwdMax']) as string, 10) || undefined,
			marker: (firstIfArray(queryParams['marker']) as any) || undefined,
			showMarker: queryParams['showmarker'] === undefined ? true : queryParams['showmarker'] === '1',
			showScroll: queryParams['showscroll'] === undefined ? true : queryParams['showscroll'] === '1',
			debug: queryParams['debug'] === undefined ? false : queryParams['debug'] === '1',
			showOverUnder: queryParams['showoverunder'] === undefined ? true : queryParams['showoverunder'] === '1',
			addBlankLine: queryParams['addblanklinke'] === undefined ? true : queryParams['adblankline'] === '1',
		}

		this._controller = new PrompterControlManager(this)
	}

	DEBUG_controllerSpeed(speed: number): void {
		const speedEl = document.getElementById('prompter-debug-speed')
		if (speedEl) {
			speedEl.textContent = speed + ''
		}
	}

	DEBUG_controllerState(state: IPrompterControllerState): void {
		const debug = document.getElementById('prompter-debug')
		if (debug) {
			debug.textContent = ''

			const debugInfo = document.createElement('div')

			const source = document.createElement('h2')
			source.textContent = state.source

			const lastEvent = document.createElement('div')
			lastEvent.classList.add('lastEvent')
			lastEvent.textContent = state.lastEvent

			const lastSpeed = document.createElement('div')
			lastSpeed.id = 'prompter-debug-speed'
			lastSpeed.classList.add('lastSpeed')
			lastSpeed.textContent = state.lastSpeed + ''

			debugInfo.appendChild(source)
			debugInfo.appendChild(lastEvent)
			debugInfo.appendChild(lastSpeed)
			debug.appendChild(debugInfo)
		}
	}

	componentDidMount(): void {
		if (this.props.studioId) {
			this.subscribe(PubSub.uiStudio, this.props.studioId)

			this.subscribe(PubSub.rundownPlaylists, {
				activationId: { $exists: true },
				studioId: this.props.studioId,
			})
		}

		this.autorun(() => {
			const playlist = RundownPlaylists.findOne(
				{
					studioId: this.props.studioId,
					activationId: { $exists: true },
				},
				{
					fields: {
						_id: 1,
					},
				}
			) as Pick<RundownPlaylist, '_id'> | undefined
			if (playlist?._id) {
				this.subscribe(PubSub.rundowns, [playlist._id], null)
			}
		})

		this.autorun(() => {
			const subsReady = this.subscriptionsReady()
			if (subsReady !== this.state.subsReady) {
				this.setState({
					subsReady: subsReady,
				})
			}
		})

		const themeColor = document.head.querySelector('meta[name="theme-color"]')
		if (themeColor) {
			themeColor.setAttribute('data-content', themeColor.getAttribute('content') || '')
			themeColor.setAttribute('content', '#000000')
		}

		document.body.classList.add(
			'dark',
			'xdark',
			'prompter-scrollbar',
			this.configOptions.showScroll ? 'vertical-overflow-only' : 'no-overflow'
		)
		window.addEventListener('scroll', this.onWindowScroll)

		this.triggerCheckCurrentTakeMarkers()
		this.checkScrollToCurrent()

		this.setDocumentTitle()
	}

	componentWillUnmount(): void {
		super.componentWillUnmount()

		documentTitle.set(null)

		const themeColor = document.head.querySelector('meta[name="theme-color"]')
		if (themeColor) {
			themeColor.setAttribute('content', themeColor.getAttribute('data-content') || '#ffffff')
		}

		document.body.classList.remove(
			'dark',
			'xdark',
			'prompter-scrollbar',
			this.configOptions.showScroll ? 'vertical-overflow-only' : 'no-overflow'
		)
		window.removeEventListener('scroll', this.onWindowScroll)
	}

	componentDidUpdate(): void {
		this.triggerCheckCurrentTakeMarkers()
		this.checkScrollToCurrent()
	}

	private setDocumentTitle() {
		const { t } = this.props

		documentTitle.set(t('Prompter'))
	}

	private checkScrollToCurrent() {
		const playlistId: RundownPlaylistId =
			(this.props.rundownPlaylist && this.props.rundownPlaylist._id) || protectString('')
		const playlist = RundownPlaylists.findOne(playlistId)

		if (!this.configOptions.followTake) return
		if (!playlist) return
		if (playlist.currentPartInfo?.partInstanceId === this.autoScrollPreviousPartInstanceId) return
		this.autoScrollPreviousPartInstanceId = playlist.currentPartInfo?.partInstanceId ?? null
		if (playlist.currentPartInfo === null) return

		this.scrollToPartInstance(playlist.currentPartInfo.partInstanceId)
	}
	private calculateScrollPosition() {
		let pixelMargin = this.calculateMarginPosition()
		switch (this.configOptions.marker) {
			case 'top':
			case 'hide':
				pixelMargin += 0
				break
			case 'center':
				pixelMargin = window.innerHeight / 2
				break
			case 'bottom':
				pixelMargin = window.innerHeight - pixelMargin
				break
		}
		return pixelMargin
	}
	private calculateMarginPosition() {
		// margin in pixels
		return ((this.configOptions.margin || 0) * window.innerHeight) / 100
	}
	scrollToPartInstance(partInstanceId: PartInstanceId): void {
		const scrollMargin = this.calculateScrollPosition()
		const target = document.querySelector(`[data-part-instance-id="${partInstanceId}"]`)

		if (target) {
			Velocity(document.body, 'finish')
			Velocity(target, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToLive(): void {
		const scrollMargin = this.calculateScrollPosition()
		const current = document.querySelector('.prompter .live') || document.querySelector('.prompter .next')

		if (current) {
			Velocity(document.body, 'finish')
			Velocity(current, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToNext(): void {
		const scrollMargin = this.calculateScrollPosition()
		const next = document.querySelector('.prompter .next')

		if (next) {
			Velocity(document.body, 'finish')
			Velocity(next, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToPrevious(): void {
		const scrollMargin = this.calculateScrollPosition()
		const anchors = this.listAnchorPositions(-1, 10 + scrollMargin)

		const target = anchors[anchors.length - 2] || anchors[0]
		if (!target) return

		Velocity(document.body, 'finish')
		Velocity(document.body, 'scroll', {
			offset: window.scrollY - scrollMargin + target[0],
			duration: 200,
			easing: 'ease-out',
		})
	}
	scrollToFollowing(): void {
		const scrollMargin = this.calculateScrollPosition()
		const anchors = this.listAnchorPositions(40 + scrollMargin, -1)

		const target = anchors[0]
		if (!target) return

		Velocity(document.body, 'finish')
		Velocity(document.body, 'scroll', {
			offset: window.scrollY - scrollMargin + target[0],
			duration: 200,
			easing: 'ease-out',
		})
	}
	listAnchorPositions(startY: number, endY: number, sortDirection = 1): [number, Element][] {
		let foundPositions: [number, Element][] = []
		// const anchors = document.querySelectorAll('.prompter .scroll-anchor')

		Array.from(document.querySelectorAll('.prompter .scroll-anchor')).forEach((anchor) => {
			const { top } = anchor.getBoundingClientRect()
			if ((startY === -1 || top > startY) && (endY === -1 || top <= endY)) {
				foundPositions.push([top, anchor])
			}
		})

		foundPositions = _.sortBy(foundPositions, (v) => sortDirection * v[0])

		return foundPositions
	}
	findAnchorPosition(startY: number, endY: number, sortDirection = 1): number | null {
		return (this.listAnchorPositions(startY, endY, sortDirection)[0] || [])[0] || null
	}
	private onWindowScroll = () => {
		this.triggerCheckCurrentTakeMarkers()
	}
	private triggerCheckCurrentTakeMarkers = () => {
		// Rate limit:
		if (!this.checkWindowScroll) {
			this.checkWindowScroll = Meteor.setTimeout(() => {
				this.checkWindowScroll = null

				this.checkCurrentTakeMarkers()
			}, 500)
		}
	}
	private checkCurrentTakeMarkers = () => {
		const playlist = this.props.rundownPlaylist

		if (playlist === undefined) return
		const positionTop = window.scrollY
		const positionBottom = positionTop + window.innerHeight

		let currentPartElement: Element | null = null
		let currentPartElementAfter: Element | null = null
		let nextPartElementAfter: Element | null = null

		const anchors: Array<Element> = Array.from(document.querySelectorAll('.scroll-anchor'))

		for (let index = 0; index < anchors.length; index++) {
			const current = anchors[index]
			const next = index + 1 < anchors.length ? anchors[index + 1] : null

			if (playlist.currentPartInfo && current.classList.contains(`live`)) {
				currentPartElement = current
				currentPartElementAfter = next
			}
			if (playlist.nextPartInfo && current.classList.contains(`next`)) {
				nextPartElementAfter = next
			}
		}

		const currentPositionStart = currentPartElement
			? currentPartElement.getBoundingClientRect().top + positionTop
			: null
		const currentPositionEnd = currentPartElementAfter
			? currentPartElementAfter.getBoundingClientRect().top + positionTop
			: null

		const nextPositionEnd = nextPartElementAfter ? nextPartElementAfter.getBoundingClientRect().top + positionTop : null

		const takeIndicator = document.querySelector('.take-indicator')
		if (takeIndicator) {
			if (currentPositionEnd && currentPositionEnd < positionTop) {
				// Display take "^" indicator
				takeIndicator.classList.remove('hidden')
				takeIndicator.classList.add('top')
			} else if (currentPositionStart && currentPositionStart > positionBottom) {
				// Display take "v" indicator
				takeIndicator.classList.remove('hidden', 'top')
			} else {
				takeIndicator.classList.add('hidden')
			}
		}

		const nextIndicator = document.querySelector('.next-indicator')
		if (nextIndicator) {
			if (nextPositionEnd && nextPositionEnd < positionTop) {
				// Display next "^" indicator
				nextIndicator.classList.remove('hidden')
				nextIndicator.classList.add('top')
			} else {
				nextIndicator.classList.add('hidden')
			}
		}
	}

	private renderMessage(message: string) {
		const { t } = this.props

		return (
			<div className="rundown-view rundown-view--unpublished">
				<div className="rundown-view__label">
					<p>{message}</p>
					<p>
						<Route
							render={({ history }) => (
								<button
									className="btn btn-primary"
									onClick={() => {
										history.push('/rundowns')
									}}
								>
									{t('Return to list')}
								</button>
							)}
						/>
					</p>
				</div>
			</div>
		)
	}

	render(): JSX.Element {
		const { t } = this.props

		const overUnderStyle: React.CSSProperties = {
			marginTop: this.configOptions.margin ? `${this.configOptions.margin}vh` : undefined,
			marginBottom: this.configOptions.margin ? `${this.configOptions.margin}vh` : undefined,
			marginRight: this.configOptions.margin ? `${this.configOptions.margin}vw` : undefined,
			marginLeft: this.configOptions.margin ? `${this.configOptions.margin}vw` : undefined,
			fontSize: (this.configOptions.fontSize ?? 0) > 12 ? `12vmin` : undefined,
		}

		return (
			<React.Fragment>
				{!this.state.subsReady ? (
					<div className="rundown-view rundown-view--loading">
						<Spinner />
					</div>
				) : this.props.rundownPlaylist ? (
					<>
						<RundownTimingProvider playlist={this.props.rundownPlaylist}>
							<Prompter rundownPlaylistId={this.props.rundownPlaylist._id} config={this.configOptions}>
								{this.configOptions.showOverUnder && (
									<OverUnderTimer rundownPlaylist={this.props.rundownPlaylist} style={overUnderStyle} />
								)}
							</Prompter>
						</RundownTimingProvider>
						{this.configOptions.debug ? (
							<div
								id="prompter-debug"
								style={{
									marginTop: this.configOptions.margin ? this.configOptions.margin + 'vh' : undefined,
									marginBottom: this.configOptions.margin ? this.configOptions.margin + 'vh' : undefined,
									marginLeft: this.configOptions.margin ? this.configOptions.margin + 'vw' : undefined,
									marginRight: this.configOptions.margin ? this.configOptions.margin + 'vw' : undefined,
								}}
							></div>
						) : null}
					</>
				) : this.props.studio ? (
					<StudioScreenSaver studioId={this.props.studio._id} />
				) : this.props.studioId ? (
					this.renderMessage(t("This studio doesn't exist."))
				) : (
					this.renderMessage(t('There are no active rundowns.'))
				)}
			</React.Fragment>
		)
	}
}
export const PrompterView = translateWithTracker<IProps, {}, ITrackedProps>(({ studioId }: IProps) => {
	const studio = UIStudios.findOne(studioId)

	const rundownPlaylist = RundownPlaylists.findOne(
		{
			activationId: { $exists: true },
			studioId: studioId,
		},
		{
			projection: {
				trackedAbSessions: 0,
				lastIncorrectPartPlaybackReported: 0,
			},
		}
	) as Omit<RundownPlaylist, 'trackedAbSessions'> | undefined

	return literal<ITrackedProps>({
		rundownPlaylist,
		studio,
	})
})(PrompterViewInner)

interface IPrompterProps {
	rundownPlaylistId: RundownPlaylistId
	config: PrompterConfig
}
interface IPrompterTrackedProps {
	prompterData: PrompterData | null
}

interface ScrollAnchor {
	/** offset to use to scroll the anchor. null means "just scroll the anchor into view, best effort" */
	offset: number | null
	anchorId: string
}
type PrompterSnapshot = ScrollAnchor[] | null

export const Prompter = translateWithTracker<PropsWithChildren<IPrompterProps>, {}, IPrompterTrackedProps>(
	(props: IPrompterProps) => ({
		prompterData: PrompterAPI.getPrompterData(props.rundownPlaylistId),
	}),
	undefined,
	true
)(
	class Prompter extends MeteorReactComponent<
		Translated<PropsWithChildren<IPrompterProps> & IPrompterTrackedProps>,
		{}
	> {
		private _debounceUpdate: NodeJS.Timer

		constructor(props) {
			super(props)
			this.state = {
				subsReady: false,
			}
		}

		componentDidMount(): void {
			this.subscribe(PubSub.rundowns, [this.props.rundownPlaylistId], null)

			this.autorun(() => {
				const playlist = RundownPlaylists.findOne(this.props.rundownPlaylistId, {
					fields: {
						_id: 1,
						activationId: 1,
					},
				}) as Pick<RundownPlaylist, '_id' | 'activationId'> | undefined
				if (playlist) {
					const rundownIDs = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
					this.subscribe(PubSub.segments, {
						rundownId: { $in: rundownIDs },
					})
					this.subscribe(PubSub.parts, rundownIDs)
					this.subscribe(PubSub.partInstances, rundownIDs, playlist.activationId)
					this.subscribe(PubSub.pieces, {
						startRundownId: { $in: rundownIDs },
					})
					this.subscribe(PubSub.pieceInstancesSimple, {
						rundownId: { $in: rundownIDs },
						reset: { $ne: true },
					})
				}
			})

			this.autorun(() => {
				const rundowns = Rundowns.find(
					{ playlistId: this.props.rundownPlaylistId },
					{
						fields: {
							_id: 1,
							showStyleBaseId: 1,
						},
					}
				).fetch() as Pick<Rundown, '_id' | 'showStyleBaseId'>[]
				for (const rundown of rundowns) {
					this.subscribe(PubSub.uiShowStyleBase, rundown.showStyleBaseId)
				}
			})
		}

		private getReadPosition(): number {
			let readPosition = ((this.props.config.margin || 0) / 100) * window.innerHeight
			switch (this.props.config.marker) {
				case 'top':
				case 'hide':
					break
				case 'center':
					readPosition = window.innerHeight / 2
					break
				case 'bottom':
					readPosition = window.innerHeight - readPosition
					break
			}
			return readPosition
		}

		getScrollAnchors = (): ScrollAnchor[] => {
			const readPosition = this.getReadPosition()

			const useableTextAnchors: {
				offset: number
				anchorId: string
			}[] = []
			/** Maps anchorId -> offset */
			const foundScrollAnchors: (ScrollAnchor & {
				/** Positive number. How "good" the anchor is. The anchor with the lowest number will preferred later. */
				distanceToReadPosition: number
			})[] = []

			/*
				In this method, we find anchors in the DOM, so that we (when the content changes)
				can scroll to the same position, keeping the content unchanged, visually.


				We consider the textAnchors to be the best to use (if they are in view), since they
				represent the prompter text - and we want to try to keep that as unchanged as possible.
				If none are to be useable (like if they have been removed during the content change),
				we resort to using the scrollAnchors (Segment and Part names).
			*/

			const windowInnerHeight = window.innerHeight

			// Gather anchors from any text blocks in view:

			for (const textAnchor of document.querySelectorAll('.prompter .prompter-line:not(.empty)')) {
				const { top, bottom } = textAnchor.getBoundingClientRect()

				// Is the text block in view?
				if (top <= readPosition && bottom > readPosition) {
					useableTextAnchors.push({ anchorId: textAnchor.id, offset: top })
				}
			}

			// Also use scroll-anchors (Segment and Part names)

			for (const scrollAnchor of document.querySelectorAll('.prompter .scroll-anchor')) {
				const { top, bottom } = scrollAnchor.getBoundingClientRect()

				const distanceToReadPosition = Math.abs(top - readPosition)

				if (top <= windowInnerHeight && bottom > 0) {
					// If the anchor is in view, use the offset to keep it's position unchanged, relative to the viewport
					foundScrollAnchors.push({ anchorId: scrollAnchor.id, distanceToReadPosition, offset: top })
				} else {
					// If the anchor is not in view, set the offset to null, this will cause the view to
					// jump so that the anchor will be in view.
					foundScrollAnchors.push({ anchorId: scrollAnchor.id, distanceToReadPosition, offset: null })
				}
			}

			// Sort text anchors, topmost first:
			const sortedTextAnchors = useableTextAnchors.sort((a, b) => {
				return a.offset - b.offset
			})

			// Sort, smallest distanceToReadPosition first:
			const sortedScrollAnchors = foundScrollAnchors.sort((a, b) => {
				return a.distanceToReadPosition - b.distanceToReadPosition
			})

			// Prioritize the text anchors, then the scroll anchors:
			return [...sortedTextAnchors, ...sortedScrollAnchors]
		}

		private restoreScrollAnchor = (scrollAnchors: ScrollAnchor[] | null) => {
			if (scrollAnchors === null) return
			if (!scrollAnchors.length) return

			const readPosition = this.getReadPosition()

			// Go through the anchors and use the first one that we find:
			for (const scrollAnchor of scrollAnchors) {
				const anchor = document.getElementById(scrollAnchor.anchorId)
				if (!anchor) continue

				const { top } = anchor.getBoundingClientRect()

				if (scrollAnchor.offset !== null) {
					this.props.config.debug &&
						logger.debug(
							`Selected anchor ${scrollAnchor.anchorId} as anchor element in view, restoring position ${scrollAnchor.offset}`
						)

					window.scrollBy({
						top: top - scrollAnchor.offset,
					})
					// We've scrolled, exit the function!
					return
				} else {
					this.props.config.debug &&
						logger.debug(`Selected anchor ${scrollAnchor.anchorId} as anchor element outside of view, jumping to it`)

					// Note: config.margin does not have to be taken into account here,
					// the css margins magically does it for us.
					window.scrollBy({
						top: top - readPosition,
					})
					// We've scrolled, exit the function!
					return
				}
			}
			// None of the anchors where found at this point.

			logger.error(
				`Read anchor could not be found after update: ${scrollAnchors
					.slice(0, 10)
					.map((sa) => `"${sa.anchorId}" (${sa.offset})`)
					.join(', ')}`
			)

			// TODO: In the past 4 months this has been here, this hasn't logged a single line, should we keep it?
			// Below is for troubleshooting, see if the anchor is in prompterData:
			if (!this.props.prompterData) {
				logger.error(`Read anchor troubleshooting: no prompterData`)
				return
			}

			for (const scrollAnchor of scrollAnchors) {
				for (const segment of this.props.prompterData.segments) {
					if (scrollAnchor.anchorId === `segment_${segment.id}`) {
						logger.error(`Read anchor troubleshooting: segment "${segment.id}" was found in prompterData!`)
						return
					}

					for (const part of segment.parts) {
						if (scrollAnchor.anchorId === `partInstance_${part.id}`) {
							logger.error(`Read anchor troubleshooting: part "${part.id}" was found in prompterData!`)
							return
						}

						for (const piece of part.pieces) {
							if (scrollAnchor.anchorId === `line_${piece.id}`) {
								logger.error(`Read anchor troubleshooting: piece "${piece.id}" was found in prompterData!`)
								return
							}
						}
					}
				}
			}
		}

		shouldComponentUpdate(nextProps: Translated<IPrompterProps & IPrompterTrackedProps>): boolean {
			const { prompterData } = this.props
			const { prompterData: nextPrompterData } = nextProps

			const currentPrompterPieces = _.flatten(
				prompterData?.segments.map((segment) =>
					segment.parts.map((part) =>
						// collect all the PieceId's of all the non-empty pieces of script
						_.compact(part.pieces.map((dataPiece) => (dataPiece.text !== '' ? dataPiece.id : null)))
					)
				) ?? []
			) as PieceId[]
			const nextPrompterPieces = _.flatten(
				nextPrompterData?.segments.map((segment) =>
					segment.parts.map((part) =>
						// collect all the PieceId's of all the non-empty pieces of script
						_.compact(part.pieces.map((dataPiece) => (dataPiece.text !== '' ? dataPiece.id : null)))
					)
				) ?? []
			) as PieceId[]

			// Flag for marking that a Piece is going missing during the update (was present in prompterData
			// no longer present in nextPrompterData)
			let missingPiece = false
			for (const pieceId of currentPrompterPieces) {
				if (!nextPrompterPieces.includes(pieceId)) {
					missingPiece = true
					break
				}
			}

			// Default delay for updating the prompter (for providing stability/batching the updates)
			let delay = DEFAULT_UPDATE_THROTTLE
			// If a Piece has gone missing, delay the update by up to 2 seconds, so that it has a chance to stream in.
			// When the Piece streams in, shouldComponentUpdate will run again, and then, if the piece is available
			// we will use the shorter value and update sooner
			if (missingPiece) delay = PIECE_MISSING_UPDATE_THROTTLE
			clearTimeout(this._debounceUpdate)
			this._debounceUpdate = setTimeout(() => this.forceUpdate(), delay)
			return false
		}

		getSnapshotBeforeUpdate(): PrompterSnapshot {
			return this.getScrollAnchors()
		}

		componentDidUpdate(_prevProps, _prevState, snapshot: PrompterSnapshot) {
			this.restoreScrollAnchor(snapshot)
		}

		private getPartStatus(prompterData: PrompterData, part: PrompterDataPart) {
			if (prompterData.currentPartInstanceId === part.partInstanceId) {
				return 'live'
			} else if (prompterData.nextPartInstanceId === part.partInstanceId) {
				return 'next'
			} else {
				return null
			}
		}

		private renderPrompterData(prompterData: PrompterData) {
			const lines: React.ReactNode[] = []

			prompterData.segments.forEach((segment) => {
				if (segment.parts.length === 0) {
					return
				}

				const firstPart = segment.parts[0]
				const firstPartStatus = this.getPartStatus(prompterData, firstPart)

				lines.push(
					<div
						id={`segment_${segment.id}`}
						data-obj-id={segment.id}
						key={'segment_' + segment.id}
						className={ClassNames('prompter-segment', 'scroll-anchor', firstPartStatus)}
					>
						{segment.title || 'N/A'}
					</div>
				)

				segment.parts.forEach((part) => {
					lines.push(
						<div
							id={`part_${part.id}`}
							data-obj-id={segment.id + '_' + part.id}
							data-part-instance-id={part.partInstanceId}
							key={'part_' + part.id}
							className={ClassNames('prompter-part', 'scroll-anchor', this.getPartStatus(prompterData, part))}
						>
							{part.title || 'N/A'}
						</div>
					)

					part.pieces.forEach((line) => {
						lines.push(
							<div
								id={`line_${line.id}`}
								data-obj-id={segment.id + '_' + part.id + '_' + line.id}
								key={'line_' + part.id + '_' + segment.id + '_' + line.id}
								className={ClassNames(
									'prompter-line',
									this.props.config.addBlankLine ? 'add-blank' : undefined,
									!line.text ? 'empty' : undefined
								)}
							>
								{line.text || ''}
							</div>
						)
					})
				})
			})

			return lines
		}
		render(): JSX.Element {
			const { t } = this.props

			if (this.props.prompterData) {
				return (
					<div
						className={ClassNames(
							'prompter',
							this.props.config.mirror ? 'mirror' : undefined,
							this.props.config.mirrorv ? 'mirrorv' : undefined
						)}
						style={{
							fontSize: this.props.config.fontSize ? this.props.config.fontSize + 'vh' : undefined,
						}}
					>
						{this.props.children}

						<div className="overlay-fix">
							<div
								className={
									'read-marker ' + (!this.props.config.showMarker ? 'hide' : this.props.config.marker || 'hide')
								}
							></div>

							<div
								className="indicators"
								style={{
									marginTop: this.props.config.margin ? `${this.props.config.margin}vh` : undefined,
									marginLeft: this.props.config.margin ? `${this.props.config.margin}vw` : undefined,
									marginRight: this.props.config.margin ? `${this.props.config.margin}vw` : undefined,
									fontSize: (this.props.config.fontSize ?? 0) > 12 ? `12vmin` : undefined,
								}}
							>
								<div className="take-indicator hidden"></div>
								<div className="next-indicator hidden"></div>
							</div>
						</div>

						<div
							className="prompter-display"
							style={{
								paddingLeft: this.props.config.margin ? this.props.config.margin + 'vw' : undefined,
								paddingRight: this.props.config.margin ? this.props.config.margin + 'vw' : undefined,
								paddingTop:
									this.props.config.marker === 'center'
										? '50vh'
										: this.props.config.marker === 'bottom'
										? '100vh'
										: this.props.config.margin
										? this.props.config.margin + 'vh'
										: undefined,
								paddingBottom:
									this.props.config.marker === 'center'
										? '50vh'
										: this.props.config.marker === 'top'
										? '100vh'
										: this.props.config.margin
										? this.props.config.margin + 'vh'
										: undefined,
							}}
						>
							<div className="prompter-break begin">{this.props.prompterData.title}</div>

							{this.renderPrompterData(this.props.prompterData)}

							{this.props.prompterData.segments.length ? (
								<div className="prompter-break end">—{t('End of script')}—</div>
							) : null}
						</div>
					</div>
				)
			} else {
				return (
					<div className="prompter prompter--loading">
						<Spinner />
					</div>
				)
			}
		}
	}
)
