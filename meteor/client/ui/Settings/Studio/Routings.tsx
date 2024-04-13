import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import {
	DBStudio,
	StudioRouteSet,
	StudioRouteBehavior,
	RouteMapping,
	StudioRouteSetExclusivityGroup,
	StudioRouteType,
	MappingsExt,
	MappingExt,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { TSR } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { MappingsSettingsManifest, MappingsSettingsManifests } from './Mappings'
import { SchemaFormForCollection } from '../../../lib/forms/SchemaFormForCollection'
import { literal, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { DropdownInputOption } from '../../../lib/Components/DropdownInput'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { Studios } from '../../../collections'
import { LabelActual, LabelAndOverrides, LabelAndOverridesForCheckbox } from '../../../lib/Components/LabelAndOverrides'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
	getAllCurrentAndDeletedItemsFromOverrides,
	useOverrideOpHelper,
} from '../util/OverrideOpHelper'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { CheckboxControl } from '../../../lib/Components/Checkbox'

interface IStudioRoutingsProps {
	translationNamespaces: string[]
	studio: DBStudio
	studioMappings: ReadonlyDeep<MappingsExt>
	manifest: MappingsSettingsManifests | undefined
}

export function StudioRoutings({
	translationNamespaces,
	studio,
	studioMappings,
	manifest,
}: Readonly<IStudioRoutingsProps>): React.JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const getRouteSetsFromOverrides = React.useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(studio.routeSets, null),
		[studio.routeSets]
	)

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'routeSets.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.routeSets)

	const addNewRouteSet = React.useCallback(() => {
		const resolvedRouteSets = applyAndValidateOverrides(studio.routeSets).obj

		// find free key name
		const newRouteKeyName = 'newLayer'
		let iter = 0
		while (resolvedRouteSets[newRouteKeyName + iter.toString()]) {
			iter++
		}

		const newId = newRouteKeyName + iter.toString()
		const newRoute = literal<StudioRouteSet>({
			name: 'New Route Set',
			active: false,
			routes: [],
			behavior: StudioRouteBehavior.TOGGLE,
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newRoute,
		})

		Studios.update(studio._id, {
			$push: {
				'routeSets.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.routeSets])

	const addNewExclusivityGroup = () => {
		const newEGroupKeyName = 'exclusivityGroup'
		let iter = 0
		while ((studio.routeSetExclusivityGroups || {})[newEGroupKeyName + iter]) {
			iter++
		}

		const newGroup: StudioRouteSetExclusivityGroup = {
			name: 'New Exclusivity Group',
		}
		const setObject: Record<string, any> = {}
		setObject['routeSetExclusivityGroups.' + newEGroupKeyName + iter] = newGroup

		Studios.update(studio._id, {
			$set: setObject,
		})
	}

	return (
		<div>
			<h2 className="mhn mbs">{t('Route Sets')}</h2>
			{!manifest && <span>{t('Add a playout device to the studio in order to configure the route sets')}</span>}
			{manifest && (
				<React.Fragment>
					<p className="mhn mvs text-s dimmed field-hint">
						{t(
							'Controls for exposed Route Sets will be displayed to the producer within the Rundown View in the Switchboard.'
						)}
					</p>
					<h3 className="mhn">{t('Exclusivity Groups')}</h3>
					<table className="expando settings-studio-mappings-table">
						<tbody>
							{RenderExclusivityGroups({
								studio: studio,
								toggleExpanded: toggleExpanded,
								isExpanded: isExpanded('exclusivityGroup'),
								getRouteSetsFromOverrides: getRouteSetsFromOverrides,
							})}
						</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={() => addNewExclusivityGroup()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
					<h3 className="mhn">{t('Route Sets')}</h3>
					<table className="expando settings-studio-mappings-table">
						<tbody>
							{_.map(getRouteSetsFromOverrides, (routeSet: WrappedOverridableItem<StudioRouteSet>) => {
								return (
									<React.Fragment key={routeSet.id}>
										{routeSet.type === 'normal'
											? RenderRouteSet({
													routeSet: routeSet,
													manifest: manifest,
													studio: studio,
													translationNamespaces: translationNamespaces,
													studioMappings: studioMappings,
													toggleExpanded: toggleExpanded,
													isExpanded: isExpanded(routeSet.id),
													overrideHelper: overrideHelper,
											  })
											: RenderRouteSetDeletedEntry({ routeSet: routeSet })}
									</React.Fragment>
								)
							})}
						</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={() => addNewRouteSet()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</React.Fragment>
			)}
		</div>
	)
}

interface IRenderRouteSetProps {
	routeSet: WrappedOverridableItemNormal<StudioRouteSet>
	manifest: MappingsSettingsManifests
	studio: DBStudio
	translationNamespaces: string[]
	studioMappings: ReadonlyDeep<MappingsExt>
	toggleExpanded: (layerId: string, force?: boolean) => void
	isExpanded: boolean
	overrideHelper: OverrideOpHelper
}

function RenderRouteSet({
	routeSet,
	manifest,
	studio,
	translationNamespaces,
	toggleExpanded,
	isExpanded,
	studioMappings,
	overrideHelper,
}: Readonly<IRenderRouteSetProps>): React.JSX.Element {
	const { t } = useTranslation()
	const toggleEditRouteSet = React.useCallback(() => toggleExpanded(routeSet.id), [toggleExpanded, routeSet.id])

	const confirmRemove = (routeSetId: string) => {
		doModalDialog({
			title: t('Remove this Route Set?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeRouteSet(routeSetId)
			},
			message: (
				<React.Fragment>
					<p>{t('Are you sure you want to remove the Route Set "{{routeId}}"?', { routeId: routeSetId })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	const removeRouteSet = (routeId: string) => {
		overrideHelper.deleteItem(routeId)
	}

	const addNewRouteInSet = (routeId: string) => {
		console.log(routeId)
		/*			
			const newRouteKeyName = 'newRouteSet'
			let iter = 0
			while ((getRouteSetsFromOverrides() || {})[newRouteKeyName + iter]) {
				iter++
			}

			const newRoute: RouteMapping = {
				mappedLayer: '',
				outputMappedLayer: '',
				remapping: {},
				routeType: StudioRouteType.REROUTE,
			}
			const setObject: Record<string, any> = {}
			setObject['routeSets.' + routeId + '.routes'] = newRoute

			Studios.update(studio._id, {
				$push: setObject,
			})
			*/
	}

	const updateRouteSetId = React.useCallback(
		(newRouteSetId: string) => {
			overrideHelper.changeItemId(routeSet.id, newRouteSetId)
			toggleExpanded(newRouteSetId, true)
		},
		[overrideHelper, toggleExpanded, routeSet.id]
	)

	const DEFAULT_ACTIVE_OPTIONS = {
		[t('Active')]: true,
		[t('Not Active')]: false,
		[t('Not defined')]: undefined,
	}

	if (Object.keys(studio.routeSets).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no Route Sets set up.')}</td>
			</tr>
		)
	}

	return (
		<React.Fragment key={routeSet.id}>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-device__name c2">{routeSet.id}</th>
				<td className="settings-studio-device__id c3">{routeSet.computed?.name}</td>
				<td className="settings-studio-device__id c4">{routeSet.computed?.exclusivityGroup}</td>
				<td className="settings-studio-device__id c2">{routeSet.computed?.routes.length}</td>
				<td className="settings-studio-device__id c2">
					{routeSet.computed?.active ? <span className="pill">{t('Active')}</span> : null}
				</td>

				<td className="settings-studio-device__actions table-item-actions c3">
					<button className="action-btn" onClick={toggleEditRouteSet}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={() => confirmRemove(routeSet.id)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Route Set ID')} />
								<TextInputControl
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									value={routeSet.id}
									handleUpdate={updateRouteSetId}
									disabled={!!routeSet.defaults}
								/>
							</label>
							<label className="field">
								<LabelActual label={t('Default State')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`routeSets.${routeSet.id}.defaultActive`}
									obj={studio}
									type="dropdown"
									collection={Studios}
									options={DEFAULT_ACTIVE_OPTIONS}
									className="input text-input input-l"
								></EditAttribute>
								<span className="mlm text-s dimmed field-hint">{t('The default state of this Route Set')}</span>
							</label>
							<div>
								<LabelAndOverridesForCheckbox
									label={t('Active')}
									item={routeSet}
									itemKey={'active'}
									opPrefix={routeSet.id}
									overrideHelper={overrideHelper}
								>
									{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
								</LabelAndOverridesForCheckbox>
								<LabelAndOverrides
									label={t('Route Set Name')}
									item={routeSet}
									itemKey={'name'}
									opPrefix={routeSet.id}
									overrideHelper={overrideHelper}
								>
									{(value, handleUpdate) => (
										<TextInputControl
											modifiedClassName="bghl"
											classNames="input text-input input-l"
											value={value}
											handleUpdate={handleUpdate}
										/>
									)}
								</LabelAndOverrides>
							</div>

							<label className="field">
								<LabelActual label={t('Exclusivity group')} />
								<div>
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`routeSets.${routeSet.id}.exclusivityGroup`}
										obj={studio}
										type="checkbox"
										className="mrs mvxs"
										collection={Studios}
										mutateDisplayValue={(v) => (v === undefined ? false : true)}
										mutateUpdateValue={() => undefined}
									/>
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`routeSets.${routeSet.id}.exclusivityGroup`}
										obj={studio}
										type="dropdown"
										options={Object.keys(studio.routeSetExclusivityGroups)}
										mutateDisplayValue={(v) => (v === undefined ? 'None' : v)}
										collection={Studios}
										className="input text-input input-l"
									></EditAttribute>
								</div>
								<span className="text-s dimmed field-hint">
									{t('If set, only one Route Set will be active per exclusivity group')}
								</span>
							</label>
							<label className="field">
								<LabelActual label={t('Behavior')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`routeSets.${routeSet.id}.behavior`}
									obj={studio}
									type="dropdown"
									options={StudioRouteBehavior}
									optionsAreNumbers={true}
									collection={Studios}
									className="input text-input input-l"
								></EditAttribute>
								<span className="text-s dimmed field-hint">
									{t('The way this Route Set should behave towards the user')}
								</span>
							</label>
						</div>
						<RenderRoutes
							routeSet={routeSet}
							routeSetId={routeSet.id}
							studio={studio}
							manifest={manifest}
							translationNamespaces={translationNamespaces}
							overrideHelper={overrideHelper}
							studioMappings={studioMappings}
						/>
						<div className="mod">
							<button className="btn btn-primary right" onClick={() => toggleExpanded(routeSet.id)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
							<button className="btn btn-secondary" onClick={() => addNewRouteInSet(routeSet.id)}>
								<FontAwesomeIcon icon={faPlus} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}

interface IRenderRouteSetDeletedProps {
	routeSet: WrappedOverridableItemDeleted<StudioRouteSet>
	// manifest: MappingsSettingsManifests
	// studio: DBStudio
	// translationNamespaces: string[]
	// studioMappings: ReadonlyDeep<MappingsExt>
	// toggleExpanded: (layerId: string, force?: boolean) => void
	// isExpanded: boolean
	// overrideHelper: OverrideOpHelper
}

function RenderRouteSetDeletedEntry({ routeSet }: Readonly<IRenderRouteSetDeletedProps>) {
	const { t } = useTranslation()

	const doUndelete = (routeSetId: string) => {
		console.log(t('doUndelete, not implemented yet :'), routeSetId)
	}

	const doUndeleteItem = React.useCallback(() => doUndelete(routeSet.id), [doUndelete, routeSet.id])

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">{routeSet.defaults.name}</th>
			<td className="settings-studio-device__id c2 deleted">{routeSet.defaults.name}</td>
			<td className="settings-studio-device__id c2 deleted">{routeSet.id}</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface IRenderRoutesProps {
	routeSet: WrappedOverridableItem<StudioRouteSet>
	studio: DBStudio
	routeSetId: string
	manifest: MappingsSettingsManifests
	translationNamespaces: string[]
	overrideHelper: OverrideOpHelper
	studioMappings: ReadonlyDeep<MappingsExt>
}

function RenderRoutes({
	routeSet,
	routeSetId,
	studio,
	manifest,
	translationNamespaces,
	overrideHelper,
	studioMappings,
}: Readonly<IRenderRoutesProps>): React.JSX.Element {
	const { t } = useTranslation()

	const confirmRemoveRoute = (routeSetId: string, route: RouteMapping) => {
		doModalDialog({
			title: t('Remove this Route from this Route Set?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeRouteSetRoute(routeSetId)
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to remove the Route from "{{sourceLayerId}}" to "{{newLayerId}}"?', {
							sourceLayerId: route.mappedLayer,
							newLayerId: route.outputMappedLayer,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	const removeRouteSetRoute = (routeId: string) => {
		overrideHelper.deleteItem(routeId)
	}

	return (
		<React.Fragment>
			<h4 className="mod mhs">{t('Routes')}</h4>
			{routeSet.computed?.routes.length === 0 ? (
				<p className="text-s dimmed field-hint mhs">{t('There are no routes set up yet')}</p>
			) : null}
			{routeSet.computed?.routes.map((route, index) => {
				const mappedLayer = route.mappedLayer ? studioMappings[route.mappedLayer] : undefined
				const deviceTypeFromMappedLayer: TSR.DeviceType | undefined = mappedLayer?.device

				const routeDeviceType: TSR.DeviceType | undefined =
					route.routeType === StudioRouteType.REMAP
						? route.deviceType
						: route.mappedLayer
						? deviceTypeFromMappedLayer
						: route.deviceType

				const routeMappingSchema = manifest[(routeDeviceType ?? route.remapping?.device) as TSR.DeviceType]

				const rawMappingTypeOptions = Object.entries<JSONSchema>(routeMappingSchema?.mappingsSchema || {})
				const mappingTypeOptions = rawMappingTypeOptions.map(([id, entry], i) =>
					literal<DropdownInputOption<string | number>>({
						value: id + '',
						name: entry?.title ?? id + '',
						i,
					})
				)

				return (
					<div className="route-sets-editor mod pan mas" key={index}>
						<button className="action-btn right mod man pas" onClick={() => confirmRemoveRoute(routeSetId, route)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Original Layer')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`routeSets.${routeSetId}.routes.${index}.mappedLayer`}
									obj={studio}
									type="dropdowntext"
									options={Object.keys(studioMappings)}
									label={t('None')}
									collection={Studios}
									className="input text-input input-l"
								></EditAttribute>
							</label>
							<label className="field">
								<LabelActual label={t('New Layer')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`routeSets.${routeSetId}.routes.${index}.outputMappedLayer`}
									obj={studio}
									type="text"
									collection={Studios}
									className="input text-input input-l"
								></EditAttribute>
							</label>

							<label className="field">
								<LabelActual label={t('Route Type')} />
								{!route.mappedLayer ? (
									<span className="mls">REMAP</span>
								) : (
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`routeSets.${routeSetId}.routes.${index}.routeType`}
										obj={studio}
										type="dropdown"
										options={StudioRouteType}
										optionsAreNumbers={true}
										collection={Studios}
										className="input text-input input-l"
									></EditAttribute>
								)}
							</label>

							<label className="field">
								<LabelActual label={t('Device Type')} />
								{route.routeType === StudioRouteType.REROUTE && route.mappedLayer ? (
									deviceTypeFromMappedLayer !== undefined ? (
										<span className="mls">{TSR.DeviceType[deviceTypeFromMappedLayer]}</span>
									) : (
										<span className="mls dimmed">{t('Source Layer not found')}</span>
									)
								) : (
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`routeSets.${routeSetId}.routes.${index}.deviceType`}
										obj={studio}
										type="dropdown"
										options={TSR.DeviceType}
										optionsAreNumbers={true}
										collection={Studios}
										className="input text-input input-l"
									></EditAttribute>
								)}
							</label>

							{mappingTypeOptions.length > 0 && (
								<label className="field">
									<LabelActual label={t('Mapping Type')} />
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`routeSets.${routeSetId}.routes.${index}.remapping.options.mappingType`}
										obj={studio}
										type="dropdown"
										options={mappingTypeOptions}
										collection={Studios}
										className="input text-input input-l"
									></EditAttribute>
								</label>
							)}
							{route.routeType === StudioRouteType.REMAP ||
							(routeDeviceType !== undefined && route.remapping !== undefined) ? (
								<>
									<label className="field">
										<LabelActual label={t('Device ID')} />
										<div>
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSetId}.routes.${index}.remapping.deviceId`}
												obj={studio}
												type="checkbox"
												collection={Studios}
												className="mrs mvxs"
												mutateDisplayValue={(v) => (v === undefined ? false : true)}
												mutateUpdateValue={() => undefined}
											/>
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSetId}.routes.${index}.remapping.deviceId`}
												obj={studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
										</div>
									</label>

									<DeviceMappingSettings
										translationNamespaces={translationNamespaces}
										studio={studio}
										attribute={`routeSets.${routeSetId}.routes.${index}.remapping.options`}
										mappedLayer={mappedLayer}
										manifest={routeMappingSchema}
									/>
								</>
							) : null}
						</div>
					</div>
				)
			})}
		</React.Fragment>
	)
}

interface IRenderExclusivityGroupsProps {
	studio: DBStudio
	toggleExpanded: (exclusivityGroupId: string, force?: boolean) => void
	isExpanded: boolean
	getRouteSetsFromOverrides: WrappedOverridableItem<StudioRouteSet>[]
}

function RenderExclusivityGroups({
	studio,
	toggleExpanded,
	isExpanded,
	getRouteSetsFromOverrides,
}: Readonly<IRenderExclusivityGroupsProps>): React.JSX.Element {
	const { t } = useTranslation()

	const updateExclusivityGroupId = (edit: EditAttributeBase, newValue: string) => {
		const oldRouteId = edit.props.overrideDisplayValue
		const newRouteId = newValue + ''
		const route = studio.routeSetExclusivityGroups[oldRouteId]

		if (studio.routeSetExclusivityGroups[newRouteId]) {
			throw new Meteor.Error(400, 'Exclusivity Group "' + newRouteId + '" already exists')
		}

		const mSet: Record<string, any> = {}
		const mUnset: Record<string, 1> = {}
		mSet['routeSetExclusivityGroups.' + newRouteId] = route
		mUnset['routeSetExclusivityGroups.' + oldRouteId] = 1

		if (edit.props.collection) {
			edit.props.collection.update(studio._id, {
				$set: mSet,
				$unset: mUnset,
			})
		}

		toggleExpanded(oldRouteId)
		toggleExpanded(newRouteId)
	}

	const removeExclusivityGroup = (eGroupId: string) => {
		const unsetObject: Record<string, 1> = {}
		_.forEach(getRouteSetsFromOverrides, (routeSet, routeSetId) => {
			if (routeSet.computed?.exclusivityGroup === eGroupId) {
				unsetObject['routeSets.' + routeSetId + '.exclusivityGroup'] = 1
			}
		})
		unsetObject['routeSetExclusivityGroups.' + eGroupId] = 1
		Studios.update(studio._id, {
			$unset: unsetObject,
		})
	}

	const confirmRemoveEGroup = (eGroupId: string, exclusivityGroup: StudioRouteSetExclusivityGroup) => {
		doModalDialog({
			title: t('Remove this Exclusivity Group?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeExclusivityGroup(eGroupId)
			},
			message: (
				<React.Fragment>
					<p>
						{t(
							'Are you sure you want to remove exclusivity group "{{eGroupName}}"?\nRoute Sets assigned to this group will be reset to no group.',
							{
								eGroupName: exclusivityGroup.name,
							}
						)}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	if (Object.keys(studio.routeSetExclusivityGroups).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no exclusivity groups set up.')}</td>
			</tr>
		)
	}
	return (
		<React.Fragment>
			{_.map(
				studio.routeSetExclusivityGroups,
				(exclusivityGroup: StudioRouteSetExclusivityGroup, exclusivityGroupId: string) => {
					return (
						<React.Fragment key={exclusivityGroupId}>
							<tr
								className={ClassNames({
									hl: isExpanded,
								})}
							>
								<th className="settings-studio-device__name c3">{exclusivityGroupId}</th>
								<td className="settings-studio-device__id c5">{exclusivityGroup.name}</td>
								<td className="settings-studio-device__id c3">
									{
										_.filter(
											getRouteSetsFromOverrides,
											(routeSet) => routeSet.computed?.exclusivityGroup === exclusivityGroupId
										).length
									}
								</td>

								<td className="settings-studio-device__actions table-item-actions c3">
									<button className="action-btn" onClick={() => toggleExpanded(exclusivityGroupId)}>
										<FontAwesomeIcon icon={faPencilAlt} />
									</button>
									<button
										className="action-btn"
										onClick={() => confirmRemoveEGroup(exclusivityGroupId, exclusivityGroup)}
									>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</td>
							</tr>
							{isExpanded && (
								<tr className="expando-details hl">
									<td colSpan={6}>
										<div className="properties-grid">
											<label className="field">
												<LabelActual label={t('Exclusivity Group ID')} />
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'routeSetExclusivityGroups'}
													overrideDisplayValue={exclusivityGroupId}
													obj={studio}
													type="text"
													collection={Studios}
													updateFunction={updateExclusivityGroupId}
													className="input text-input input-l"
												></EditAttribute>
											</label>
											<label className="field">
												<LabelActual label={t('Exclusivity Group Name')} />
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'routeSetExclusivityGroups.' + exclusivityGroupId + '.name'}
													obj={studio}
													type="text"
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
												<span className="text-s dimmed field-hint">{t('Display name of the Exclusivity Group')}</span>
											</label>
										</div>
										<div className="mod alright">
											<button className="btn btn-primary" onClick={() => toggleExpanded(exclusivityGroupId)}>
												<FontAwesomeIcon icon={faCheck} />
											</button>
										</div>
									</td>
								</tr>
							)}
						</React.Fragment>
					)
				}
			)}
		</React.Fragment>
	)
}
interface IDeviceMappingSettingsProps {
	translationNamespaces: string[]
	studio: DBStudio
	attribute: string
	manifest: MappingsSettingsManifest | undefined
	mappedLayer: ReadonlyDeep<MappingExt> | undefined
}

function DeviceMappingSettings({
	translationNamespaces,
	attribute,
	manifest,
	studio,
	mappedLayer,
}: IDeviceMappingSettingsProps) {
	const routeRemapping = objectPathGet(studio, attribute)

	const mappingType = routeRemapping?.mappingType ?? mappedLayer?.options?.mappingType
	const mappingSchema = manifest?.mappingsSchema?.[mappingType]

	if (mappingSchema && routeRemapping) {
		return (
			<SchemaFormForCollection
				schema={mappingSchema}
				object={routeRemapping}
				basePath={attribute}
				translationNamespaces={translationNamespaces}
				collection={Studios}
				objectId={studio._id}
				partialOverridesForObject={mappedLayer}
			/>
		)
	} else {
		return null
	}
}
