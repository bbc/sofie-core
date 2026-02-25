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
	return (
		<span className={classNames('countdown', className)}>
			{label && <span className="countdown__label">{label}</span>}
			<span className="countdown__value">
				{time !== undefined ? <Moment interval={0} format="HH:mm:ss" date={time} /> : children}
			</span>
		</span>
	)
}
