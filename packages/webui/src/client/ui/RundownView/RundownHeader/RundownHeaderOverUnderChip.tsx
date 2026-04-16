import React from 'react'
import classNames from 'classnames'
import { RundownUtils } from '../../../lib/rundown.js'

export type RundownHeaderOverUnderChipVariant = 'default' | 'compact'
export type RundownHeaderOverUnderChipFormat = 'playlistDiff' | 'timerPostfix'

export interface IRundownHeaderOverUnderChipProps {
	valueMs: number
	variant?: RundownHeaderOverUnderChipVariant
	format?: RundownHeaderOverUnderChipFormat
	className?: string
}

export function RundownHeaderOverUnderChip({
	valueMs,
	variant = 'default',
	format = 'playlistDiff',
	className,
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
				`rundown-header__over-under-chip--${variant}`,
				isUnder ? 'rundown-header__over-under-chip--under' : 'rundown-header__over-under-chip--over',
				className
			)}
		>
			{isUnder ? '−' : '+'}
			{timeStr}
		</span>
	)
}

