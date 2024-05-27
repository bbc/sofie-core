import ClassNames from 'classnames'
import * as React from 'react'
import {
	DBStudio,
	StudioRouteSet,
	StudioRouteBehavior,
	RouteMapping,
	StudioRouteSetExclusivityGroup,
	StudioRouteType,
	MappingsExt,
	MappingExt,
	StudioAbPlayerDisabling,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { doModalDialog } from '../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { TSR } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { MappingsSettingsManifest, MappingsSettingsManifests } from './Mappings'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	DropdownInputControl,
	DropdownInputOption,
	getDropdownInputOptions,
} from '../../../lib/Components/DropdownInput'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { Studios } from '../../../collections'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
} from '../../../lib/Components/LabelAndOverrides'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
	getAllCurrentAndDeletedItemsFromOverrides,
	useOverrideOpHelper,
} from '../../util/OverrideOpHelper'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { CheckboxControl } from '../../../lib/Components/Checkbox'
import { OverrideOpHelperArrayTable } from '../../../lib/forms/SchemaFormTable/ArrayTableOpHelper'
import { hasOpWithPath } from '../../../lib/Components/util'
import { SchemaFormWithOverrides } from '../../../lib/forms/SchemaFormWithOverrides'

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

	const routeSetsFromOverrides = React.useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(studio.routeSetsWithOverrides, (a, b) => a[0].localeCompare(b[0])),
		[studio.routeSetsWithOverrides]
	)

	const exclusivityGroupsFromOverrides = React.useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(studio.routeSetExclusivityGroupsWithOverrides, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[studio.routeSetExclusivityGroupsWithOverrides]
	)

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'routeSetsWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.routeSetsWithOverrides)

	const addNewRouteSet = React.useCallback(() => {
		const resolvedRouteSets = applyAndValidateOverrides(studio.routeSetsWithOverrides).obj

		// find free key name
		const newRouteKeyName = 'newRouteSet'
		let iter = 0
		while (resolvedRouteSets[newRouteKeyName + iter.toString()]) {
			iter++
		}

		const newId = newRouteKeyName + iter.toString()
		const newRoute = literal<StudioRouteSet>({
			name: 'New Route Set ' + iter.toString(),
			active: false,
			routes: [],
			abPlayers: [],
			behavior: StudioRouteBehavior.TOGGLE,
			exclusivityGroup: undefined,
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newRoute,
		})

		Studios.update(studio._id, {
			$push: {
				'routeSetsWithOverrides.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.routeSetsWithOverrides])

	const addNewExclusivityGroup = React.useCallback(() => {
		const newGroupKeyName = 'exclusivityGroup'
		const resolvedGroups = applyAndValidateOverrides(studio.routeSetExclusivityGroupsWithOverrides).obj

		let iter = 0
		while (resolvedGroups[newGroupKeyName + iter.toString()]) {
			iter++
		}

		const newId = newGroupKeyName + iter.toString()
		const newGroup: StudioRouteSetExclusivityGroup = {
			name: 'New Exclusivity Group' + iter.toString(),
		}
		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newGroup,
		})

		Studios.update(studio._id, {
			$push: {
				'routeSetExclusivityGroupsWithOverrides.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.routeSetExclusivityGroupsWithOverrides])

	if (Object.keys(studio.routeSetsWithOverrides).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no Route Sets set up.')}</td>
			</tr>
		)
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
							<RenderExclusivityGroups
								studio={studio}
								routeSetsFromOverrides={routeSetsFromOverrides}
								isExpanded={isExpanded}
								toggleExpanded={toggleExpanded}
								exclusivityGroupsFromOverrides={exclusivityGroupsFromOverrides}
							/>
						</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={addNewExclusivityGroup}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
					<h3 className="mhn">{t('Route Sets')}</h3>
					<table className="expando settings-studio-mappings-table">
						<tbody>
							{routeSetsFromOverrides.map((routeSet: WrappedOverridableItem<StudioRouteSet>) => {
								return (
									<React.Fragment key={routeSet.id}>
										{routeSet.type === 'normal' ? (
											<RenderRouteSet
												routeSet={routeSet}
												manifest={manifest}
												translationNamespaces={translationNamespaces}
												studioMappings={studioMappings}
												toggleExpanded={toggleExpanded}
												isExpanded={isExpanded(routeSet.id)}
												overrideHelper={overrideHelper}
												exclusivityGroupsFromOverrides={exclusivityGroupsFromOverrides}
											/>
										) : (
											<RenderRouteSetDeletedEntry routeSet={routeSet} overrideHelper={overrideHelper} />
										)}
									</React.Fragment>
								)
							})}
						</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={addNewRouteSet}>
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
	translationNamespaces: string[]
	studioMappings: ReadonlyDeep<MappingsExt>
	toggleExpanded: (layerId: string, force?: boolean) => void
	isExpanded: boolean
	overrideHelper: OverrideOpHelper
	exclusivityGroupsFromOverrides: WrappedOverridableItem<StudioRouteSetExclusivityGroup>[]
}

function RenderRouteSet({
	routeSet,
	manifest,
	translationNamespaces,
	toggleExpanded,
	isExpanded,
	studioMappings,
	overrideHelper,
	exclusivityGroupsFromOverrides,
}: Readonly<IRenderRouteSetProps>): React.JSX.Element {
	const { t } = useTranslation()
	const toggleEditRouteSet = React.useCallback(() => toggleExpanded(routeSet.id), [toggleExpanded, routeSet.id])

	const confirmRemove = (routeSetId: string) => {
		doModalDialog({
			title: t('Remove this Route Set?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper.deleteItem(routeSetId)
			},
			message: (
				<React.Fragment>
					<p>{t('Are you sure you want to remove the Route Set "{{routeId}}"?', { routeId: routeSetId })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	const addNewRouteInSet = (routeId: string) => {
		const newRoutes = routeSet.computed?.routes || []

		newRoutes.push({
			mappedLayer: '',
			outputMappedLayer: '',
			remapping: {},
			routeType: StudioRouteType.REROUTE,
		})

		overrideHelper.setItemValue(routeId, 'routes', newRoutes)
	}

	const addNewAbPlayerInSet = (routeId: string) => {
		const newAbPlayers = routeSet.computed?.abPlayers || []

		newAbPlayers.push({
			poolName: '',
			playerId: '',
		})

		overrideHelper.setItemValue(routeId, 'abPlayers', newAbPlayers)
	}

	const updateRouteSetId = React.useCallback(
		(newRouteSetId: string) => {
			overrideHelper.changeItemId(routeSet.id, newRouteSetId)
			toggleExpanded(newRouteSetId, true)
		},
		[overrideHelper, toggleExpanded, routeSet.id]
	)

	const exclusivityGroupOptions = React.useMemo(() => {
		return getDropdownInputOptions([
			{
				name: 'None',
				value: undefined,
			},
			...exclusivityGroupsFromOverrides
				.filter((group) => group.type === 'normal')
				.map((group) => group.computed?.name || group.id),
		])
	}, [exclusivityGroupsFromOverrides])

	const DEFAULT_ACTIVE_OPTIONS = {
		[t('Active')]: true,
		[t('Not Active')]: false,
		[t('Not defined')]: undefined,
	}

	const resyncRoutesTable = React.useCallback(
		() => overrideHelper.clearItemOverrides(routeSet.id, 'routes'),
		[overrideHelper, routeSet.id]
	)
	const routesIsOverridden = hasOpWithPath(routeSet.overrideOps, routeSet.id, 'routes')

	const resyncAbPlayerTable = React.useCallback(
		() => overrideHelper.clearItemOverrides(routeSet.id, 'abPlayers'),
		[overrideHelper, routeSet.id]
	)
	const abPlayerIsOverridden = hasOpWithPath(routeSet.overrideOps, routeSet.id, 'abPlayers')

	return (
		<React.Fragment>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-device__name c2">{routeSet.id}</th>
				<td className="settings-studio-device__id c3">{routeSet.computed?.name}</td>
				<td className="settings-studio-device__id c4">{routeSet.computed?.exclusivityGroup}</td>
				<td className="settings-studio-device__id c2">{routeSet.computed?.routes?.length}</td>
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
							<LabelAndOverridesForDropdown
								label={t('Default State')}
								hint={t('he default state of this Route Set')}
								item={routeSet}
								itemKey={'defaultActive'}
								opPrefix={routeSet.id}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(DEFAULT_ACTIVE_OPTIONS)}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl
										classNames="input text-input input-l"
										options={options}
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverridesForDropdown>
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

							<LabelAndOverridesForDropdown
								label={'Exclusivity group'}
								hint={t('If set, only one Route Set will be active per exclusivity group')}
								item={routeSet}
								itemKey={'exclusivityGroup'}
								opPrefix={routeSet.id}
								overrideHelper={overrideHelper}
								options={exclusivityGroupOptions}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl
										classNames="input text-input input-l"
										options={options}
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverridesForDropdown>

							<LabelAndOverridesForDropdown
								label={t('Behavior')}
								hint={t('The way this Route Set should behave towards the user')}
								item={routeSet}
								itemKey={'behavior'}
								opPrefix={routeSet.id}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(StudioRouteBehavior)}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl
										classNames="input text-input input-l"
										options={options}
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverridesForDropdown>
						</div>
						<RenderRoutes
							routeSet={routeSet}
							manifest={manifest}
							translationNamespaces={translationNamespaces}
							overrideHelper={overrideHelper}
							studioMappings={studioMappings}
						/>
						<div className="mod">
							<button className="btn btn-secondary" onClick={() => addNewRouteInSet(routeSet.id)}>
								<FontAwesomeIcon icon={faPlus} />
							</button>
							&nbsp;
							{routeSet.defaults && (
								<button
									className="btn btn-primary"
									onClick={resyncRoutesTable}
									title="Reset to default"
									disabled={!routesIsOverridden}
								>
									{t('Reset')}
									&nbsp;
									<FontAwesomeIcon icon={faSync} />
								</button>
							)}
						</div>
						<RenderAbPlayers routeSet={routeSet} overrideHelper={overrideHelper} />
						<div className="mod">
							<button className="btn btn-primary right" onClick={() => toggleExpanded(routeSet.id)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
							<button className="btn btn-secondary" onClick={() => addNewAbPlayerInSet(routeSet.id)}>
								<FontAwesomeIcon icon={faPlus} />
							</button>
							&nbsp;
							{routeSet.defaults && (
								<button
									className="btn btn-primary"
									onClick={resyncAbPlayerTable}
									title="Reset to default"
									disabled={!abPlayerIsOverridden}
								>
									{t('Reset')}
									&nbsp;
									<FontAwesomeIcon icon={faSync} />
								</button>
							)}
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}

interface IRenderRouteSetDeletedProps {
	routeSet: WrappedOverridableItemDeleted<StudioRouteSet>
	overrideHelper: OverrideOpHelper
}

function RenderRouteSetDeletedEntry({ routeSet, overrideHelper }: Readonly<IRenderRouteSetDeletedProps>) {
	const doUndeleteItem = React.useCallback(() => overrideHelper.resetItem(routeSet.id), [overrideHelper, routeSet.id])

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
	routeSet: WrappedOverridableItemNormal<StudioRouteSet>
	manifest: MappingsSettingsManifests
	translationNamespaces: string[]
	overrideHelper: OverrideOpHelper
	studioMappings: ReadonlyDeep<MappingsExt>
}

function RenderRoutes({
	routeSet,
	manifest,
	translationNamespaces,
	overrideHelper,
	studioMappings,
}: Readonly<IRenderRoutesProps>): React.JSX.Element {
	const { t } = useTranslation()

	const routesBuffer = routeSet.computed.routes

	const tableOverrideHelper = React.useMemo(
		() => new OverrideOpHelperArrayTable(overrideHelper, routeSet.id, routesBuffer, 'routes'),
		[overrideHelper, routeSet.id, routesBuffer]
	)

	const confirmRemoveRoute = React.useCallback(
		(route: WrappedOverridableItemNormal<RouteMapping>) => {
			doModalDialog({
				title: t('Remove this Route from this Route Set?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					tableOverrideHelper.deleteRow(route.id)
				},
				message: (
					<>
						<p>
							{t('Are you sure you want to remove the Route from "{{sourceLayerId}}" to "{{newLayerId}}"?', {
								sourceLayerId: route.computed.mappedLayer,
								newLayerId: route.computed.outputMappedLayer,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</>
				),
			})
		},
		[tableOverrideHelper]
	)

	return (
		<>
			<h4 className="mod mhs">{t('Routes')}</h4>
			{routeSet.computed?.routes?.length === 0 ? (
				<p className="text-s dimmed field-hint mhs">{t('There are no routes set up yet')}</p>
			) : null}
			{routesBuffer.map((route, index) => (
				<RenderRoutesRow
					key={index}
					manifest={manifest}
					translationNamespaces={translationNamespaces}
					tableOverrideHelper={tableOverrideHelper}
					studioMappings={studioMappings}
					rawRoute={route}
					routeIndex={index}
					confirmRemoveRoute={confirmRemoveRoute}
				/>
			))}
		</>
	)
}

interface RenderRoutesRowProps {
	manifest: MappingsSettingsManifests
	translationNamespaces: string[]
	tableOverrideHelper: OverrideOpHelperArrayTable
	studioMappings: ReadonlyDeep<MappingsExt>
	rawRoute: RouteMapping
	routeIndex: number
	confirmRemoveRoute: (route: WrappedOverridableItemNormal<RouteMapping>) => void
}

function RenderRoutesRow({
	manifest,
	translationNamespaces,
	tableOverrideHelper,
	studioMappings,
	rawRoute,
	routeIndex,
	confirmRemoveRoute,
}: Readonly<RenderRoutesRowProps>): React.JSX.Element {
	const { t } = useTranslation()

	const mappedLayer = rawRoute.mappedLayer ? studioMappings[rawRoute.mappedLayer] : undefined
	const deviceTypeFromMappedLayer: TSR.DeviceType | undefined = mappedLayer?.device

	const routeDeviceType: TSR.DeviceType | undefined =
		rawRoute.routeType === StudioRouteType.REMAP
			? rawRoute.deviceType
			: rawRoute.mappedLayer
			? deviceTypeFromMappedLayer
			: rawRoute.deviceType

	const routeMappingSchema = manifest[(routeDeviceType ?? rawRoute.remapping?.device) as TSR.DeviceType]

	const mappingTypeOptions: DropdownInputOption<string | number>[] = React.useMemo(() => {
		const rawMappingTypeOptions = Object.entries<JSONSchema>(routeMappingSchema?.mappingsSchema || {})
		return rawMappingTypeOptions.map(([id, entry], i) =>
			literal<DropdownInputOption<string | number>>({
				value: id + '',
				name: entry?.title ?? id + '',
				i,
			})
		)
	}, [routeMappingSchema?.mappingsSchema])

	const route = React.useMemo(
		() =>
			literal<WrappedOverridableItemNormal<RouteMapping>>({
				type: 'normal',
				id: routeIndex + '',
				computed: rawRoute,
				defaults: undefined,
				overrideOps: [],
			}),
		[rawRoute, routeIndex]
	)

	const confirmRemoveRouteLocal = React.useCallback(() => confirmRemoveRoute(route), [confirmRemoveRoute, route])

	return (
		<div className="route-sets-editor mod pan mas">
			<button className="action-btn right mod man pas" onClick={confirmRemoveRouteLocal}>
				<FontAwesomeIcon icon={faTrash} />
			</button>
			<div className="properties-grid">
				<LabelAndOverridesForDropdown
					label={t('Original Layer')}
					item={route}
					itemKey={'mappedLayer'}
					opPrefix={route.id}
					overrideHelper={tableOverrideHelper}
					options={getDropdownInputOptions(Object.keys(studioMappings))}
				>
					{(value, handleUpdate, options) => (
						<DropdownInputControl
							classNames="input text-input input-l"
							options={options}
							value={value}
							handleUpdate={handleUpdate}
						/>
					)}
				</LabelAndOverridesForDropdown>

				<LabelAndOverrides
					label={t('New Layer')}
					item={route}
					itemKey={'outputMappedLayer'}
					opPrefix={route.id}
					overrideHelper={tableOverrideHelper}
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

				<LabelAndOverridesForDropdown
					label={t('Route Type')}
					item={route}
					itemKey={'routeType'}
					opPrefix={route.id}
					overrideHelper={tableOverrideHelper}
					options={getDropdownInputOptions(StudioRouteType)}
				>
					{(value, handleUpdate, options) => {
						if (!rawRoute.mappedLayer) {
							return <span className="mls">REMAP</span>
						} else {
							return (
								<DropdownInputControl
									classNames="input text-input input-l"
									options={options}
									value={value}
									handleUpdate={handleUpdate}
								/>
							)
						}
					}}
				</LabelAndOverridesForDropdown>

				<LabelAndOverridesForDropdown
					label={t('Device Type')}
					item={route}
					itemKey={'deviceType'}
					opPrefix={route.id}
					overrideHelper={tableOverrideHelper}
					options={getDropdownInputOptions(TSR.DeviceType)}
				>
					{(value, handleUpdate, options) => {
						if (rawRoute.routeType === StudioRouteType.REROUTE && rawRoute.mappedLayer) {
							return deviceTypeFromMappedLayer !== undefined ? (
								<span className="mls">{TSR.DeviceType[deviceTypeFromMappedLayer]}</span>
							) : (
								<span className="mls dimmed">{t('Original Layer not found')}</span>
							)
						} else {
							return (
								<DropdownInputControl
									classNames="input text-input input-l"
									options={options}
									value={value}
									handleUpdate={handleUpdate}
								/>
							)
						}
					}}
				</LabelAndOverridesForDropdown>

				{mappingTypeOptions.length > 0 && (
					<LabelAndOverridesForDropdown<any> // Deep key is not allowed, but is fine for now
						label={t('Mapping Type')}
						item={route}
						itemKey={'remapping.options.mappingType'}
						opPrefix={route.id}
						overrideHelper={tableOverrideHelper}
						options={mappingTypeOptions}
					>
						{(value, handleUpdate, options) => (
							<DropdownInputControl
								classNames="input text-input input-l"
								options={options}
								value={value}
								handleUpdate={handleUpdate}
							/>
						)}
					</LabelAndOverridesForDropdown>
				)}
				{rawRoute.routeType === StudioRouteType.REMAP ||
				(routeDeviceType !== undefined && rawRoute.remapping !== undefined) ? (
					<>
						<LabelAndOverrides<any> // Deep key is not allowed, but is fine for now
							label={t('Device ID')}
							item={route}
							itemKey={'remapping.deviceId'}
							opPrefix={route.id}
							overrideHelper={tableOverrideHelper}
							showClearButton={true}
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

						<DeviceMappingSettings
							translationNamespaces={translationNamespaces}
							mappedLayer={mappedLayer}
							manifest={routeMappingSchema}
							overrideHelper={tableOverrideHelper}
							route={route}
						/>
					</>
				) : null}
			</div>
		</div>
	)
}

interface IDeviceMappingSettingsProps {
	translationNamespaces: string[]
	manifest: MappingsSettingsManifest | undefined
	mappedLayer: ReadonlyDeep<MappingExt> | undefined
	overrideHelper: OverrideOpHelperArrayTable
	route: WrappedOverridableItemNormal<RouteMapping>
}

function DeviceMappingSettings({
	translationNamespaces,
	manifest,
	mappedLayer,
	overrideHelper,
	route,
}: Readonly<IDeviceMappingSettingsProps>) {
	const mappingType = route.computed?.remapping?.options?.mappingType ?? mappedLayer?.options?.mappingType
	const mappingSchema = mappingType ? manifest?.mappingsSchema?.[mappingType] : undefined

	// Remove the required field from the schema, as that the properties show the clear button
	const mappingSchemaPartial = React.useMemo(() => {
		if (!mappingSchema) return null

		return { ...mappingSchema, required: [] }
	}, [mappingSchema])

	if (mappingSchemaPartial) {
		return (
			<SchemaFormWithOverrides
				schema={mappingSchemaPartial}
				translationNamespaces={translationNamespaces}
				attr={'remapping.options'}
				item={route}
				overrideHelper={overrideHelper}
				isRequired
				showClearButtonForNonRequiredFields={true}
			/>
		)
	} else {
		return null
	}
}

interface IRenderAbPlayersProps {
	routeSet: WrappedOverridableItemNormal<StudioRouteSet>
	overrideHelper: OverrideOpHelper
}

function RenderAbPlayers({ routeSet, overrideHelper }: Readonly<IRenderAbPlayersProps>): React.JSX.Element {
	const { t } = useTranslation()

	const abPlayersBuffer = routeSet.computed.abPlayers

	const tableOverrideHelper = React.useMemo(
		() => new OverrideOpHelperArrayTable(overrideHelper, routeSet.id, abPlayersBuffer, 'abPlayers'),
		[overrideHelper, routeSet.id, abPlayersBuffer]
	)

	const confirmRemoveAbPlayer = React.useCallback(
		(route: WrappedOverridableItemNormal<StudioAbPlayerDisabling>) => {
			doModalDialog({
				title: t('Remove this AB PLayers from this Route Set?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					tableOverrideHelper.deleteRow(route.id)
				},
				message: (
					<>
						<p>
							{t('Are you sure you want to remove the AB Player "{{playerId}}"?', {
								playerId: route.computed.playerId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</>
				),
			})
		},
		[tableOverrideHelper]
	)

	return (
		<>
			<h4 className="mod mhs">{t('AB Playout devices')}</h4>
			{routeSet.computed?.abPlayers?.length === 0 ? (
				<p className="text-s dimmed field-hint mhs">{t('There are no AB Playout devices set up yet')}</p>
			) : null}
			{abPlayersBuffer.map((route, index) => (
				<RenderAbPlayerRow
					key={index}
					tableOverrideHelper={tableOverrideHelper}
					abPlayers={routeSet.computed.abPlayers}
					rawRoute={route}
					routeIndex={index}
					confirmRemoveAbPlayer={confirmRemoveAbPlayer}
				/>
			))}
		</>
	)
}

interface RenderAbPlayerRowProps {
	tableOverrideHelper: OverrideOpHelperArrayTable
	abPlayers: StudioAbPlayerDisabling[]
	rawRoute: StudioAbPlayerDisabling
	routeIndex: number
	confirmRemoveAbPlayer: (route: WrappedOverridableItemNormal<any>) => void
}

function RenderAbPlayerRow({
	tableOverrideHelper,
	rawRoute,
	routeIndex,
	confirmRemoveAbPlayer,
}: Readonly<RenderAbPlayerRowProps>): React.JSX.Element {
	const { t } = useTranslation()

	const player = React.useMemo(
		() =>
			literal<WrappedOverridableItemNormal<StudioAbPlayerDisabling>>({
				type: 'normal',
				id: routeIndex + '',
				computed: rawRoute,
				defaults: undefined,
				overrideOps: [],
			}),
		[rawRoute, routeIndex]
	)

	const confirmRemoveRouteLocal = React.useCallback(
		() => confirmRemoveAbPlayer(player),
		[confirmRemoveAbPlayer, player]
	)

	return (
		<div className="route-sets-editor mod pan mas">
			<button className="action-btn right mod man pas" onClick={confirmRemoveRouteLocal}>
				<FontAwesomeIcon icon={faTrash} />
			</button>
			<div className="properties-grid">
				<LabelAndOverrides
					label={t('Pool PlayerId')}
					item={player}
					itemKey={'playerId'}
					opPrefix={player.id}
					overrideHelper={tableOverrideHelper}
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
				<LabelAndOverrides
					label={t('Pool name')}
					item={player}
					itemKey={'poolName'}
					opPrefix={player.id}
					overrideHelper={tableOverrideHelper}
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
		</div>
	)
}

interface IRenderExclusivityGroupsProps {
	studio: DBStudio
	toggleExpanded: (exclusivityGroupId: string, force?: boolean) => void
	isExpanded: (exclusivityGroupId: string) => boolean
	routeSetsFromOverrides: WrappedOverridableItem<StudioRouteSet>[]
	exclusivityGroupsFromOverrides: WrappedOverridableItem<StudioRouteSetExclusivityGroup>[]
}

function RenderExclusivityGroups({
	studio,
	toggleExpanded,
	isExpanded,
	routeSetsFromOverrides,
	exclusivityGroupsFromOverrides,
}: Readonly<IRenderExclusivityGroupsProps>): React.JSX.Element {
	const { t } = useTranslation()

	const saveExclusivityOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'routeSetExclusivityGroupsWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const exclusivityOverrideHelper = useOverrideOpHelper(
		saveExclusivityOverrides,
		studio.routeSetExclusivityGroupsWithOverrides
	)

	if (exclusivityGroupsFromOverrides.length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no exclusivity groups set up.')}</td>
			</tr>
		)
	}
	return (
		<React.Fragment>
			{exclusivityGroupsFromOverrides.map(
				(exclusivityGroup: WrappedOverridableItem<StudioRouteSetExclusivityGroup>) => {
					return (
						<React.Fragment key={exclusivityGroup.id}>
							{exclusivityGroup.type === 'normal' ? (
								<RenderExclusivityGroup
									exclusivityGroup={exclusivityGroup}
									toggleExpanded={toggleExpanded}
									isExpanded={isExpanded(exclusivityGroup.id)}
									routeSetsFromOverrides={routeSetsFromOverrides}
									exclusivityOverrideHelper={exclusivityOverrideHelper}
								/>
							) : (
								<RenderExclusivityDeletedGroup
									exclusivityGroup={exclusivityGroup}
									exlusivityOverrideHelper={exclusivityOverrideHelper}
								/>
							)}
						</React.Fragment>
					)
				}
			)}
		</React.Fragment>
	)
}

interface IRenderExclusivityGroupProps {
	exclusivityGroup: WrappedOverridableItemNormal<StudioRouteSetExclusivityGroup>
	toggleExpanded: (exclusivityGroupId: string, force?: boolean) => void
	isExpanded: boolean
	routeSetsFromOverrides: WrappedOverridableItem<StudioRouteSet>[]
	exclusivityOverrideHelper: OverrideOpHelper
}

function RenderExclusivityGroup({
	exclusivityGroup,
	toggleExpanded,
	isExpanded,
	routeSetsFromOverrides,
	exclusivityOverrideHelper,
}: Readonly<IRenderExclusivityGroupProps>): React.JSX.Element {
	const { t } = useTranslation()

	const removeExclusivityGroup = (eGroupId: string) => {
		exclusivityOverrideHelper.deleteItem(eGroupId)
	}

	const confirmRemoveEGroup = () => {
		doModalDialog({
			title: t('Remove this Exclusivity Group?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeExclusivityGroup(exclusivityGroup.id)
			},
			message: (
				<React.Fragment>
					<p>
						{t(
							'Are you sure you want to remove exclusivity group "{{eGroupName}}"?\nRoute Sets assigned to this group will be reset to no group.',
							{
								eGroupName: exclusivityGroup.computed?.name,
							}
						)}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}
	const updateExclusivityGroupId = React.useCallback(
		(newGroupId: string) => {
			exclusivityOverrideHelper.changeItemId(exclusivityGroup.id, newGroupId)
			toggleExpanded(newGroupId, true)
		},
		[exclusivityOverrideHelper, toggleExpanded, exclusivityGroup.id]
	)

	return (
		<React.Fragment>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-device__name c3">{exclusivityGroup.id}</th>
				<td className="settings-studio-device__id c5">{exclusivityGroup.computed?.name}</td>
				<td className="settings-studio-device__id c3">
					{
						routeSetsFromOverrides.filter(
							(routeSet) => routeSet.computed?.exclusivityGroup === exclusivityGroup.computed?.name
						).length
					}
				</td>

				<td className="settings-studio-device__actions table-item-actions c3">
					<button className="action-btn" onClick={() => toggleExpanded(exclusivityGroup.id)}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={confirmRemoveEGroup}>
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
								<TextInputControl
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									value={exclusivityGroup.id}
									handleUpdate={updateExclusivityGroupId}
									disabled={!!exclusivityGroup.defaults}
								/>
							</label>
							<LabelAndOverrides
								label={t('Exclusivity Group Name')}
								item={exclusivityGroup}
								itemKey={'name'}
								opPrefix={exclusivityGroup.id}
								overrideHelper={exclusivityOverrideHelper}
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
						<div className="mod alright">
							<button className="btn btn-primary" onClick={() => toggleExpanded(exclusivityGroup.id)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}

interface IRenderExclusivityDeletedGroupProps {
	exclusivityGroup: WrappedOverridableItemDeleted<StudioRouteSetExclusivityGroup>
	exlusivityOverrideHelper: OverrideOpHelper
}

function RenderExclusivityDeletedGroup({
	exclusivityGroup,
	exlusivityOverrideHelper: overrideHelper,
}: Readonly<IRenderExclusivityDeletedGroupProps>): React.JSX.Element {
	const doUndeleteItem = React.useCallback(
		() => overrideHelper.resetItem(exclusivityGroup.id),
		[overrideHelper, exclusivityGroup.id]
	)

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">
				{exclusivityGroup.defaults?.name}
			</th>
			<td className="settings-studio-device__id c2 deleted">{exclusivityGroup.defaults?.name}</td>
			<td className="settings-studio-device__id c2 deleted">{exclusivityGroup.id}</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}
