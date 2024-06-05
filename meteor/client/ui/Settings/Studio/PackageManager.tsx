import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { EditAttribute } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Accessor } from '@sofie-automation/blueprints-integration'
import { Studios } from '../../../collections'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForMultiSelect,
} from '../../../lib/Components/LabelAndOverrides'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { TextInputControl } from '../../../lib/Components/TextInput'
import {
	DropdownInputControl,
	DropdownInputOption,
	getDropdownInputOptions,
} from '../../../lib/Components/DropdownInput'
import { MultiSelectInputControl } from '../../../lib/Components/MultiSelectInput'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemNormal,
	getAllCurrentAndDeletedItemsFromOverrides,
	useOverrideOpHelper,
} from '../../util/OverrideOpHelper'
import { CheckboxControl } from '../../../lib/Components/Checkbox'

interface StudioPackageManagerSettingsProps {
	studio: DBStudio
}

export function StudioPackageManagerSettings({ studio }: StudioPackageManagerSettingsProps): React.JSX.Element {
	const { t } = useTranslation()

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const packageContainersFromOverrides = React.useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(studio.packageContainersWithOverrides, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[studio.packageContainersWithOverrides]
	)

	const addNewPackageContainer = React.useCallback(() => {
		const resolvedPackageContainers = applyAndValidateOverrides(studio.packageContainersWithOverrides).obj

		// find free key name
		const newKeyName = 'newContainer'
		let iter = 0
		while (resolvedPackageContainers[newKeyName + iter.toString()]) {
			iter++
		}

		const newId = newKeyName + iter.toString()
		const newPackageContainer: StudioPackageContainer = {
			deviceIds: [],
			container: {
				label: 'New Package Container ' + iter.toString(),
				accessors: {},
			},
		}

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newPackageContainer,
		})

		Studios.update(studio._id, {
			$push: {
				'packageContainersWithOverrides.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.packageContainersWithOverrides])

	const getAvailablePackageContainers = () => {
		const arr: {
			name: string
			value: string
		}[] = []

		packageContainersFromOverrides.forEach((packageContainer) => {
			let hasHttpAccessor = false
			if (packageContainer.computed) {
				for (const accessor of Object.values<Accessor.Any>(packageContainer.computed.container.accessors)) {
					if (accessor.type === Accessor.AccessType.HTTP_PROXY) {
						hasHttpAccessor = true
						break
					}
				}
				if (hasHttpAccessor) {
					arr.push({
						name: packageContainer.computed.container.label,
						value: packageContainer.id,
					})
				}
			}
		})
		return arr
	}

	return (
		<div>
			<h2 className="mhn mbs">{t('Package Manager')}</h2>

			<div className="settings-studio-package-containers">
				<h3 className="mhn">{t('Studio Settings')}</h3>

				<div>
					<div className="field mvs">
						<label>{t('Package Containers to use for previews')}</label>
						<div className="mdi">
							<EditAttribute
								attribute="previewContainerIds"
								obj={studio}
								options={getAvailablePackageContainers()}
								label={t('Click to show available Package Containers')}
								type="multiselect"
								collection={Studios}
							></EditAttribute>
						</div>
					</div>
					<div className="field mvs">
						<label>{t('Package Containers to use for thumbnails')}</label>
						<div className="mdi">
							<EditAttribute
								attribute="thumbnailContainerIds"
								obj={studio}
								options={getAvailablePackageContainers()}
								label={t('Click to show available Package Containers')}
								type="multiselect"
								collection={Studios}
							></EditAttribute>
						</div>
					</div>
				</div>

				<h3 className="mhn">{t('Package Containers')}</h3>
				<RenderPackageContainers
					studio={studio}
					packageContainersFromOverrides={packageContainersFromOverrides}
					toggleExpanded={toggleExpanded}
					isExpanded={isExpanded}
				/>
				<div className="mod mhs">
					<button className="btn btn-primary" onClick={addNewPackageContainer}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		</div>
	)
}

interface RenderPackageContainersProps {
	studio: DBStudio
	packageContainersFromOverrides: WrappedOverridableItem<StudioPackageContainer>[]
	toggleExpanded: (id: string, forceState?: boolean | undefined) => void
	isExpanded: (id: string) => boolean
}

function RenderPackageContainers({
	studio,
	packageContainersFromOverrides,
	toggleExpanded,
	isExpanded,
}: RenderPackageContainersProps): React.JSX.Element {
	const { t } = useTranslation()

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'packageContainersWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.packageContainersWithOverrides)

	const confirmRemovePackageContainer = (containerId: string) => {
		doModalDialog({
			title: t('Remove this Package Container?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper.deleteItem(containerId)
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to remove the Package Container "{{containerId}}"?', {
							containerId: containerId,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	const confirmReset = React.useCallback(
		(packgageContainerId: string) => {
			doModalDialog({
				title: t('Reset this Package Container?'),
				yes: t('Reset'),
				no: t('Cancel'),
				onAccept: () => {
					overrideHelper.resetItem(packgageContainerId)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to reset all overrides for Packing Container "{{id}}"?', {
								id: packgageContainerId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		},
		[t, packageContainersFromOverrides, overrideHelper]
	)

	return (
		<table className="table expando settings-studio-package-containers-table">
			{packageContainersFromOverrides.map(
				(packageContainer: WrappedOverridableItem<StudioPackageContainer>): React.JSX.Element => {
					return (
						<React.Fragment key={packageContainer.id}>
							{packageContainer.type == 'normal' ? (
								<React.Fragment>
									<tr
										className={ClassNames({
											hl: isExpanded(packageContainer.id),
										})}
									>
										<th className="settings-studio-package-container__id c2">{packageContainer.id}</th>
										<td className="settings-studio-package-container__name c2">
											{packageContainer.computed.container.label}
										</td>

										<td className="settings-studio-package-container__actions table-item-actions c3">
											{packageContainer.defaults && packageContainer.overrideOps.length > 0 && (
												<button
													className="action-btn"
													onClick={() => confirmReset(packageContainer.id)}
													title={t('Reset Package Container to default values')}
												>
													<FontAwesomeIcon icon={faSync} />
												</button>
											)}
											<button className="action-btn" onClick={() => toggleExpanded(packageContainer.id)}>
												<FontAwesomeIcon icon={faPencilAlt} />
											</button>
											<button className="action-btn" onClick={() => confirmRemovePackageContainer(packageContainer.id)}>
												<FontAwesomeIcon icon={faTrash} />
											</button>
										</td>
									</tr>
									<RenderPackageContainer
										studio={studio}
										packageContainer={packageContainer}
										overrideHelper={overrideHelper}
										toggleExpanded={toggleExpanded}
										isExpanded={isExpanded}
									/>
								</React.Fragment>
							) : (
								<RenderPackageContainerDeletedEntry
									packageContainer={packageContainer}
									overrideHelper={overrideHelper}
								/>
							)}
						</React.Fragment>
					)
				}
			)}
		</table>
	)
}

interface RenderPackageContainerDeletedProps {
	packageContainer: WrappedOverridableItem<StudioPackageContainer>
	overrideHelper: OverrideOpHelper
}

function RenderPackageContainerDeletedEntry({
	packageContainer,
	overrideHelper,
}: Readonly<RenderPackageContainerDeletedProps>) {
	const doUndeleteItem = React.useCallback(
		() => overrideHelper.resetItem(packageContainer.id),
		[overrideHelper, packageContainer.id]
	)

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">{packageContainer.id}</th>
			<td className="settings-studio-device__id c2 deleted">{packageContainer.defaults?.container.label}</td>
			<td className="settings-studio-device__id c2 deleted">{packageContainer.id}</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface RenderPackageContainerProps {
	studio: DBStudio
	packageContainer: WrappedOverridableItemNormal<StudioPackageContainer>
	overrideHelper: OverrideOpHelper
	toggleExpanded: (id: string, forceState?: boolean | undefined) => void
	isExpanded: (id: string) => boolean
}

function RenderPackageContainer({
	studio,
	packageContainer,
	overrideHelper,
	toggleExpanded,
	isExpanded,
}: RenderPackageContainerProps): React.JSX.Element {
	const { t } = useTranslation()

	const getPlayoutDeviceIds: DropdownInputOption<string>[] = React.useMemo(() => {
		const playoutDevicesFromOverrrides = applyAndValidateOverrides(studio.peripheralDeviceSettings.playoutDevices).obj

		const devices: {
			name: string
			value: string
		}[] = []

		for (const deviceId of Object.keys(playoutDevicesFromOverrrides)) {
			devices.push({
				name: deviceId,
				value: deviceId,
			})
		}
		return getDropdownInputOptions([...devices])
	}, [studio.peripheralDeviceSettings.playoutDevices])

	const updatePackageContainerId = React.useCallback(
		(newPackageContainerId: string) => {
			overrideHelper.changeItemId(packageContainer.id, newPackageContainerId)
			toggleExpanded(newPackageContainerId, true)
		},
		[overrideHelper, toggleExpanded, packageContainer.id]
	)

	const addNewAccessor = React.useCallback(() => {
		const newKeyName = 'local'
		let iter = 0
		if (!packageContainer.id)
			throw new Error(`Can't add an accessor to nonexistant Package Container "${packageContainer.id}"`)

		while (packageContainer.computed?.container.accessors[newKeyName + iter]) {
			iter++
		}
		const accessorId = newKeyName + iter

		const newAccessor: Accessor.LocalFolder = {
			type: Accessor.AccessType.LOCAL_FOLDER,
			label: 'Local folder',
			allowRead: true,
			allowWrite: false,
			folderPath: '',
		}

		overrideHelper.setItemValue(packageContainer.id, `container.accessors.${accessorId}`, newAccessor)

		setTimeout(() => {
			toggleExpanded(accessorId, true)
		}, 1)
	}, [studio._id, studio.packageContainersWithOverrides])

	if (!packageContainer.computed) throw new Error(`Package Container "${packageContainer.id}" not found`)

	return (
		<React.Fragment key={packageContainer.id}>
			{isExpanded(packageContainer.id) && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Package Container ID')} />
								<TextInputControl
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									value={packageContainer.id}
									handleUpdate={updatePackageContainerId}
									disabled={!!packageContainer.defaults}
								/>
							</label>
							<LabelAndOverrides
								label={t('Label')}
								item={packageContainer}
								//@ts-expect-error can't be 2 levels deep
								itemKey={'container.label'}
								opPrefix={packageContainer.id}
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
							<LabelAndOverridesForMultiSelect
								label={t('Playout devices which uses this package container')}
								hint={t('Select which playout devices are using this package container')}
								item={packageContainer}
								itemKey={'deviceIds'}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
								options={getPlayoutDeviceIds}
							>
								{(value, handleUpdate, options) => (
									<MultiSelectInputControl
										classNames="input text-input input-l"
										options={options}
										value={value}
										handleUpdate={handleUpdate}
									/>
								)}
							</LabelAndOverridesForMultiSelect>
							<div className="mdi"></div>
						</div>
						<div>
							<div className="settings-studio-accessors">
								<h3 className="mhn">{t('Accessors')}</h3>
								<table className="expando settings-studio-package-containers-accessors-table">
									<RenderAccessors packageContainer={packageContainer} overrideHelper={overrideHelper} />
								</table>
								<div className="mod mhs">
									<button className="btn btn-primary" onClick={addNewAccessor}>
										<FontAwesomeIcon icon={faPlus} />
									</button>
								</div>
							</div>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}

interface RenderAccessorsProps {
	packageContainer: WrappedOverridableItemNormal<StudioPackageContainer>
	overrideHelper: OverrideOpHelper
}

function RenderAccessors({ packageContainer, overrideHelper }: RenderAccessorsProps): React.JSX.Element {
	const { t } = useTranslation()

	const container = packageContainer.computed?.container

	if (!container || Object.keys(container).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no Accessors set up.')}</td>
			</tr>
		)
	}

	return (
		<React.Fragment>
			{_.map(container.accessors || {}, (accessor: Accessor.Any, accessorId: string) => {
				return (
					<React.Fragment key={accessorId}>
						<RenderAccessor
							accessorId={accessorId}
							accessor={accessor}
							packageContainer={packageContainer}
							overrideHelper={overrideHelper}
						/>
					</React.Fragment>
				)
			})}
		</React.Fragment>
	)
}

interface RenderAccessorProps {
	packageContainer: WrappedOverridableItemNormal<StudioPackageContainer>
	accessorId: string
	accessor: Accessor.Any
	overrideHelper: OverrideOpHelper
}

function RenderAccessor({
	accessor,
	accessorId,
	packageContainer,
	overrideHelper,
}: RenderAccessorProps): React.JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const confirmRemoveAccessor = (accessorId: string) => {
		doModalDialog({
			title: t('Remove this Package Container Accessor?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper.setItemValue(packageContainer.id, `container.accessors.${accessorId}`, undefined)
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to remove the Package Container Accessor "{{accessorId}}"?', {
							accessorId: accessorId,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	const updateAccessorId = React.useCallback(
		(newAccessorId: string) => {
			const oldAccessorId = accessorId
			if (!packageContainer.id) throw new Error(`containerId not set`)
			if (!packageContainer) throw new Error(`Can't edit an accessor to nonexistant Package Container"`)

			const accessor = packageContainer.computed?.container.accessors[oldAccessorId]

			if (packageContainer.computed?.container.accessors[newAccessorId]) {
				throw new Meteor.Error(400, 'Accessor "' + newAccessorId + '" already exists')
			}

			// Add a copy of accessor with the new ID
			overrideHelper.setItemValue(packageContainer.id, `container.accessors.${newAccessorId}`, accessor)

			// Remove the old accessor with the old ID
			// Issue: For some reason the PacackageContainer is not updated in the overrideHelper.
			// As a HACK we use a 100ms setTimeout to wait for the PackageContainer to be updated.
			// 1ms should be enough, but 100ms is used to be safe.
			// This is a temporary solution until as a fix for this is about to be implemented in NRK corelib.
			setTimeout(() => {
				overrideHelper.setItemValue(packageContainer.id, `container.accessors.${oldAccessorId}`, undefined)
				toggleExpanded(oldAccessorId, false)
				toggleExpanded(newAccessorId, true)
			}, 100)
		},
		[overrideHelper, toggleExpanded, packageContainer, accessorId]
	)

	if (Object.keys(packageContainer.computed?.container || {}).length === 0) {
		return (
			<tr>
				<td className="mhn dimmed">{t('There are no Accessors set up.')}</td>
			</tr>
		)
	}

	return (
		<React.Fragment key={accessorId}>
			<tr
				className={ClassNames({
					hl: isExpanded(accessorId),
				})}
			>
				<th className="settings-studio-accessor__id c2">{accessorId}</th>
				{/* <td className="settings-studio-accessor__name c2">{accessor.name}</td> */}
				<td className="settings-studio-accessor__type c1">{accessor.label}</td>
				{/*<td className="settings-studio-accessor__accessorContent c7">{accessorContent.join(', ')}</td>*/}

				<td className="settings-studio-accessor__actions table-item-actions c3">
					<button className="action-btn" onClick={() => toggleExpanded(accessorId)}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={() => confirmRemoveAccessor(accessorId)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded(accessorId) && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Accessor ID')} />
								<TextInputControl
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									value={accessorId}
									handleUpdate={updateAccessorId}
									disabled={!!packageContainer.defaults}
								/>
							</label>
							<LabelAndOverrides
								label={t('Label')}
								hint={t('Display name of the Package Container')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.label`}
								opPrefix={packageContainer.id}
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
								label={t('Accessor Type')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.type`}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(Accessor.AccessType)}
							>
								{(value, handleUpdate, options) => {
									return (
										<DropdownInputControl
											classNames="input text-input input-l"
											options={options}
											value={value}
											handleUpdate={handleUpdate}
										/>
									)
								}}
							</LabelAndOverridesForDropdown>
							{accessor.type === Accessor.AccessType.LOCAL_FOLDER ? (
								<>
									<LabelAndOverrides
										label={t('Folder path')}
										hint={t('File path to the folder of the local folder')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.folderPath`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Resourse Id')}
										hint={t('(Optional) This could be the name of the computer on which the local folder is on')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.resourceId`}
										opPrefix={packageContainer.id}
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
								</>
							) : accessor.type === Accessor.AccessType.HTTP ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Base url to the resource (example: http://myserver/folder)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.baseUrl`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t(
											'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										opPrefix={packageContainer.id}
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
								</>
							) : accessor.type === Accessor.AccessType.HTTP_PROXY ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Base url to the resource (example: http://myserver/folder)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.baseUrl`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t(
											'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										opPrefix={packageContainer.id}
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
								</>
							) : accessor.type === Accessor.AccessType.FILE_SHARE ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Folder path to shared folder')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.folderPath`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('User Name')}
										hint={t('Username for authentication')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.userName`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Password')}
										hint={t('Password for authentication')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.password`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t('(Optional) A name/identifier of the local network where the share is located')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										opPrefix={packageContainer.id}
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
								</>
							) : accessor.type === Accessor.AccessType.QUANTEL ? (
								<>
									<LabelAndOverrides
										label={t('Quantel gateway URL')}
										hint={t('URL to the Quantel Gateway')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.quantelGatewayUrl`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('ISA URLs')}
										hint={t('URLs to the ISAs, in order of importance (comma separated)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.ISAUrls`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Quantel Zone ID')}
										hint={t('Zone ID')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.zoneId`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Server ID')}
										hint={t(
											'Server ID. For sources, this should generally be omitted (or set to 0) so clip-searches are zone-wide. If set, clip-searches are limited to that server.'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.serverId`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Quantel transformer URL')}
										hint={t('URL to the Quantel HTTP transformer')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.transformerURL`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Quantel FileFlow URL')}
										hint={t('URL to the Quantel FileFlow Manager')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.fileflowURL`}
										opPrefix={packageContainer.id}
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
									<LabelAndOverrides
										label={t('Quantel FileFlow Profile name')}
										hint={t('Profile name to be used by FileFlow when exporting the clips')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.fileflowProfile`}
										opPrefix={packageContainer.id}
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
								</>
							) : null}

							<LabelAndOverridesForCheckbox
								label={t('Allow Read access')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.allowRead`}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Allow Write access')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.allowWrite`}
								opPrefix={packageContainer.id}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
						</div>
						<div className="mod">
							<button className="btn btn-primary right" onClick={() => toggleExpanded(accessorId)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}
