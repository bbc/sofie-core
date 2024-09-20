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

export interface UserPermissions {
	studio: boolean
	configure: boolean
	developer: boolean
	testing: boolean
	service: boolean
}

export const UserPermissionsContext = React.createContext<Readonly<UserPermissions>>({
	studio: false,
	configure: false,
	developer: false,
	testing: false,
	service: false,
})

const USE_HEADER_AUTH = true // TODO - dynamic somehow

export function useUserPermissions(): [roles: UserPermissions, ready: boolean] {
	const location = window.location

	const [ready, setReady] = useState(!USE_HEADER_AUTH)

	const [permissions, setPermissions] = useState<UserPermissions>(
		USE_HEADER_AUTH
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
		if (!USE_HEADER_AUTH) return

		const interval = setInterval(() => {
			// TODO - this is a temorary hack!
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
		})

		return () => {
			clearInterval(interval)
		}
	}, [USE_HEADER_AUTH])

	useEffect(() => {
		if (USE_HEADER_AUTH) return

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
	}, [location.search, USE_HEADER_AUTH])

	// A naive memoizing of the value, to avoid reactions when the value is identical
	return [useMemo(() => permissions, [JSON.stringify(permissions)]), ready]
}
