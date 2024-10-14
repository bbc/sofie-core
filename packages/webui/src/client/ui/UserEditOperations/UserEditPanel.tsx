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
import { SchemaFormInPlace } from '../../lib/forms/SchemaFormInPlace'

/**
 * UserEditPanelPopUp props.
 */
interface Props {
	contextMenuContext: IContextMenuContext | null
}

interface State {
	dismissing: string[]
	dismissingTransform: string[]
}

interface TrackedProps {}

/**
 * Presentational component that displays the currents user edit operations.
 * @class UserEditPanel
 * @extends React.Component<Props>
 */
export const UserEditPanel = translateWithTracker<Props, State, TrackedProps>(() => {
	return {}
})(
	class UserEditPanelPopUp extends React.Component<Translated<Props & TrackedProps>, State> {
		t = i18nTranslator
		private readonly DISMISS_ANIMATION_DURATION = 500
		private readonly LEAVE_ANIMATION_DURATION = 150

		constructor(props: Translated<Props & TrackedProps>) {
			super(props)

			this.state = {
				dismissing: [],
				dismissingTransform: [],
			}
		}

		shouldComponentUpdate(nextProps: Readonly<Translated<Props & TrackedProps>>): boolean {
			return (
				this.props.contextMenuContext?.part?.instance._id !== nextProps.contextMenuContext?.part?.instance._id ||
				JSON.stringify(this.props.contextMenuContext?.part?.instance.part.userEditOperations) !==
					JSON.stringify(nextProps.contextMenuContext?.part?.instance.part.userEditOperations) ||
				this.props.contextMenuContext?.segment?._id !== nextProps.contextMenuContext?.segment?._id ||
				JSON.stringify(this.props.contextMenuContext?.segment?.userEditOperations) !==
					JSON.stringify(nextProps.contextMenuContext?.segment?.userEditOperations)
			)
		}

		UNSAFE_componentWillUpdate() {
			Array.from(document.querySelectorAll('.usereditpanel-pop-up.is-highlighted')).forEach((element0: Element) => {
				const element = element0 as HTMLElement
				if ('style' in element) {
					element.style.animationName = ''
				}
			})
		}

		componentDidUpdate(prevProps: Readonly<Translated<Props & TrackedProps>>, prevState: State, snapshot: any) {
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
					<div className="usereditpanel-pop-up__contents"></div>
					<hr />

					<div className="usereditpanel-pop-up__header">
						PART : {String(this.props.contextMenuContext?.part?.instance.part.title)}
					</div>
					{this.props.contextMenuContext?.part?.instance._id &&
						this.props.contextMenuContext?.part?.instance.part.userEditOperations?.map((userEditOperation, i) => {
							this.props.contextMenuContext?.part?.instance.part.title
							switch (userEditOperation.type) {
								case UserEditingType.ACTION:
									return (
										<>
											<hr />
											<button
												key={`${userEditOperation.id}_${i}`}
												onClick={(e) => {
													doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
														MeteorCall.userAction.executeUserChangeOperation(
															e,
															ts,
															//@ts-expect-error TODO: Fix this
															this.props.contextMenuContext?.segment?.rundownId,
															{
																segmentExternalId: this.props.contextMenuContext?.segment?.externalId,
																partExternalId: this.props.contextMenuContext?.part?.instance.part.externalId,
																pieceExternalId: undefined,
															},
															{
																id: userEditOperation.id,
															}
														)
													)
												}}
											>
												{
													// ToDo: use CSS to Style state instead of asterix
													userEditOperation.isActive ? <span className="action-protected">{'• '}</span> : null
												}
												<span>{translateMessage(userEditOperation.label, i18nTranslator)}</span>
											</button>
										</>
									)
								case UserEditingType.FORM:
									const schema = JSONBlobParse(userEditOperation.schema)
									const values = clone(userEditOperation.currentValues)
									return (
										<>
											<hr />
											<SchemaFormInPlace
												schema={schema}
												object={values}
												translationNamespaces={userEditOperation.translationNamespaces}
											/>
											<button
												key={`${userEditOperation.id}_${i}`}
												onClick={(e) => {
													// TODO:
													doModalDialog({
														title: t(`Edit {{targetName}}`, {
															targetName: this.props.contextMenuContext?.segment?.name,
														}),
														message: 'Change Camera to: ' + values['camera'] || 'NONE',

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
																		...values,
																		id: userEditOperation.id,
																	}
																)
															)
														},
													})
												}}
											>
												<span>{translateMessage(userEditOperation.label, i18nTranslator)}</span>
											</button>
										</>
									)
								default:
									assertNever(userEditOperation)
									return null
							}
						})}
					<hr />
					<div className="usereditpanel-pop-up__header">
						SEGMENT : {String(this.props.contextMenuContext?.segment?.name)}
					</div>
					{this.props.contextMenuContext?.segment &&
						this.props.contextMenuContext?.segment?.userEditOperations?.map((userEditOperation, i) => {
							switch (userEditOperation.type) {
								case UserEditingType.ACTION:
									return (
										<>
											<hr />
											<button
												key={`${userEditOperation.id}_${i}`}
												onClick={(e) => {
													doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
														MeteorCall.userAction.executeUserChangeOperation(
															e,
															ts,
															//@ts-expect-error TODO: Fix this
															this.props.contextMenuContext?.segment?.rundownId,
															{
																segmentExternalId: this.props.contextMenuContext?.segment?.externalId,
																partExternalId: this.props.contextMenuContext?.part?.instance.part.externalId,
																pieceExternalId: undefined,
															},
															{
																id: userEditOperation.id,
															}
														)
													)
												}}
											>
												{
													// ToDo: use CSS to Style state instead of asterix
													userEditOperation.isActive ? <span className="action-protected">{'• '}</span> : null
												}
												<span>{translateMessage(userEditOperation.label, i18nTranslator)}</span>
											</button>
										</>
									)
								case UserEditingType.FORM:
									return (
										<>
											<button
												key={`${userEditOperation.id}_${i}`}
												onClick={(e) => {
													const schema = JSONBlobParse(userEditOperation.schema)
													const values = clone(userEditOperation.currentValues)

													doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
														MeteorCall.userAction.executeUserChangeOperation(
															e,
															ts,
															//@ts-expect-error TODO: Fix this
															this.props.contextMenuContext?.segment?.rundownId,
															//@ts-expect-error TODO: Fix this
															this.props.contextMenuContext?.segment?.operationTarget,
															{
																...values,
																id: userEditOperation.id,
															}
														)
													)
												}}
											>
												<SchemaFormInPlace
													schema={schema}
													object={values}
													translationNamespaces={userEditOperation.translationNamespaces}
												/>

												<span>{translateMessage(userEditOperation.label, i18nTranslator)}</span>
											</button>
											<button
												key={`${userEditOperation.id}_${i}`}
												onClick={(e) => {
													const schema = JSONBlobParse(userEditOperation.schema)
													const values = clone(userEditOperation.currentValues)

													// TODO:
													doModalDialog({
														title: t(`Edit {{targetName}}`, {
															targetName: this.props.contextMenuContext?.segment?.name,
														}),
														message: (
															<SchemaFormInPlace
																schema={schema}
																object={values}
																translationNamespaces={userEditOperation.translationNamespaces}
															/>
														),
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
																		...values,
																		id: userEditOperation.id,
																	}
																)
															)
														},
													})
												}}
											>
												<span>{translateMessage(userEditOperation.label, i18nTranslator)}</span>
											</button>
										</>
									)
								default:
									assertNever(userEditOperation)
									return null
							}
						})}
					<ContextMenuTrigger
						id="context-menu-dissmiss-all"
						attributes={{ className: 'usereditpanel-pop-up__contents' }}
					></ContextMenuTrigger>
				</div>
			)
		}
	}
)
