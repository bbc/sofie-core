export const USER_PERMISSIONS_HEADER = 'dnt'
// export const USER_LEVEL_USER_ID = protectString<UserId>('fake-user')

export interface UserPermissions {
	studio: boolean
	configure: boolean
	developer: boolean
	testing: boolean
	service: boolean
}
const allowedPermissions = new Set<keyof UserPermissions>(['studio', 'configure', 'developer', 'testing', 'service'])

export function parseUserPermissions(encodedPermissions: string | undefined): UserPermissions | null {
	if (encodedPermissions === 'admin') {
		return {
			studio: true,
			configure: true,
			developer: true,
			testing: true,
			service: true,
		}
	}

	const result: UserPermissions = {
		studio: false,
		configure: false,
		developer: false,
		testing: false,
		service: false,
	}

	if (encodedPermissions && typeof encodedPermissions === 'string') {
		const parts = encodedPermissions.split(',')

		for (const part of parts) {
			const part2 = part.trim() as keyof UserPermissions
			if (allowedPermissions.has(part2)) {
				result[part2] = true
			}
		}

		return result
	}

	return null
}
