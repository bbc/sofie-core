import * as React from 'react'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/meteorApi'
import {
	DefaultUserOperationEditProperties,
	DefaultUserOperationsTypes,
	JSONBlob,
	JSONBlobParse,
	JSONSchema,
	UserEditingProperties,
	UserEditingSourceLayer,
	UserEditingType,
} from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Segments } from '../../collections'
import { UIParts } from '../Collections'
import { useSelection } from '../RundownView/SelectedElementsContext'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { RundownUtils } from '../../lib/rundown'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { useCallback } from 'react'
import { SchemaFormWithState } from '../../lib/forms/SchemaFormWithState'

type PendingChange = DefaultUserOperationEditProperties['payload']

export function PropertiesPanel(): JSX.Element {
	const { listSelectedElements, clearSelections } = useSelection()
	const selectedElement = listSelectedElements()?.[0]
	const { t } = useTranslation()

	const [pendingChange, setPendingChange] = React.useState<PendingChange | undefined>(undefined)
	const hasPendingChanges = !!pendingChange

	const [isAnimatedIn, setIsAnimatedIn] = React.useState(false)
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setIsAnimatedIn(true)
		}, 10)
		return () => clearTimeout(timer)
	}, [])

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
		setPendingChange(undefined)
		return UIParts.findOne({ _id: selectedElement?.elementId })
	}, [selectedElement?.elementId])

	const segment: DBSegment | undefined = useTracker(
		() => Segments.findOne({ _id: part ? part.segmentId : selectedElement?.elementId }),
		[selectedElement?.elementId, part?.segmentId]
	)
	const rundownId = part ? part.rundownId : segment?.rundownId

	const handleCommitChanges = async (e: React.MouseEvent) => {
		if (!rundownId || !selectedElement || !pendingChange) return

		doUserAction(
			t,
			e,
			UserAction.EXECUTE_USER_OPERATION,
			(e, ts) =>
				MeteorCall.userAction.executeUserChangeOperation(
					e,
					ts,
					rundownId,
					{
						segmentExternalId: segment?.externalId,
						partExternalId: part?.externalId,
						pieceExternalId: undefined,
					},
					literal<DefaultUserOperationEditProperties>({
						id: DefaultUserOperationsTypes.UPDATE_PROPS,
						payload: pendingChange,
					})
				),
			() => setPendingChange(undefined)
		)
	}

	const handleRevertChanges = (e: React.MouseEvent) => {
		if (!rundownId || !selectedElement) return
		setPendingChange(undefined)
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

	const userEditOperations =
		selectedElement?.type === 'part'
			? part?.userEditOperations
			: selectedElement?.type === 'segment'
			? segment?.userEditOperations
			: undefined
	const userEditProperties =
		selectedElement?.type === 'part'
			? part?.userEditProperties
			: selectedElement?.type === 'segment'
			? segment?.userEditProperties
			: undefined
	const change = pendingChange ?? {
		pieceTypeProperties: userEditProperties?.pieceTypeProperties?.currentValue ?? { type: '', value: {} },
		globalProperties: userEditProperties?.globalProperties?.currentValue ?? {},
	}

	const title =
		selectedElement?.type === 'part' ? part?.title : selectedElement?.type === 'segment' ? segment?.name : undefined

	return (
		<div className={classNames('properties-panel', isAnimatedIn && 'is-mounted')}>
			<div className="propertiespanel-pop-up">
				<div className="propertiespanel-pop-up_close" onClick={clearSelections}>
					<CoreIcon.NrkClose />
				</div>

				<>
					<div className="propertiespanel-pop-up__header">
						{userEditOperations &&
							userEditOperations.map((operation) => {
								if (operation.type !== UserEditingType.ACTION || !operation.svgIcon || !operation.isActive) return null
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
						{title}
					</div>
					<div className="propertiespanel-pop-up__contents">
						{userEditProperties?.pieceTypeProperties && (
							<PropertiesEditor
								properties={userEditProperties.pieceTypeProperties}
								change={change}
								setChange={setPendingChange}
							/>
						)}
						{userEditProperties?.globalProperties && (
							<GlobalPropertiesEditor
								schema={userEditProperties.globalProperties.schema}
								change={change}
								setChange={setPendingChange}
							/>
						)}
					</div>
				</>
				<div className="propertiespanel-pop-up__footer">
					<button
						className="propertiespanel-pop-up__button"
						onClick={handleRevertChanges}
						disabled={!hasPendingChanges}
					>
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

function PropertiesEditor({
	properties,
	change,
	setChange,
}: {
	properties: UserEditingProperties['pieceTypeProperties']
	change: PendingChange
	setChange: React.Dispatch<React.SetStateAction<PendingChange | undefined>>
}): JSX.Element {
	if (!properties) return <></>

	const selectedGroupId = change.pieceTypeProperties.type
	const selectedGroupSchema = properties.schema[selectedGroupId]?.schema
	const parsedSchema = selectedGroupSchema ? JSONBlobParse(selectedGroupSchema) : undefined

	const updateGroup = useCallback(
		(key: string) => {
			setChange({
				...change,
				pieceTypeProperties: {
					type: key,
					value: {}, // todo - take defaults
				},
			})
		},
		[change]
	)
	const onUpdate = useCallback(
		(update: Record<string, any>) => {
			console.log(change.pieceTypeProperties.type, update)
			setChange({
				...change,
				pieceTypeProperties: {
					type: change.pieceTypeProperties.type,
					value: update,
				},
			})
		},
		[change]
	)
	const value = change.pieceTypeProperties.value

	return (
		<>
			<div className="propertiespanel-pop-up__groupselector">
				{Object.entries<UserEditingSourceLayer>(properties.schema).map(([key, group]) => {
					return (
						<button
							className={classNames(
								RundownUtils.getSourceLayerClassName(group.sourceLayerType),
								selectedGroupId !== key
									? `propertiespanel-pop-up__groupselector__button`
									: `propertiespanel-pop-up__groupselector__button-active`
							)}
							key={key}
							onClick={() => {
								updateGroup(key)
							}}
						>
							{group.sourceLayerLabel}
						</button>
					)
				})}
			</div>
			<hr />
			{parsedSchema && (
				<div className="properties-grid" style={{ color: 'white' }}>
					<SchemaFormWithState
						key={(selectedGroupSchema as any as string) ?? 'key'}
						schema={parsedSchema}
						object={value}
						onUpdate={onUpdate}
						translationNamespaces={[]}
					/>
				</div>
			)}
			<hr />
		</>
	)
}

/**
 * @todo - retrieve translationNamespaces for correct blueprint translations?
 */
function GlobalPropertiesEditor({
	schema,
	change,
	setChange,
}: {
	schema: JSONBlob<JSONSchema>
	change: PendingChange
	setChange: React.Dispatch<React.SetStateAction<PendingChange | undefined>>
}): JSX.Element {
	const parsedSchema = schema ? JSONBlobParse(schema) : undefined
	const currentValue = change.globalProperties

	const onUpdate = useCallback(
		(update: Record<string, any>) => {
			console.log('glob', update)
			setChange({
				...change,
				globalProperties: update,
			})
		},
		[change]
	)

	return (
		<div className="properties-grid" style={{ color: 'white' }}>
			{parsedSchema ? (
				<SchemaFormWithState
					key={(schema as any as string) ?? 'key'}
					schema={parsedSchema}
					object={currentValue}
					onUpdate={onUpdate}
					translationNamespaces={[]}
				/>
			) : (
				<p>No schema found</p>
			)}
		</div>
	)
}
