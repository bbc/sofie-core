import * as React from 'react'
import { Redirect } from 'react-router'
import { withTracker } from './ReactMeteorData/ReactMeteorData'
import { Mongo } from 'meteor/mongo'
import { withTranslation } from 'react-i18next'
import { Studios } from '../../lib/collections/Studios'
import { MeteorCall } from '../../lib/api/methods'

interface ISettingsNavigation extends ISettingsNavigationBaseProps {
	type: SettingsNavigationType
}
export type SettingsNavigationType = 'blueprint' | 'showstyle' | 'newshowstyle'
export class SettingsNavigation extends React.Component<ISettingsNavigation> {
	render() {
		if (this.props.type === 'blueprint') {
			return <Blueprint {...this.props} />
		} else if (this.props.type === 'showstyle') {
			return <ShowStyle {...this.props} />
		} else if (this.props.type === 'newshowstyle') {
			return <NewShowStyle {...this.props} />
		}

		return <div>Unknown edit type {this.props.type}</div>
	}
}
interface ISettingsNavigationBaseProps {
	attribute?: string
	collection?: Mongo.Collection<any>
	obj?: any
	className?: string
}

interface ISettingsNavigationBaseState {
	redirect: boolean
	redirectRoute: string
}
export class SettingsNavigationBase extends React.Component<
	ISettingsNavigationBaseProps,
	ISettingsNavigationBaseState
> {
	constructor(props) {
		super(props)

		this.state = {
			redirect: false,
			redirectRoute: '',
		}

		this.redirectUser = this.redirectUser.bind(this)
	}

	redirectUser(url: string) {
		this.setState({
			redirect: true,
			redirectRoute: url,
		})
	}

	renderButton() {
		return <button></button>
	}

	render() {
		if (this.state.redirect === true) {
			return <Redirect to={this.state.redirectRoute} />
		}

		return this.renderButton()
	}
}
function wrapSettingsNavigation(newClass) {
	return withTracker((props: ISettingsNavigationBaseProps) => {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		return {
			myObject: props.collection ? props.collection.findOne(props.obj._id) : props.obj || {},
		}
	})(newClass)
}

const Blueprint = wrapSettingsNavigation(
	withTranslation()(
		class Blueprint extends SettingsNavigationBase {
			constructor(props) {
				super(props)
			}

			onBlueprintAdd() {
				MeteorCall.blueprint
					.insertBlueprint()
					.then((blueprintId) => {
						this.props.obj['blueprintId'] = blueprintId
						if (this.props.obj) {
							let m = {}
							m['blueprintId'] = blueprintId
							Studios.update(this.props.obj['_id'], { $set: m })
						}
						this.redirectUser('/settings/blueprint/' + blueprintId)
					})
					.catch(console.error)
			}

			renderButton() {
				if (this.props.obj && this.props.attribute) {
					if (this.props.obj[this.props.attribute]) {
						return (
							<button
								className="btn btn-primary btn-add-new"
								onClick={() => {
									this.redirectUser(
										'/settings/blueprint/' + (this.props.attribute ? this.props.obj[this.props.attribute] : '')
									)
								}}>
								Edit Blueprint
							</button>
						)
					}
				}

				return (
					<button
						className="btn btn-primary btn-add-new"
						onClick={() => {
							this.onBlueprintAdd()
						}}>
						New Blueprint
					</button>
				)
			}
		}
	)
)

const ShowStyle = wrapSettingsNavigation(
	withTranslation()(
		class ShowStyle extends SettingsNavigationBase {
			constructor(props) {
				super(props)
			}

			renderButton() {
				if (this.props.obj && this.props.attribute) {
					return (
						<button
							key={'button-navigate-' + this.props.obj[this.props.attribute]}
							className="btn btn-primary btn-add-new"
							onClick={() => {
								this.redirectUser('/settings/showStyleBase/' + (this.props.attribute ? this.props.obj['_id'] : ''))
							}}>
							Edit {this.props.obj[this.props.attribute]}
						</button>
					)
				}
				return <div>Invalid props for SettingsNavigation</div>
			}
		}
	)
)

const NewShowStyle = wrapSettingsNavigation(
	withTranslation()(
		class NewShowStyle extends SettingsNavigationBase {
			constructor(props) {
				super(props)
			}

			onShowStyleAdd() {
				MeteorCall.showstyles
					.insertShowStyleBase()
					.then((showStyleBaseId) => {
						this.redirectUser('/settings/showStyleBase/' + showStyleBaseId)
					})
					.catch(console.error)
			}

			renderButton() {
				return (
					<button
						className="btn btn-primary btn-add-new"
						onClick={() => {
							this.onShowStyleAdd()
						}}>
						New Show Style
					</button>
				)
			}
		}
	)
)
