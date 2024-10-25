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
	UserEditingButtonType,
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
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import _ from 'underscore'
import { Segments } from '../../collections'
import { UIParts } from '../Collections'
import { useSelection } from '../RundownView/SelectedElementsContext'

/**
 * Propertiespanel PopUp props.
 */
interface Props {
	// Currently selected context menu context
	// Plan is to replace this with a more specific selection of what is selected in the UI
	// When selected element for propertiesPanel has been implemented
	contextMenuContext: IContextMenuContext | null
}

export function PropertiesPanel(props: Props): JSX.Element {
	const { listSelectedElements } = useSelection()
	console.log('listSelectedElements', listSelectedElements())
	const selectedElement = listSelectedElements()?.[0]

	const { t } = useTranslation()

	React.useEffect(() => {
		return () => {
			Array.from(document.querySelectorAll('.propertiespanel-pop-up.is-highlighted')).forEach((element: Element) => {
				if (element instanceof HTMLElement) {
					element.style.animationName = ''
				}
			})
		}
	}, [])

	const rundownId = props.contextMenuContext?.segment?.rundownId
	const part = useTracker(() => UIParts.findOne({ _id: selectedElement.elementId }), [selectedElement.elementId])

	console.log('Context Segment id', props.contextMenuContext?.segment?._id)
	const segment = useTracker(
		() => Segments.findOne({ rundownId: rundownId, _id: selectedElement.elementId }),
		[selectedElement.elementId]
	)

	return (
		<div className="propertiespanel-pop-up">
			{selectedElement.type === 'partInstance' && (
				<>
					<div className="propertiespanel-pop-up__header">
						{part?.userEditOperations &&
							part.userEditOperations.map((operation) => {
								if (operation.type === UserEditingType.FORM || !operation.svgIcon || !operation.isActive) return null

								return (
									<div
										key={operation.id}
										className="svg"
										dangerouslySetInnerHTML={{
											__html: operation.svgIcon,
										}}
									></div>
								)
							})}
						PART : {String(part?.title)}
					</div>
					<div className="propertiespanel-pop-up__contents">
						{segment &&
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
			{selectedElement.type === 'segment' && (
				<>
					<div className="propertiespanel-pop-up__header">
						{segment?.userEditOperations &&
							segment.userEditOperations.map((operation) => {
								if (operation.type === UserEditingType.FORM || !operation.svgIcon || !operation.isActive) return null

								return (
									<div
										key={operation.id}
										className="svg"
										dangerouslySetInnerHTML={{
											__html: operation.svgIcon,
										}}
									></div>
								)
							})}
						SEGMENT : {String(segment?.name)}
					</div>
					<div className="propertiespanel-pop-up__contents">
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
			<div className="propertiespanel-pop-up__footer">
				<button
					className="propertiespanel-pop-up__button"
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
										id:
											selectedElement.type === 'partInstance'
												? DefaultUserOperationsTypes.REVERT_PART
												: DefaultUserOperationsTypes.REVERT_SEGMENT,
									}
								)
							)
					}}
				>
					<span className="propertiespanel-pop-up__label">REVERT CHANGES</span>
				</button>
			</div>
		</div>
	)
}

function EditingTypeAction(props: {
	userEditOperation: CoreUserEditingDefinitionAction
	contextMenuContext: IContextMenuContext | null
}) {
	if (!props.userEditOperation.buttonType) return null
	switch (props.userEditOperation.buttonType) {
		case UserEditingButtonType.BUTTON:
			return (
				<button
					title={'User Action : ' + props.userEditOperation.label}
					className="propertiespanel-pop-up__button"
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
				>
					<span className="propertiespanel-pop-up__label">
						{' '}
						{translateMessage(props.userEditOperation.label, i18nTranslator)}
					</span>
				</button>
			)
		case UserEditingButtonType.SWITCH:
			return (
				<div className="propertiespanel-pop-up__action">
					<a
						className={classNames('propertiespanel-pop-up__switchbutton', 'switch-button', {
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
					<span className="propertiespanel-pop-up__label">
						{' '}
						{translateMessage(props.userEditOperation.label, i18nTranslator)}
					</span>
				</div>
			)
		case UserEditingButtonType.HIDDEN || undefined:
			return null
		default:
			assertNever(props.userEditOperation.buttonType)
			return null
	}
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
			<div className="propertiespanel-pop-up__groupselector">
				{props.userEditOperation.grouping &&
					groups.map((group, index) => {
						return !group.svgIcon ? (
							<button
								className={
									selectedGroup !== group.filter
										? `propertiespanel-pop-up__groupselector__button`
										: `propertiespanel-pop-up__groupselector__button-active`
								}
								style={{ backgroundColor: group.color }}
								key={index}
								onClick={() => {
									setSelectedGroup(group.filter)
								}}
								disabled={!group.filter}
							>
								<div
									className="svg"
									dangerouslySetInnerHTML={{
										__html: group.svgIcon || '',
									}}
								></div>
								{!group.svgIcon && group.label}
							</button>
						) : (
							<button
								className={
									selectedGroup !== group.filter
										? `propertiespanel-pop-up__groupselector__button-svg`
										: `propertiespanel-pop-up__groupselector__button-svg-active`
								}
								key={index}
								onClick={() => {
									setSelectedGroup(group.filter)
								}}
								disabled={!group.filter}
							>
								<div
									className="svg-icon"
									dangerouslySetInnerHTML={{
										__html: group.svgIcon,
									}}
								></div>
							</button>
						)
					})}
			</div>
			{selectedGroup && schema && (
				<>
					<a className="propertiespanel-pop-up__label">{t('Source')}:</a>
					<br />
					<select
						title="Sources in the selected group"
						className="propertiespanel-pop-up__select"
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
