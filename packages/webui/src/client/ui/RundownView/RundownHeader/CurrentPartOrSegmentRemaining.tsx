import React, { useEffect, useRef } from 'react'
import ClassNames from 'classnames'
import { TimingDataResolution, TimingTickResolution, useTiming } from '../RundownTiming/withTiming.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { SpeechSynthesiser } from '../../../lib/speechSynthesis.js'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

import { Countdown } from './Countdown.js'

const SPEAK_ADVANCE = 500

interface IPartRemainingProps {
	currentPartInstanceId: PartInstanceId | null
	label?: string
	hideOnZero?: boolean
	className?: string
	heavyClassName?: string
	speaking?: boolean
	vibrating?: boolean
	/** Use the segment budget instead of the part duration if available */
	preferSegmentTime?: boolean
}

// global variable for remembering last uttered displayTime
let prevDisplayTime: number | undefined = undefined

function speak(displayTime: number) {
	let text = '' // Say nothing

	switch (displayTime) {
		case -1:
			text = 'One'
			break
		case -2:
			text = 'Two'
			break
		case -3:
			text = 'Three'
			break
		case -4:
			text = 'Four'
			break
		case -5:
			text = 'Five'
			break
		case -6:
			text = 'Six'
			break
		case -7:
			text = 'Seven'
			break
		case -8:
			text = 'Eight'
			break
		case -9:
			text = 'Nine'
			break
		case -10:
			text = 'Ten'
			break
	}

	if (text) {
		SpeechSynthesiser.speak(text, 'countdown')
	}
}

function vibrate(displayTime: number) {
	if ('vibrate' in navigator) {
		switch (displayTime) {
			case 0:
				navigator.vibrate([500])
				break
			case -1:
			case -2:
			case -3:
				navigator.vibrate([250])
				break
		}
	}
}

export const CurrentPartOrSegmentRemaining: React.FC<IPartRemainingProps> = (props) => {
	const timingDurations = useTiming(TimingTickResolution.Synced, TimingDataResolution.Synced)
	const prevPartInstanceId = useRef<PartInstanceId | null>(null)

	useEffect(() => {
		if (props.currentPartInstanceId !== prevPartInstanceId.current) {
			prevDisplayTime = undefined
			prevPartInstanceId.current = props.currentPartInstanceId
		}

		if (!timingDurations?.currentTime) return
		if (timingDurations.currentPartInstanceId !== props.currentPartInstanceId) return

		let displayTime = (timingDurations.remainingTimeOnCurrentPart || 0) * -1

		if (displayTime !== 0) {
			displayTime += SPEAK_ADVANCE
			displayTime = Math.floor(displayTime / 1000)
		}

		if (prevDisplayTime !== displayTime) {
			if (props.speaking) {
				speak(displayTime)
			}

			if (props.vibrating) {
				vibrate(displayTime)
			}

			prevDisplayTime = displayTime
		}
	}, [
		props.currentPartInstanceId,
		timingDurations?.currentTime,
		timingDurations?.currentPartInstanceId,
		timingDurations?.remainingTimeOnCurrentPart,
		props.speaking,
		props.vibrating,
	])

	if (!timingDurations?.currentTime) return null
	if (timingDurations.currentPartInstanceId !== props.currentPartInstanceId) return null

	let displayTimecode = timingDurations.remainingTimeOnCurrentPart
	if (props.preferSegmentTime) {
		displayTimecode = timingDurations.remainingBudgetOnCurrentSegment ?? displayTimecode
	}

	if (displayTimecode === undefined) return null
	displayTimecode *= -1

	return (
		<Countdown
			label={props.label}
			className={ClassNames(props.className, Math.floor(displayTimecode / 1000) > 0 ? props.heavyClassName : undefined)}
		>
			{RundownUtils.formatDiffToTimecode(displayTimecode || 0, true, false, true, false, true, '', false, true)}
		</Countdown>
	)
}
