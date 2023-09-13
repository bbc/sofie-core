import React, { useEffect, useRef, useState } from 'react'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { getCurrentTime, systemTime, Time } from '../../lib/lib'
import { logger } from '../../lib/logging'

export { multilineText, isEventInInputField }

function multilineText(txt: string): React.ReactNode {
	return _.map((txt + '').split('\n'), (line: string, i) => {
		return <p key={i}>{line}</p>
	})
}

function isEventInInputField(e: Event): boolean {
	// @ts-expect-error localName
	return e && e.target && ['textarea', 'input'].indexOf(e.target.localName + '') !== -1
}

export function contextMenuHoldToDisplayTime(): number {
	return isTouchDevice() ? 1000 : -1
}

let touchDeviceCache: undefined | boolean = undefined
export function isTouchDevice(): boolean {
	if (touchDeviceCache !== undefined) return touchDeviceCache

	touchDeviceCache = false
	if (window.matchMedia('(any-pointer: coarse)').matches) {
		touchDeviceCache = true
	}
	return touchDeviceCache
}

/**
 * Wrapper around fetch(), which rejects the promise if the result is an error
 */
export function fetchFrom(input: RequestInfo, init?: RequestInit): Promise<Response & { bodyText: string }> {
	return fetch(input, init).then((response) => {
		// Read the body:
		return response.text().then((bodyText: string) => {
			if (response.status !== 200) {
				// If the response is bad, throw the error:
				throw new Error(`${response.status}: ${bodyText || response.statusText || 'Unknown error'}`)
			} else {
				return {
					...response,
					bodyText: bodyText,
				}
			}
		})
	})
}

/**
 * This CSS Variable is used to indicate to the UI that it's being run on a Browser without ordinary pointers
 * but one that emulates mouse-clicks using some other input method (like a Stream Deck).
 */
export const USER_AGENT_POINTER_PROPERTY = '--pointer'
export enum UserAgentPointer {
	NO_POINTER = 'no-pointer',
}

type MutableRef<T> = ((instance: T | null) => void) | React.MutableRefObject<T | null> | null

export function useCombinedRefs<T>(initial: T | null, ...refs: MutableRef<T>[]): React.RefObject<T> {
	const targetRef = useRef<T>(initial)

	useEffect(() => {
		refs.forEach((ref) => {
			if (!ref) return

			if (typeof ref === 'function') {
				ref(targetRef.current)
			} else {
				ref.current = targetRef.current
			}
		})
	}, [refs])

	return targetRef
}

/**
 * A reactive hook that will turn the return value of `func` to a state and re-evaluate `func` on an interval `interval`.
 * `func` returns a Tuple: a value that is the state and the timespan until next re-validation.
 *
 * `func` will be ran synchronously once to get the initial state.
 *
 * Like with any hook, dependencies need to be declared. If the dependencies change, the entire hook is invalidated and the
 * state will start from the initial value.
 *
 * @template K
 * @param {() => [K, number?]} func
 * @param {any[]} [deps] external values `func` depends on. Uses same rules as `useEffect`.
 * @return {K} the current value of the state
 */
export function useInvalidateTimeout<K>(func: () => [K, number], deps: any[]): K | null {
	const [value, setValue] = useState<K | null>(null)
	const invalidateHandle = useRef<number | null>(null)

	useEffect(() => {
		const reevaluate = () => {
			const [newValue, revalidateIn] = func()
			if (revalidateIn > 0) {
				invalidateHandle.current = Meteor.setTimeout(reevaluate, revalidateIn)
			} else {
				invalidateHandle.current = null
			}
			if (!_.isEqual(newValue, value)) {
				setValue(newValue)
			}
		}

		const [mountValue, timeout] = func()
		setValue(mountValue)

		if (timeout > 0) {
			invalidateHandle.current = Meteor.setTimeout(reevaluate, timeout)
		}

		return () => {
			if (invalidateHandle.current !== null) {
				Meteor.clearTimeout(invalidateHandle.current)
				invalidateHandle.current = null
			}
		}
	}, [...deps])

	return value
}

/**
 * Limit the reactivity of a value and wait at least `delay` number of milliseconds before updating
 *
 * @export
 * @template K
 * @param {K} value value to be debounced
 * @param {number} delay how long to wait after an update before updating the state
 * @return {*} debounced value
 */
export function useDebounce<K>(value: K, delay: number): K {
	const [debouncedValue, setDebouncedValue] = useState(value)

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value)
		}, delay)

		return () => {
			clearTimeout(handler)
		}
	}, [value, delay])

	return debouncedValue
}

export function useCurrentTime(refreshPeriod = 1000): number {
	const [time, setTime] = useState(getCurrentTime())

	useEffect(() => {
		const interval = setInterval(() => {
			setTime(getCurrentTime())
		}, refreshPeriod)

		return () => {
			clearInterval(interval)
		}
	}, [refreshPeriod])

	return time
}

export function isRunningInPWA(): boolean {
	if (window.matchMedia('(display-mode: browser)').matches) {
		return false
	}
	return true
}

export function getEventTimestamp(e: Event): Time {
	return e?.timeStamp ? performance.timeOrigin + e.timeStamp + systemTime.timeOriginDiff : getCurrentTime()
}

export function mapOrFallback<T = any, K = any, L = any>(
	array: T[],
	callbackFn: (value: T, index: number, array: T[]) => K,
	fallbackCallbackFn: () => L
): K[] | L {
	if (array.length === 0) return fallbackCallbackFn()

	return array.map(callbackFn)
}

export const TOOLTIP_DEFAULT_DELAY = 0.5

/**
 * Returns a function that logs the error along with the context.
 * @usage Instead of .catch(console.error), do .catch(catchError('myContext'))
 *
 */
export function catchError(context: string): (...errs: any[]) => void {
	return (...errs: any[]) => logger.error(context, ...errs)
}
