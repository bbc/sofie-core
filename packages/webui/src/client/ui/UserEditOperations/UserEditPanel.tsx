import * as React from 'react'
// @ts-expect-error No types available
import * as VelocityReact from 'velocity-react'
import { i18nTranslator } from '../i18n'
import { IContextMenuContext } from '../RundownView'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/meteorApi'
import { t } from 'i18next'
import {
	DefaultUserOperationsTypes,
	JSONBlobParse,
	UserEditingGroupingType,
	UserEditingType,
} from '@sofie-automation/blueprints-integration'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import {
	CoreUserEditingDefinitionAction,
	CoreUserEditingDefinitionForm,
} from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import { useTranslation } from 'react-i18next'
import { Translated, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import _ from 'underscore'
import { Segments } from '../../collections'
import { UIParts } from '../Collections'

/**
 * UserEditPanelPopUp props.
 */
interface Props {
	contextMenuContext: IContextMenuContext | null
}

//function UserEditPanelBase(props: Translated<Props & TrackedProps>) {
export function UserEditPanel(props: Translated<Props>) {
	const { t } = useTranslation()

	React.useEffect(() => {
		return () => {
			Array.from(document.querySelectorAll('.usereditpanel-pop-up.is-highlighted')).forEach((element: Element) => {
				if (element instanceof HTMLElement) {
					element.style.animationName = ''
				}
			})
		}
	}, [])

	const rundownId = props.contextMenuContext?.segment?.rundownId
	const part = useTracker(
		() => UIParts.findOne({ _id: props.contextMenuContext?.part?.instance.part?._id }),
		[props.contextMenuContext?.part?.instance.part],
		props.contextMenuContext?.part?.instance.part
	)

	const segment = useTracker(
		() => Segments.findOne({ rundownId: rundownId, _id: props.contextMenuContext?.segment?._id }),
		[props.contextMenuContext?.segment],
		props.contextMenuContext?.segment
	)

	const timePosition = getTimePosition(props.contextMenuContext || {})

	return (
		<div className="usereditpanel-pop-up">
			{timePosition && (
				<>
					<div className="usereditpanel-pop-up__header">PART : {String(part?.title)}</div>
					<div className="usereditpanel-pop-up__contents">
						{timePosition &&
							segment &&
							part?._id &&
							part.userEditOperations?.map((userEditOperation, i) => {
								switch (userEditOperation.type) {
									case UserEditingType.ACTION:
										return (
											<EditingTypeAction
												key={i}
												userEditOperation={userEditOperation}
												contextMenuContext={props.contextMenuContext}
											/>
										)
									case UserEditingType.FORM:
										return (
											<EditingTypeChangeSource
												key={i}
												userEditOperation={userEditOperation}
												contextMenuContext={props.contextMenuContext}
											/>
										)
									default:
										assertNever(userEditOperation)
										return null
								}
							})}
						<hr />
					</div>
				</>
			)}
			{!timePosition && (
				<>
					<div className="usereditpanel-pop-up__header">Segment : {String(segment?.name)}</div>
					<div className="usereditpanel-pop-up__contents">
						{/* This is only until selection of segment is implemented in UI */}
						{segment &&
							segment?.userEditOperations?.map((userEditOperation, i) => {
								switch (userEditOperation.type) {
									case UserEditingType.ACTION:
										return (
											<EditingTypeAction
												key={i}
												userEditOperation={userEditOperation}
												contextMenuContext={props.contextMenuContext}
											/>
										)
									case UserEditingType.FORM:
										return (
											<EditingTypeChangeSource
												key={i}
												userEditOperation={userEditOperation}
												contextMenuContext={props.contextMenuContext}
											/>
										)
									default:
										assertNever(userEditOperation)
										return null
								}
							})}
					</div>
				</>
			)}
			<div className="usereditpanel-pop-up__footer">
				<button
					className="usereditpanel-pop-up__button"
					onClick={(e) => {
						rundownId &&
							doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
								MeteorCall.userAction.executeUserChangeOperation(
									e,
									ts,
									rundownId,
									{
										segmentExternalId: segment?.externalId,
										partExternalId: part?.externalId,
										pieceExternalId: undefined,
									},
									{
										id: DefaultUserOperationsTypes.REVERT_SEGMENT,
									}
								)
							)
					}}
				>
					<span className="usereditpanel-pop-up__label">REVERT SEGMENT</span>
				</button>
			</div>
		</div>
	)
}

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
							props.contextMenuContext?.segment?.rundownId,
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
				{' '}
				{translateMessage(props.userEditOperation.label, i18nTranslator)}
			</span>
		</div>
	)
}

function EditingTypeChangeSource(props: {
	userEditOperation: CoreUserEditingDefinitionForm
	contextMenuContext: IContextMenuContext | null
}) {
	const { t } = useTranslation()
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
	let groups: UserEditingGroupingType[] = clone(props.userEditOperation.grouping) || []
	const numberOfEmptySlots = 14 - groups.length
	for (let i = 0; i < numberOfEmptySlots; i++) {
		groups.push({})
	}

	return (
		<>
			<div className="usereditpanel-pop-up__groupselector">
				{props.userEditOperation.grouping &&
					groups.map((group, index) => {
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
								disabled={!group.filter}
							>
								{group.label}
							</button>
						)
					})}
			</div>
			{selectedGroup && schema && (
				<>
					<a className="usereditpanel-pop-up__label">{t('Source')}:</a>
					<br />
					<select
						title="Sources in the selected group"
						className="usereditpanel-pop-up__select"
						value={selectedSource[selectedGroup] || ''}
						onChange={(e) => {
							setSelectedSource({ [selectedGroup]: e.target.value })
							doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
								MeteorCall.userAction.executeUserChangeOperation(
									e,
									ts,
									//@ts-expect-error TODO: Fix this
									props.contextMenuContext?.segment?.rundownId,
									{
										segmentExternalId: props.contextMenuContext?.segment?.externalId,
										partExternalId: props.contextMenuContext?.part?.instance.part.externalId,
										pieceExternalId: undefined,
									},
									{
										values: selectedSource[selectedGroup],
										id: props.userEditOperation.id,
									}
								)
							)
						}}
					>
						{sourceList.enum.map((source, index) => (
							<option key={index} value={source}>
								{sourceList.tsEnumNames[index]}
							</option>
						))}
					</select>
					<hr />
				</>
			)}
		</>
	)
}

// This is simmilar implementation as the function in SegmentContextMenu.tsx
// and is used to check if a segment or a part is used.
// A better implementation of what is selected in the UI should be implemented.
function getTimePosition(contextMenuContext: IContextMenuContext): number | null {
	let offset = 0
	if (contextMenuContext && contextMenuContext.partDocumentOffset) {
		const left = contextMenuContext.partDocumentOffset.left || 0
		const timeScale = contextMenuContext.timeScale || 1
		const menuPosition = contextMenuContext.mousePosition || { left }
		offset = (menuPosition.left - left) / timeScale
		return offset
	}
	return null
}
