import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated } from '../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { translate } from 'react-i18next'

import {
	Route,
	Switch,
	Redirect,
	Link,
	NavLink
} from 'react-router-dom'
import SystemStatus from './Status/SystemStatus'
import { ExternalMessages } from './Status/ExternalMessages'
import { UserActivity } from './Status/UserActivity'
import { SnapshotView } from './Status/Snapshot'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'

class WelcomeToStatus extends React.Component {
	render () {
		return (<div></div>)
	}
}
interface IStatusMenuProps {
	match?: any
}
interface IStatusMenuState {
}
const StatusMenu = translate()(class StatusMenu extends React.Component<Translated<IStatusMenuProps>, IStatusMenuState> {

	render () {
		const { t } = this.props

		return (
			<div className='tight-xs htight-xs text-s'>
				<NavLink
					activeClassName='selectable-selected'
					className='status-menu__status-menu-item selectable clickable'
					to={'/status/system'}>
					<h3>{t('System')}</h3>
				</NavLink>
				<NavLink
					activeClassName='selectable-selected'
					className='status-menu__status-menu-item selectable clickable'
					to={'/status/snapshot'}>
					<h3>{t('Snapshot')}</h3>
				</NavLink>
				<NavLink
					activeClassName='selectable-selected'
					className='status-menu__status-menu-item selectable clickable'
					to={'/status/messages'}>
					<h3>{t('Messages')}</h3>
				</NavLink>
				<NavLink
					activeClassName='selectable-selected'
					className='status-menu__status-menu-item selectable clickable'
					to={'/status/userLog'}>
					<h3>{t('User Log')}</h3>
				</NavLink>
			</div>
		)
	}
})

interface IStatusProps {
	match?: any
}
class Status extends MeteorReactComponent<Translated<IStatusProps>> {
	componentWillMount () {
		// Subscribe to data:

		this.subscribe('peripheralDevices', {})
		this.subscribe('studioInstallations', {})
		this.subscribe('showStyles', {})
		// this.subscribe('runtimeFunctions', {})
	}
	render () {
		const { t } = this.props

		return (
			<div className='mtl gutter'>
				{ /* <header className='mvs'>
					<h1>{t('Status')}</h1>
				</header> */ }
				<div className='mod mvl mhs'>
					<div className='row'>
						<div className='col c12 rm-c1 status-menu'>
							<StatusMenu match={this.props.match} />
						</div>
						<div className='col c12 rm-c11 status-dialog'>
							<Switch>
								{/* <Route path='/status' exact component={WelcomeToStatus} /> */}
								<Route path='/status/messages' component={ExternalMessages} />
								<Route path='/status/system' component={SystemStatus} />
								<Route path='/status/userLog' component={UserActivity} />
								<Route path='/status/snapshot' component={SnapshotView} />
								<Redirect to='/status/system' />
							</Switch>
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default translate()(Status)
