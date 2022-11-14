import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { MongoCursor } from '../../lib/collections/lib'
import { Simplify } from 'type-fest'
import { assertNever } from '../../lib/lib'

/**
 * https://stackoverflow.com/a/66011942
 */
type StringLiteral<T> = T extends `${string & T}` ? T : never

/**
 * https://github.com/sindresorhus/type-fest/issues/417#issuecomment-1178753251
 */
type Not<Yes, Not> = Yes extends Not ? never : Yes

type Link<T> = {
	next: <L extends string, K extends { _id: ProtectedString<any> }>(
		key: Not<L, keyof T>,
		cursorChain: (state: T) => MongoCursor<K> | null
	) => Link<Simplify<T & { [P in StringLiteral<L>]: K }>>

	end: (complete: (state: T | null, nextState?: T) => void) => Meteor.LiveQueryHandle
}

export function observerChain(): {
	next: <L extends string, K extends { _id: ProtectedString<any> }>(
		key: L,
		cursorChain: () => MongoCursor<K> | null
	) => Link<{ [P in StringLiteral<L>]: K }>
} {
	function createNextLink(baseCollectorObject: Record<string, any>, liveQueryHandle: Meteor.LiveQueryHandle) {
		let mode: 'next' | 'end' | undefined
		let chainedCursor: (state: Record<string, any>) => MongoCursor<any> | null
		let completeFunction: (state: Record<string, any> | null, nextState?: Record<string, any>) => void
		let chainedKey: string | undefined = undefined
		let previousObserver: Meteor.LiveQueryHandle | null = null

		let nextChanged: (obj) => void = () => {
			if (mode === 'end') return
			throw new Error('nextChanged: Unfinished observer chain. This is a memory leak.')
		}
		let nextStop: (nextState?) => void = () => {
			if (mode === 'end') return
			throw new Error('nextChanged: Unfinished observer chain. This is a memory leak.')
		}

		function changedLink(collectorObject) {
			if (previousObserver) {
				previousObserver.stop()
				previousObserver = null
			}
			const cursorResult = chainedCursor(collectorObject)
			if (cursorResult === null) {
				console.log('Stopping chain due to a null cursor result')
				nextStop()
				return
			}

			previousObserver = cursorResult.observe({
				added: (doc) => {
					if (!chainedKey) throw new Error('Chained key needs to be defined')
					const newCollectorObject = {
						...collectorObject,
						[chainedKey]: doc,
					}
					nextStop(newCollectorObject)
					nextChanged(newCollectorObject)
				},
				changed: (doc) => {
					if (!chainedKey) throw new Error('Chained key needs to be defined')
					const newCollectorObject = {
						...collectorObject,
						[chainedKey]: doc,
					}
					nextStop(newCollectorObject)
					nextChanged(newCollectorObject)
				},
				removed: () => {
					if (!chainedKey) throw new Error('Chained key needs to be defined')
					nextStop()
				},
			})
		}

		function changedEnd(obj) {
			completeFunction(obj)
		}

		function stopLink(nextState?: any) {
			if (previousObserver) {
				previousObserver.stop()
				previousObserver = null
			}

			nextStop(nextState)
		}

		function stopEnd(nextState?: any) {
			completeFunction(null, nextState)
		}

		return {
			changed: (obj) => {
				switch (mode) {
					case 'next':
						changedLink(obj)
						break
					case 'end':
						changedEnd(obj)
						break
					case undefined:
						throw new Error('changed: mode: undefined, Unfinished observer chain. This is a memory leak.')
					default:
						assertNever(mode)
				}
			},
			stop: (nextObj?) => {
				switch (mode) {
					case 'next':
						stopLink(nextObj)
						break
					case 'end':
						stopEnd(nextObj)
						break
					case undefined:
						break
					default:
						assertNever(mode)
				}
			},
			link: {
				next: (key: string, thisCursor) => {
					if (mode !== undefined) throw new Error('Cannot redefine chain after setup')
					if (!key) throw new Error('Key needs to be a defined, non-empty string')
					chainedKey = key
					chainedCursor = thisCursor
					mode = 'next'
					const { changed, stop, link } = createNextLink(baseCollectorObject, liveQueryHandle)
					nextChanged = changed
					nextStop = stop
					return link
				},
				end: (complete) => {
					if (mode !== undefined) throw new Error('Cannot redefine chain after setup')
					mode = 'end'
					completeFunction = complete
					return liveQueryHandle
				},
			},
		}
	}

	const initialStopObject = {
		stop: () => {
			void 0
		},
	}

	const { changed, stop, link } = createNextLink({}, initialStopObject)
	initialStopObject.stop = stop

	return {
		next: (key, cursorChain) => {
			const nextLink = link.next(key, cursorChain)
			setImmediate(
				Meteor.bindEnvironment(() => {
					changed({})
				})
			)
			return nextLink
		},
	}
}

/* 
observerChain<{
	activePartInstance: PartInstance
	currentRundown: Rundown
	currentShowStyleBase: ShowStyleBase
	triggeredActions: DBTriggeredActions
}>()
	.next('activePartInstance', () => PartInstances.find())
	.next('currentRundown', (state) =>
		state.activePartInstance ? Rundowns.find({ rundownId: state.activePartInstance.rundownId }) : null
	)
	.end((state) => {
		console.log(state)
	})

type Link<T extends object> = {
	next: NextFunction<T, keyof T>
	end: (complete: (state: T) => void) => Meteor.LiveQueryHandle
}
type NextFunction<T extends { [key: string]: any }, L extends keyof T> = (
	key: L,
	cursorChain: (state: Partial<T>) => MongoCursor<T[L]> | null
) => Link<T>

export function observerChain<T extends object>(): {
	next: NextFunction<T, keyof T>
} {
	// const handle = cursor.observe({
	// 	added: (obj: T) => then(obj),
	// 	changed: (obj: T) => then(obj),
	// 	removed: () => then(null),
	// })
	return {
		next: (fnc) => {},
	}
}
*/
