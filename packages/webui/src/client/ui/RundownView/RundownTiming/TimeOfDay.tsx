import { useTiming } from './withTiming.js'
import Moment from 'react-moment'
import classNames from 'classnames'

export function TimeOfDay({ className }: { className?: string }): JSX.Element {
	const timingDurations = useTiming()

	return (
		<span className={classNames('timing-clock time-now', className)}>
			<Moment interval={0} format="HH:mm:ss" date={timingDurations.currentTime || 0} />
		</span>
	)
}
