import React, { useCallback, useMemo } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { unprotectString } from '../../lib/tempLib'
import { doModalDialog } from '../../lib/ModalDialog'
import { NavLink, useLocation } from 'react-router-dom'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { PeripheralDevice, PERIPHERAL_SUBTYPE_PROCESS } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { faPlus, faTrash, faExclamationTriangle, faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { MeteorCall } from '../../lib/meteorApi'
import { IOutputLayer, StatusCode } from '@sofie-automation/blueprints-integration'
import { TFunction, useTranslation } from 'react-i18next'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { Blueprints, PeripheralDevices, ShowStyleBases, Studios } from '../../collections'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { catchError } from '../../lib/lib'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export function SettingsMenu(): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className="tight-xs htight-xs text-s">
			<SettingsMenuStudios />

			<SettingsMenuShowStyles />

			{<SettingsMenuBlueprints />}

			<SettingsMenuPeripheralDevices />

			<h2 className="mhs">{t('Tools')}</h2>
			<hr className="vsubtle man" />
			{
				<React.Fragment>
					<NavLink
						activeClassName="selectable-selected"
						className="settings-menu__settings-menu-item selectable clickable"
						to="/settings/tools/system"
					>
						<h3>{t('Core System settings')}</h3>
					</NavLink>
					<NavLink
						activeClassName="selectable-selected"
						className="settings-menu__settings-menu-item selectable clickable"
						to="/settings/tools/migration"
					>
						<h3>{t('Upgrade Database')}</h3>
					</NavLink>
					<NavLink
						activeClassName="selectable-selected"
						className="settings-menu__settings-menu-item selectable clickable"
						to="/settings/tools/snapshots"
					>
						<h3>{t('Manage Snapshots')}</h3>
					</NavLink>
				</React.Fragment>
			}
		</div>
	)
}

function SettingsMenuStudios() {
	const { t } = useTranslation()

	useSubscription(CorelibPubSub.studios, null)

	const studios = useTracker(() => Studios.find({}).fetch(), [], [])

	const onAddStudio = useCallback(() => {
		MeteorCall.studio.insertStudio().catch(catchError('studio.insertStudio'))
	}, [])

	return (
		<>
			<h2 className="mhs">
				<button className="action-btn right" onClick={onAddStudio}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
				{t('Studios')}
			</h2>
			<hr className="vsubtle man" />
			{studios.map((studio) => (
				<SettingsMenuStudio key={unprotectString(studio._id)} studio={studio} />
			))}
		</>
	)
}
function SettingsMenuShowStyles() {
	const { t } = useTranslation()

	useSubscription(CorelibPubSub.showStyleBases, null)
	useSubscription(CorelibPubSub.showStyleVariants, null, null)

	const showStyleBases = useTracker(() => ShowStyleBases.find({}).fetch(), [], [])

	const onAddShowStyleBase = useCallback(() => {
		MeteorCall.showstyles.insertShowStyleBase().catch(catchError('showstyles.insertShowStyleBase'))
	}, [])

	return (
		<>
			<h2 className="mhs">
				<button className="action-btn right" onClick={onAddShowStyleBase}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
				{t('Show Styles')}
			</h2>
			<hr className="vsubtle man" />
			{showStyleBases.map((showStyleBase) => (
				<SettingsMenuShowStyle key={unprotectString(showStyleBase._id)} showStyleBase={showStyleBase} />
			))}
		</>
	)
}
function SettingsMenuBlueprints() {
	const { t } = useTranslation()

	useSubscription(CorelibPubSub.blueprints, null)

	const blueprints = useTracker(() => Blueprints.find({}).fetch(), [], [])

	const onAddBlueprint = useCallback(() => {
		MeteorCall.blueprint.insertBlueprint().catch((error) => {
			NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, error.reason, 'Create New Blueprint'))
		})
	}, [])

	return (
		<>
			<h2 className="mhs">
				<button className="action-btn right" onClick={onAddBlueprint}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
				{t('Blueprints')}
			</h2>
			<hr className="vsubtle man" />
			{blueprints.map((blueprint) => (
				<SettingsMenuBlueprint key={unprotectString(blueprint._id)} blueprint={blueprint} />
			))}
		</>
	)
}
function SettingsMenuPeripheralDevices() {
	const { t } = useTranslation()

	useSubscription(CorelibPubSub.peripheralDevices, null)

	const peripheralDevices = useTracker(
		() =>
			PeripheralDevices.find(
				{},
				{
					sort: {
						lastConnected: -1,
					},
				}
			).fetch(),
		[],
		[]
	)

	return (
		<>
			<h2 className="mhs">{t('Devices')}</h2>
			<hr className="vsubtle man" />
			{peripheralDevices
				.filter((device) => {
					return device.subType === PERIPHERAL_SUBTYPE_PROCESS
				})
				.map((device) => (
					<SettingsMenuPeripheralDevice key={unprotectString(device._id)} device={device} />
				))}
		</>
	)
}

interface SettingsCollapsibleGroupProps {
	links: Array<{ label: string; subPath: string }>
	basePath: string
	title: string
}

function SettingsCollapsibleGroup({
	links,
	children,
	basePath,
	title,
}: React.PropsWithChildren<SettingsCollapsibleGroupProps>) {
	const [expanded, setExpanded] = React.useState(false)

	const toggleExpanded = React.useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		setExpanded((old) => !old)
	}, [])

	const location = useLocation()
	React.useEffect(() => {
		// Auto-expand if the current location starts with the basePath
		if (location.pathname.startsWith(basePath)) {
			setExpanded(true)
		}
	}, [location.pathname, basePath])

	return (
		<>
			<NavLink
				// activeClassName="selectable-selected"
				className="settings-menu__settings-menu-item selectable clickable"
				to={basePath}
				onClick={toggleExpanded}
			>
				{children}
				<h3>
					<span className="icon action-item">
						<FontAwesomeIcon icon={expanded ? faCaretDown : faCaretRight} />
					</span>
					{title}
				</h3>
			</NavLink>
			{expanded
				? links.map((link, i) => (
						<NavLink
							key={i}
							activeClassName="selectable-selected"
							className="settings-menu__settings-menu-item selectable clickable menu-item-child"
							to={`${basePath}/${link.subPath}`}
						>
							<h4>{link.label}</h4>
						</NavLink>
				  ))
				: ''}
			<hr className="vsubtle man" />
		</>
	)
}

interface SettingsMenuStudioProps {
	studio: DBStudio
}
function SettingsMenuStudio({ studio }: Readonly<SettingsMenuStudioProps>) {
	const { t } = useTranslation()

	const onDeleteStudio = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			doModalDialog({
				title: t('Delete this Studio?'),
				yes: t('Delete'),
				no: t('Cancel'),
				message: (
					<React.Fragment>
						<p>{t('Are you sure you want to delete the studio "{{studioId}}"?', { studioId: studio.name })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
				onAccept: () => {
					MeteorCall.studio.removeStudio(studio._id).catch(catchError('studio.removeStudio'))
				},
			})
		},
		[t, studio.name, studio._id]
	)

	const childLinks = React.useMemo(
		() => [
			{ label: t('Generic Properties'), subPath: `generic` },
			{ label: t('Peripheral Devices'), subPath: `devices` },
			{ label: t('Blueprint Configuration'), subPath: `blueprint-config` },
			{ label: t('Layer Mappings'), subPath: `mappings` },
			{ label: t('Route Sets'), subPath: `route-sets` },
			{ label: t('Package Manager'), subPath: `package-manager` },
		],
		[studio._id]
	)

	return (
		<SettingsCollapsibleGroup
			basePath={`/settings/studio/${studio._id}`}
			links={childLinks}
			title={studio.name || t('Unnamed Studio')}
		>
			<button className="action-btn right" onClick={onDeleteStudio}>
				<FontAwesomeIcon icon={faTrash} />
			</button>
			{studioHasError(studio) ? (
				<button className="action-btn right error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} />
				</button>
			) : null}
		</SettingsCollapsibleGroup>
	)
}

function studioHasError(studio: DBStudio): boolean {
	if (!studio.name) return true
	if (!studio.supportedShowStyleBase.length) return true
	if (!studio.blueprintId) return true
	// TODO - fix this
	// const peripherals = props.peripheralDevices.filter((device) => device.studioId === studio._id)
	// if (!peripherals.length) return true
	// if (!peripherals.filter((device) => device.type === PeripheralDeviceType.PLAYOUT).length) return true
	return false
}

interface SettingsMenuShowStyleProps {
	showStyleBase: DBShowStyleBase
}
function SettingsMenuShowStyle({ showStyleBase }: Readonly<SettingsMenuShowStyleProps>) {
	const { t } = useTranslation()

	const onDeleteShowStyleBase = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			doModalDialog({
				title: t('Delete this Show Style?'),
				yes: t('Delete'),
				no: t('Cancel'),
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to delete the show style "{{showStyleId}}"?', {
								showStyleId: showStyleBase?.name,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
				onAccept: () => {
					MeteorCall.showstyles
						.removeShowStyleBase(showStyleBase._id)
						.catch(catchError('showstyles.removeShowStyleBase'))
				},
			})
		},
		[t, showStyleBase._id, showStyleBase.name]
	)

	const childLinks = React.useMemo(
		() => [
			{ label: t('Generic Properties'), subPath: `generic` },
			{ label: t('Source/Output Layers'), subPath: `layers` },
			{ label: t('Action Triggers'), subPath: `action-triggers` },
			{ label: t('Custom Hotkey Labels'), subPath: `hotkey-labels` },

			...RundownLayoutsAPI.getSettingsManifest(t).map((region) => {
				return { label: region.title, subPath: `layouts-${region._id}` }
			}),

			{ label: t('Blueprint Configuration'), subPath: `blueprint-config` },
			{ label: t('Variants'), subPath: `variants` },
		],
		[showStyleBase._id]
	)

	const showStyleHasError = useMemo(() => {
		if (!showStyleBase.sourceLayersWithOverrides) return true
		if (!showStyleBase.outputLayersWithOverrides) return true

		const resolvedSourceLayers = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
		const resolvedOutputLayers = applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj

		if (!Object.keys(resolvedSourceLayers).length) return true
		if (!Object.keys(resolvedOutputLayers).length) return true
		if (!Object.values<IOutputLayer | undefined>(resolvedOutputLayers).find((l) => !!l?.isPGM)) return true
		return false
	}, [showStyleBase.outputLayersWithOverrides, showStyleBase.sourceLayersWithOverrides])

	return (
		<SettingsCollapsibleGroup
			basePath={`/settings/showStyleBase/${showStyleBase._id}`}
			links={childLinks}
			title={showStyleBase.name || t('Unnamed Show Style')}
		>
			<button className="action-btn right" onClick={onDeleteShowStyleBase}>
				<FontAwesomeIcon icon={faTrash} />
			</button>
			{showStyleHasError ? (
				<button className="action-btn right error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} />
				</button>
			) : null}
		</SettingsCollapsibleGroup>
	)
}

interface SettingsMenuBlueprintProps {
	blueprint: Blueprint
}
function SettingsMenuBlueprint({ blueprint }: Readonly<SettingsMenuBlueprintProps>) {
	const { t } = useTranslation()

	const onDeleteBlueprint = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			doModalDialog({
				title: t('Delete this Blueprint?'),
				yes: t('Delete'),
				no: t('Cancel'),
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to delete the blueprint "{{blueprintId}}"?', {
								blueprintId: blueprint?.name,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
				onAccept: () => {
					MeteorCall.blueprint.removeBlueprint(blueprint._id).catch(catchError('blueprint.removeBlueprint'))
				},
			})
		},
		[t, blueprint._id, blueprint.name]
	)

	return (
		<NavLink
			activeClassName="selectable-selected"
			className="settings-menu__settings-menu-item selectable clickable"
			to={'/settings/blueprint/' + blueprint._id}
		>
			<button className="action-btn right" onClick={onDeleteBlueprint}>
				<FontAwesomeIcon icon={faTrash} />
			</button>
			{blueprintHasError(blueprint) ? (
				<button className="action-btn right error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} />
				</button>
			) : null}
			<h3>{blueprint.name || t('Unnamed blueprint')}</h3>
			<p>
				{t('Type')} {(blueprint.blueprintType ?? '').toUpperCase()}
			</p>
			<p>
				{t('Version')} {blueprint.blueprintVersion}
			</p>
			<hr className="vsubtle man" />
		</NavLink>
	)
}

function blueprintHasError(blueprint: Blueprint): boolean {
	if (!blueprint.name) return true
	if (!blueprint.blueprintType) return true
	return false
}

interface SettingsMenuPeripheralDeviceProps {
	device: PeripheralDevice
}
function SettingsMenuPeripheralDevice({ device }: Readonly<SettingsMenuPeripheralDeviceProps>) {
	const { t } = useTranslation()

	const onDeleteDevice = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			doModalDialog({
				title: t('Remove this Device?'),
				yes: t('Delete'),
				no: t('Cancel'),
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove the device "{{deviceName}}" and all of it\'s sub-devices?', {
								deviceName: device?.name,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
				onAccept: () => {
					MeteorCall.peripheralDevice
						.removePeripheralDevice(device._id)
						.catch(catchError('peripheralDevice.removePeripheralDevice'))
				},
			})
		},
		[t, device._id, device.name]
	)

	return (
		<NavLink
			activeClassName="selectable-selected"
			className="settings-menu__settings-menu-item selectable clickable"
			to={'/settings/peripheralDevice/' + device._id}
		>
			<button className="action-btn right" onClick={onDeleteDevice}>
				<FontAwesomeIcon icon={faTrash} />
			</button>
			{peripheralDeviceHasError(device) ? (
				<button className="action-btn right error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} />
				</button>
			) : null}
			<h3>{device.name}</h3>
			<p>
				{device.connected ? t('Connected') : t('Disconnected')}, {t('Status')}:{' '}
				{statusCodeString(t, device.status.statusCode)}
			</p>
			<hr className="vsubtle man" key={device._id + '-hr'} />
		</NavLink>
	)
}

function peripheralDeviceHasError(device: PeripheralDevice): boolean {
	if (!device.name) return true
	return false
}

function statusCodeString(t: TFunction, statusCode: StatusCode): string {
	switch (statusCode) {
		case StatusCode.UNKNOWN:
			return t('Unknown')
		case StatusCode.GOOD:
			return t('Good')
		case StatusCode.WARNING_MINOR:
			return t('Minor Warning')
		case StatusCode.WARNING_MAJOR:
			return t('Warning')
		case StatusCode.BAD:
			return t('Bad')
		case StatusCode.FATAL:
			return t('Fatal')
	}
}
