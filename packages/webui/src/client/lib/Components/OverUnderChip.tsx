import React, { type CSSProperties } from 'react'
import classNames from 'classnames'
import { RundownUtils } from '../rundown.js'
import './OverUnderChip.scss'

export type OverUnderChipFormat = 'playlistDiff' | 'timerPostfix'

export interface IOverUnderChipProps {
	valueMs: number
	format?: OverUnderChipFormat
	className?: string
	style?: CSSProperties
}

export function OverUnderChip({
	valueMs,
	format = 'playlistDiff',
	className,
	style,
}: Readonly<IOverUnderChipProps>): JSX.Element {
	const isUnder = valueMs <= 0
	const timeStr =
		format === 'timerPostfix'
			? RundownUtils.formatDiffToTimecode(Math.abs(valueMs), false, false, true, false, true)
			: RundownUtils.formatDiffToTimecode(Math.abs(valueMs), false, false, true, true, true)

	return (
		<span
			className={classNames('over-under-chip', isUnder ? 'over-under-chip--under' : 'over-under-chip--over', className)}
			style={style}
		>
			{isUnder ? '−' : '+'}
			{timeStr}
		</span>
	)
}

