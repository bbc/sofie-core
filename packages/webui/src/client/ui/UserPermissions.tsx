import React, { useEffect, useMemo, useState } from 'react'
import {
	getLocalAllowStudio,
	getLocalAllowConfigure,
	getLocalAllowDeveloper,
	getLocalAllowTesting,
	getLocalAllowService,
	setAllowStudio,
	setAllowConfigure,
	setAllowDeveloper,
	setAllowTesting,
	setAllowService,
} from '../lib/localStorage'
import { parse as queryStringParse } from 'query-string'
import { MeteorCall } from '../lib/meteorApi'
import { UserLevel as UserPermissions } from '@sofie-automation/meteor-lib/dist/userLevel' // nocommit - avoid this alias
import { Settings } from '../lib/Settings'

export type { UserPermissions }

export const UserPermissionsContext = React.createContext<Readonly<UserPermissions>>({
	studio: false,
	configure: false,
	developer: false,
	testing: false,
	service: false,
})

export function useUserPermissions(): [roles: UserPermissions, ready: boolean] {
	const location = window.location

	const [ready, setReady] = useState(!Settings.enableHeaderAuth)

	const [permissions, setPermissions] = useState<UserPermissions>(
		Settings.enableHeaderAuth
			? {
					studio: false,
					configure: false,
					developer: false,
					testing: false,
					service: false,
			  }
			: {
					studio: getLocalAllowStudio(),
					configure: getLocalAllowConfigure(),
					developer: getLocalAllowDeveloper(),
					testing: getLocalAllowTesting(),
					service: getLocalAllowService(),
			  }
	)

	useEffect(() => {
		if (!Settings.enableHeaderAuth) return

		const interval = setInterval(() => {
			// TODO - this is a temorary hack!
			// TODO - this should also be triggered by ddp reconnecting
			MeteorCall.user
				.getUserLevel()
				.then((v) => {
					setPermissions(
						v || {
							studio: false,
							configure: false,
							developer: false,
							testing: false,
							service: false,
						}
					)
					setReady(true)
				})
				.catch((e) => {
					console.error('Failed to set level', e)
					setPermissions({
						studio: false,
						configure: false,
						developer: false,
						testing: false,
						service: false,
					})
				})
		}, 30000) // Arbitrary poll interval

		return () => {
			clearInterval(interval)
		}
	}, [Settings.enableHeaderAuth])

	useEffect(() => {
		if (Settings.enableHeaderAuth) return

		if (!location.search) return

		const params = queryStringParse(location.search)

		if (params['studio']) setAllowStudio(params['studio'] === '1')
		if (params['configure']) setAllowConfigure(params['configure'] === '1')
		if (params['develop']) setAllowDeveloper(params['develop'] === '1')
		if (params['testing']) setAllowTesting(params['testing'] === '1')
		if (params['service']) setAllowService(params['service'] === '1')

		if (params['admin']) {
			const val = params['admin'] === '1'
			setAllowStudio(val)
			setAllowConfigure(val)
			setAllowDeveloper(val)
			setAllowTesting(val)
			setAllowService(val)
		}

		setPermissions({
			studio: getLocalAllowStudio(),
			configure: getLocalAllowConfigure(),
			developer: getLocalAllowDeveloper(),
			testing: getLocalAllowTesting(),
			service: getLocalAllowService(),
		})
	}, [location.search, Settings.enableHeaderAuth])

	// A naive memoizing of the value, to avoid reactions when the value is identical
	return [useMemo(() => permissions, [JSON.stringify(permissions)]), ready]
}
