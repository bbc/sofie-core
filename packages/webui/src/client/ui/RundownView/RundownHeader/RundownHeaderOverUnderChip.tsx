import React, { type CSSProperties } from 'react'
import classNames from 'classnames'
import { RundownUtils } from '../../../lib/rundown.js'

export type RundownHeaderOverUnderChipFormat = 'playlistDiff' | 'timerPostfix'

export interface IRundownHeaderOverUnderChipProps {
	valueMs: number
	format?: RundownHeaderOverUnderChipFormat
	className?: string
	style?: CSSProperties
}

export function RundownHeaderOverUnderChip({
	valueMs,
	format = 'playlistDiff',
	className,
	style,
}: Readonly<IRundownHeaderOverUnderChipProps>): JSX.Element {
	const isUnder = valueMs <= 0
	const timeStr =
		format === 'timerPostfix'
			? RundownUtils.formatDiffToTimecode(Math.abs(valueMs), false, false, true, false, true)
			: RundownUtils.formatDiffToTimecode(Math.abs(valueMs), false, false, true, true, true)

	return (
		<span
			className={classNames(
				'rundown-header__over-under-chip',
				isUnder ? 'rundown-header__over-under-chip--under' : 'rundown-header__over-under-chip--over',
				className
			)}
			style={style}
		>
			{isUnder ? '−' : '+'}
			{timeStr}
		</span>
	)
}

