import ClassNames from 'classnames'

export function DashboardButtonTagStrip(props: { layerTypeClassName?: string }): JSX.Element {
	return (
		<div className={ClassNames('dashboard-panel__panel__button__tag-container', props.layerTypeClassName)}>&nbsp;</div>
	)
}
