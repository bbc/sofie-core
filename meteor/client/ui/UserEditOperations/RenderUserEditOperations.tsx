import React from 'react'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CoreUserEditingDefinition } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { JSONBlobParse, UserEditingType, UserOperationTarget } from '@sofie-automation/blueprints-integration'
import { UserAction, doUserAction } from '../../../lib/clientUserAction'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { MenuItem } from '@jstarpl/react-contextmenu'
import { MeteorCall } from '../../../lib/api/methods'
import { i18nTranslator } from '../i18n'
import { doModalDialog } from '../../lib/ModalDialog'
import { SchemaFormInPlace } from '../../lib/forms/SchemaFormInPlace'

export function RenderUserEditOperations(
	isFormEditable: boolean,
	rundownId: RundownId,
	targetName: string,
	userEdits: CoreUserEditingDefinition[] | undefined,
	operationTarget: UserOperationTarget
): React.JSX.Element {
	const t = i18nTranslator
	if (!userEdits || userEdits.length === 0) return <React.Fragment />
	return (
		<React.Fragment>
			<hr />
			{userEdits.map((userEdit, i) => {
				switch (userEdit.type) {
					case UserEditingType.ACTION:
						return (
							<MenuItem
								key={`${userEdit.id}_${i}`}
								onClick={(e) => {
									doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
										MeteorCall.userAction.executeUserChangeOperation(e, ts, rundownId, operationTarget, {
											id: userEdit.id,
										})
									)
								}}
							>
								<span>{translateMessage(userEdit.label, i18nTranslator)}</span>
							</MenuItem>
						)
					case UserEditingType.FORM:
						return (
							<MenuItem
								disabled={!isFormEditable}
								key={`${userEdit.id}_${i}`}
								onClick={(e) => {
									const schema = JSONBlobParse(userEdit.schema)
									const values = clone(userEdit.currentValues)

									// TODO:
									doModalDialog({
										title: t(`Edit {{targetName}}`, { targetName }),
										message: (
											<SchemaFormInPlace
												schema={schema}
												object={values}
												translationNamespaces={userEdit.translationNamespaces}
											/>
										),
										// acceptText: 'OK',
										yes: t('Save Changes'),
										no: t('Cancel'),
										onAccept: () => {
											doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
												MeteorCall.userAction.executeUserChangeOperation(e, ts, rundownId, operationTarget, {
													...values,
													id: userEdit.id,
												})
											)
										},
									})
								}}
							>
								<span>{translateMessage(userEdit.label, i18nTranslator)}</span>
							</MenuItem>
						)
					default:
						assertNever(userEdit)
						return null
				}
			})}
		</React.Fragment>
	)
}
