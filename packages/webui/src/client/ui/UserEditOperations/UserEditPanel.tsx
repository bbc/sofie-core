import * as React from 'react'
// @ts-expect-error No types available
import * as VelocityReact from 'velocity-react'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { i18nTranslator } from '../i18n'
import { IContextMenuContext } from '../RundownView'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/meteorApi'
import { t } from 'i18next'
import { JSONBlobParse, UserEditingType } from '@sofie-automation/blueprints-integration'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import { doModalDialog } from '../../lib/ModalDialog'
import classNames from 'classnames'
import {
	CoreUserEditingDefinitionAction,
	CoreUserEditingDefinitionForm,
} from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'

/**
 * UserEditPanelPopUp props.
 */
interface Props {
	contextMenuContext: IContextMenuContext | null
}

interface State {
	selectedGroup: string | undefined
	selectedSource: Record<string, any>
	dismissing: string[]
	dismissingTransform: string[]
}

interface ITrackedProps {}

/**
 * Presentational component that displays the currents user edit operations.
 * @class UserEditPanel
 * @extends React.Component<Props>
 */
export const UserEditPanel = translateWithTracker<Props, State, ITrackedProps>(() => {
	return {}
})(
	class UserEditPanelPopUp extends React.Component<Translated<Props & ITrackedProps>, State> {
		t = i18nTranslator

		constructor(props: Translated<Props & ITrackedProps>) {
			super(props)

			this.state = {
				selectedGroup: undefined,
				selectedSource: {},
				dismissing: [],
				dismissingTransform: [],
			}
		}

		UNSAFE_componentWillUpdate() {
			Array.from(document.querySelectorAll('.usereditpanel-pop-up.is-highlighted')).forEach((element0: Element) => {
				const element = element0 as HTMLElement
				if ('style' in element) {
					element.style.animationName = ''
				}
			})
		}

		componentDidUpdate(prevProps: Readonly<Translated<Props & ITrackedProps>>, prevState: State, snapshot: any) {
			if (super.componentDidUpdate) super.componentDidUpdate(prevProps, prevState, snapshot)
		}

		dismissAll() {
			// Dismiss all useredits
			// this.props.dismissAll()
		}

		approveAll() {
			// Approve all useredits
			// this.props.approveAll()
		}

		render(): JSX.Element {
			return (
				<div className="usereditpanel-pop-up">
					<div className="usereditpanel-pop-up__header">
						PART : {String(this.props.contextMenuContext?.part?.instance.part.title)}
					</div>
					<div className="usereditpanel-pop-up__contents">
						{this.props.contextMenuContext?.part?.instance._id &&
							this.props.contextMenuContext?.part?.instance.part.userEditOperations?.map((userEditOperation, i) => {
								this.props.contextMenuContext?.part?.instance.part.title
								switch (userEditOperation.type) {
									case UserEditingType.ACTION:
										return (
											<EditingTypeAction
												userEditOperation={userEditOperation}
												contextMenuContext={this.props.contextMenuContext}
											/>
										)
									case UserEditingType.FORM:
										return (
											<EditingTypeForm
												userEditOperation={userEditOperation}
												contextMenuContext={this.props.contextMenuContext}
											/>
										)
									default:
										assertNever(userEditOperation)
										return null
								}
							})}
					</div>
					<hr />
					<div className="usereditpanel-pop-up__contents">
						<div className="usereditpanel-pop-up__label">
							Debug (segment) : {String(this.props.contextMenuContext?.segment?.name)}
						</div>
						{this.props.contextMenuContext?.segment &&
							this.props.contextMenuContext?.segment?.userEditOperations?.map((userEditOperation, i) => {
								switch (userEditOperation.type) {
									case UserEditingType.ACTION:
										return (
											<EditingTypeAction
												userEditOperation={userEditOperation}
												contextMenuContext={this.props.contextMenuContext}
											/>
										)
									case UserEditingType.FORM:
										return (
											<EditingTypeForm
												userEditOperation={userEditOperation}
												contextMenuContext={this.props.contextMenuContext}
											/>
										)
									default:
										assertNever(userEditOperation)
										return null
								}
							})}
					</div>
					<ContextMenuTrigger
						id="context-menu-dissmiss-all"
						attributes={{ className: 'usereditpanel-pop-up__contents' }}
					></ContextMenuTrigger>
				</div>
			)
		}
	}
)

function EditingTypeAction(props: {
	userEditOperation: CoreUserEditingDefinitionAction
	contextMenuContext: IContextMenuContext | null
}) {
	return (
		<div className="usereditpanel-pop-up__action">
			<a
				className={classNames('usereditpanel-pop-up__switchbutton', 'switch-button', 'sb-nocolor', {
					'sb-on': props.userEditOperation.isActive || false,
				})}
				role="button"
				onClick={(e) => {
					doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
						MeteorCall.userAction.executeUserChangeOperation(
							e,
							ts,
							//@ts-expect-error TODO: Fix this
							this.props.contextMenuContext?.segment?.rundownId,
							{
								segmentExternalId: props.contextMenuContext?.segment?.externalId,
								partExternalId: props.contextMenuContext?.part?.instance.part.externalId,
								pieceExternalId: undefined,
							},
							{
								id: props.userEditOperation.id,
							}
						)
					)
				}}
				tabIndex={0}
			>
				<div className="sb-content">
					<div className="sb-label">
						<span className="mls">&nbsp;</span>
						<span className="mrs right">&nbsp;</span>
					</div>
					<div className="sb-switch"></div>
				</div>
			</a>
			<span className="usereditpanel-pop-up__label">
				{translateMessage(props.userEditOperation.label, i18nTranslator)}
			</span>
		</div>
	)
}

function EditingTypeForm(props: {
	userEditOperation: CoreUserEditingDefinitionForm
	contextMenuContext: IContextMenuContext | null
}) {
	const [selectedSource, setSelectedSource] = React.useState<Record<string, string>>(
		clone(props.userEditOperation.currentValues)
	)
	const [selectedGroup, setSelectedGroup] = React.useState<string | undefined>(
		// base initial selectedGroup on the first key in slectedSource:
		Object.keys(selectedSource)[0]
	)
	const jsonSchema = props.userEditOperation.schemas[selectedGroup || '']
	const schema = jsonSchema ? JSONBlobParse(jsonSchema) : undefined
	const sourceList = (schema?.properties ? schema?.properties[selectedGroup ?? ''] : []) as {
		enum: string[]
		tsEnumNames: string[]
	}
	return (
		<>
			<div className="usereditpanel-pop-up__groupselector">
				{props.userEditOperation.grouping &&
					props.userEditOperation.grouping.map((group, index) => {
						return (
							<button
								className={
									selectedGroup !== group.filter
										? `usereditpanel-pop-up__groupselector__button`
										: `usereditpanel-pop-up__groupselector__button-active`
								}
								style={{ backgroundColor: group.color }}
								key={index}
								onClick={(e) => {
									setSelectedGroup(group.filter)
								}}
							>
								{group.label}
							</button>
						)
					})}
			</div>
			{selectedGroup && schema && (
				<>
					<select
						title="Sources in the selected group"
						className="usereditpanel-pop-up__select"
						value={selectedSource[selectedGroup] || ''}
						onChange={(e) => {
							setSelectedSource({ [selectedGroup]: e.target.value })
						}}
					>
						{sourceList.enum.map((source, index) => (
							<option key={index} value={source}>
								{sourceList.tsEnumNames[index]}
							</option>
						))}
					</select>
					<br />
					<button
						className="usereditpanel-pop-up__button"
						key={`${props.userEditOperation.id}`}
						onClick={(e) => {
							// TODO:
							doModalDialog({
								title: t(`Edit {{targetName}}`, {
									targetName: props.contextMenuContext?.segment?.name,
								}),
								message: 'Change Source to: ' + selectedSource[selectedGroup],

								// acceptText: 'OK',
								yes: t('Save Changes'),
								no: t('Cancel'),
								onAccept: () => {
									doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
										MeteorCall.userAction.executeUserChangeOperation(
											e,
											ts,
											//@ts-expect-error TODO: Fix this
											this.props.contextMenuContext?.segment?.rundownId,
											//@ts-expect-error TODO: Fix this
											this.props.contextMenuContext?.segment?.operationTarget,
											{
												values: selectedSource[selectedGroup],
												id: props.userEditOperation.id,
											}
										)
									)
								},
							})
						}}
					>
						<span className="label">{translateMessage(props.userEditOperation.label, i18nTranslator)}</span>
					</button>
				</>
			)}
		</>
	)
}
