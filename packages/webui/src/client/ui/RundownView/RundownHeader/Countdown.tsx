import React from 'react'
import Moment from 'react-moment'
import classNames from 'classnames'
import './Countdown.scss'

interface IProps {
	label?: string
	time?: number
	className?: string
	children?: React.ReactNode
}

export function Countdown({ label, time, className, children }: IProps): JSX.Element {
	const valueClassName = time !== undefined ? 'countdown__timeofday' : 'countdown__counter'

	return (
		<span className={classNames('countdown', className)}>
			<span className="countdown__label">{label}</span>
			<span className={valueClassName}>
				{time !== undefined ? <Moment interval={0} format="HH:mm:ss" date={time} /> : children}
			</span>
		</span>
	)
}
