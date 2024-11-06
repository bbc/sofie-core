import * as React from 'react'
import { i18nTranslator } from '../i18n'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/meteorApi'
import {
	DefaultUserOperationsTypes,
	JSONBlobParse,
	SourceLayerType,
	UserEditingButtonType,
	UserEditingSourceLayer,
	UserEditingType,
} from '@sofie-automation/blueprints-integration'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import {
	CoreUserEditingDefinition,
	CoreUserEditingDefinitionAction,
	CoreUserEditingDefinitionForm,
	CoreUserEditingDefinitionSourceLayerForm,
} from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import { useTranslation } from 'react-i18next'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Segments } from '../../collections'
import { UIParts } from '../Collections'
import { useSelection } from '../RundownView/SelectedElementsContext'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SchemaFormInPlace } from '../../lib/forms/SchemaFormInPlace'

interface PendingChange {
	operationId: string
	type: 'action' | 'form'
	values?: any
	switchState?: boolean
}

export function PropertiesPanel(): JSX.Element {
	const { listSelectedElements } = useSelection()
	const selectedElement = listSelectedElements()?.[0]
	const { t } = useTranslation()

	const [pendingChanges, setPendingChanges] = React.useState<PendingChange[]>([])
	const hasPendingChanges = pendingChanges.length > 0

	React.useEffect(() => {
		return () => {
			Array.from(document.querySelectorAll('.propertiespanel-pop-up.is-highlighted')).forEach((element: Element) => {
				if (element instanceof HTMLElement) {
					element.style.animationName = ''
				}
			})
		}
	}, [])

	const part = useTracker(() => {
		setPendingChanges([])
		return UIParts.findOne({ _id: selectedElement?.elementId })
	}, [selectedElement?.elementId])

	const segment: DBSegment | undefined = useTracker(
		() => Segments.findOne({ _id: part ? part.segmentId : selectedElement?.elementId }),
		[selectedElement?.elementId, part]
	)
	const rundownId = part ? part.rundownId : segment?.rundownId

	const handleCommitChanges = async (e: React.MouseEvent) => {
		if (!rundownId || !selectedElement) return
		for (const change of pendingChanges) {
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
						id: change.operationId,
						values: change.values,
					}
				)
			)
		}
		// Delay the Clear pending changes after executing to avoid async flickering:
		setTimeout(() => setPendingChanges([]), 100)
	}

	const handleRevertChanges = (e: React.MouseEvent) => {
		if (!rundownId || !selectedElement) return
		setPendingChanges([])
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
	}

	return (
		<div className="properties-panel">
			<div className="propertiespanel-pop-up">
				{rundownId && selectedElement?.type === 'part' && (
					<>
						<div className="propertiespanel-pop-up__header">
							{part?.userEditOperations &&
								part.userEditOperations.map((operation) => {
									if (operation.type !== UserEditingType.ACTION || !operation.svgIcon || !operation.isActive)
										return null
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
													segment={segment}
													part={part}
													rundownId={rundownId}
													pendingChanges={pendingChanges}
													setPendingChanges={setPendingChanges}
												/>
											)
										case UserEditingType.FORM:
											return (
												<EditingTypeChangeForm
													key={i}
													userEditOperation={userEditOperation}
													segment={segment}
													part={part}
													rundownId={rundownId}
													pendingChanges={pendingChanges}
													setPendingChanges={setPendingChanges}
												/>
											)
										case UserEditingType.SOURCE_LAYER_FORM:
											return (
												<EditingTypeChangeSourceLayerSource
													key={i}
													userEditOperation={userEditOperation}
													segment={segment}
													part={part}
													rundownId={rundownId}
													pendingChanges={pendingChanges}
													setPendingChanges={setPendingChanges}
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
				{rundownId && selectedElement?.type === 'segment' && (
					<>
						<div className="propertiespanel-pop-up__header">
							{segment?.userEditOperations &&
								segment.userEditOperations.map((operation) => {
									if (operation.type !== UserEditingType.ACTION || !operation.svgIcon || !operation.isActive)
										return null

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
													segment={segment}
													part={part}
													rundownId={rundownId}
													pendingChanges={pendingChanges}
													setPendingChanges={setPendingChanges}
												/>
											)
										case UserEditingType.FORM:
											return (
												<EditingTypeChangeForm
													key={i}
													userEditOperation={userEditOperation}
													segment={segment}
													part={part}
													rundownId={rundownId}
													pendingChanges={pendingChanges}
													setPendingChanges={setPendingChanges}
												/>
											)
										case UserEditingType.SOURCE_LAYER_FORM:
											return (
												<EditingTypeChangeSourceLayerSource
													key={i}
													userEditOperation={userEditOperation}
													segment={segment}
													part={part}
													rundownId={rundownId}
													pendingChanges={pendingChanges}
													setPendingChanges={setPendingChanges}
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
					<button className="propertiespanel-pop-up__button" onClick={handleRevertChanges}>
						<span className="propertiespanel-pop-up__label">REVERT CHANGES</span>
					</button>
					<button
						className="propertiespanel-pop-up__button"
						onClick={handleCommitChanges}
						disabled={!hasPendingChanges}
					>
						<span className="propertiespanel-pop-up__label">COMMIT CHANGES</span>
					</button>
				</div>
			</div>
		</div>
	)
}

function EditingTypeAction(props: {
	userEditOperation: CoreUserEditingDefinitionAction
	segment: DBSegment | undefined
	part: DBPart | undefined
	rundownId: RundownId
	pendingChanges: PendingChange[]
	setPendingChanges: React.Dispatch<React.SetStateAction<PendingChange[]>>
}) {
	if (!props.userEditOperation.buttonType) return null

	const getPendingState = (operationId: string) => {
		const pendingChange = props.pendingChanges.find((change) => change.operationId === operationId)
		return pendingChange?.switchState
	}

	const addPendingChange = () => {
		props.setPendingChanges((prev) => {
			// Find if there's an existing pending change for this operation
			const existingChangeIndex = prev.findIndex((change) => change.operationId === props.userEditOperation.id)

			if (existingChangeIndex !== -1) {
				// If exists, toggle the switch state
				const newChanges = [...prev]
				newChanges[existingChangeIndex] = {
					...newChanges[existingChangeIndex],
					switchState: !newChanges[existingChangeIndex].switchState,
				}
				return newChanges
			}

			// If doesn't exist, add new change with opposite of current state
			return [
				...prev,
				{
					operationId: props.userEditOperation.id,
					type: 'action',
					switchState: !props.userEditOperation.isActive,
				},
			]
		})
	}

	switch (props.userEditOperation.buttonType) {
		case UserEditingButtonType.BUTTON:
			return (
				<button
					title={'User Action : ' + props.userEditOperation.label}
					className="propertiespanel-pop-up__button"
					onClick={addPendingChange}
				>
					<span className="propertiespanel-pop-up__label">
						{translateMessage(props.userEditOperation.label, i18nTranslator)}
					</span>
				</button>
			)
		case UserEditingButtonType.SWITCH:
			return (
				<div className="propertiespanel-pop-up__action">
					<a
						className={classNames('propertiespanel-pop-up__switchbutton', 'switch-button', {
							'sb-on': getPendingState(props.userEditOperation.id) ?? (props.userEditOperation.isActive || false),
						})}
						role="button"
						onClick={addPendingChange}
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

function EditingTypeChangeForm(props: {
	userEditOperation: CoreUserEditingDefinitionForm
	segment: DBSegment | undefined
	part: DBPart | undefined
	rundownId: RundownId
	pendingChanges: PendingChange[]
	setPendingChanges: React.Dispatch<React.SetStateAction<PendingChange[]>>
}) {
	const { t } = useTranslation()

	const jsonSchema = props.userEditOperation.schema
	const schema = jsonSchema ? JSONBlobParse(jsonSchema) : undefined
	const values = clone(props.userEditOperation.currentValues)

	return (
		<>
			{schema && (
				<>
					<a className="propertiespanel-pop-up__label">{t('Source')}:</a>
					<SchemaFormInPlace
						schema={schema}
						object={values}
						translationNamespaces={props.userEditOperation.translationNamespaces}
					/>
					<br />
					<hr />
				</>
			)}
		</>
	)
}

function EditingTypeChangeSourceLayerSource(props: {
	userEditOperation: CoreUserEditingDefinitionSourceLayerForm
	segment: DBSegment | undefined
	part: DBPart | undefined
	rundownId: RundownId
	pendingChanges: PendingChange[]
	setPendingChanges: React.Dispatch<React.SetStateAction<PendingChange[]>>
}) {
	const { t } = useTranslation()
	const [selectedSource, setSelectedSource] = React.useState<Record<string, string>>(
		clone(props.userEditOperation.currentValues.value)
	)
	const [selectedSourceGroup, setSelectedSourceGroup] = React.useState<SourceLayerType>(
		props.userEditOperation.currentValues.type
	)

	const sourceLayer = Object.values<UserEditingSourceLayer>(props.userEditOperation.schemas).find(
		(layer) => layer.sourceLayerType === selectedSourceGroup
	)
	const jsonSchema = sourceLayer?.schema
	const schema = jsonSchema ? JSONBlobParse(jsonSchema) : undefined
	const values = clone(props.userEditOperation.currentValues)

	const groups = clone(props.userEditOperation.schemas) || {}

	const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = e.target.value
		if (selectedSourceGroup) {
			const newSelectedSource = { [selectedSourceGroup]: newValue }
			setSelectedSource(newSelectedSource)

			// Add to pending changes instead of executing immediately
			props.setPendingChanges((prev) => {
				const filtered = prev.filter(
					(change) => !(change.operationId === props.userEditOperation.id && change.type === 'form')
				)
				return [
					...filtered,
					{
						operationId: props.userEditOperation.id,
						type: 'form',
						values: newValue,
					},
				]
			})
		}
	}

	return (
		<>
			<div className="propertiespanel-pop-up__groupselector">
				{Object.values<UserEditingSourceLayer>(groups).map((group, index) => {
					return (
						<button
							className={
								selectedSourceGroup !== group.sourceLayerType
									? `propertiespanel-pop-up__groupselector__button`
									: `propertiespanel-pop-up__groupselector__button-active`
							}
							style={{ backgroundColor: 'blue' }}
							key={index}
							onClick={() => {
								setSelectedSourceGroup(group.sourceLayerType)
							}}
						>
							{group.sourceLayerLabel}
						</button>
					)
				})}
			</div>
			{schema && (
				<>
					<a className="propertiespanel-pop-up__label">{t('Source')}:</a>
					<SchemaFormInPlace
						schema={schema}
						object={values}
						translationNamespaces={props.userEditOperation.translationNamespaces}
					/>
					<br />
					{/* <select
						title="Sources in the selected group"
						className="propertiespanel-pop-up__select"
						value={selectedSource[selectedGroup] || ''}
						onChange={handleSourceChange}
					>
						{sourceList.enum.map((source, index) => (
							<option key={index} value={source}>
								{sourceList.tsEnumNames[index]}
							</option>
						))}
					</select> */}
					<hr />
				</>
			)}
		</>
	)
}
