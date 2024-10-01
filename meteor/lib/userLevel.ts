export const USER_LEVEL_HEADER = 'dnt'
// export const USER_LEVEL_USER_ID = protectString<UserId>('fake-user')

export interface UserLevel {
	studio: boolean
	configure: boolean
	developer: boolean
	testing: boolean
	service: boolean
}
const allowedLevels = new Set<keyof UserLevel>(['studio', 'configure', 'developer', 'testing', 'service'])

export function parseUserLevel(level: string | undefined): UserLevel | null {
	if (level === 'admin') {
		return {
			studio: true,
			configure: true,
			developer: true,
			testing: true,
			service: true,
		}
	}

	const result: UserLevel = {
		studio: false,
		configure: false,
		developer: false,
		testing: false,
		service: false,
	}

	if (level && typeof level === 'string') {
		const parts = level.split(',')

		for (const part of parts) {
			const part2 = part.trim() as keyof UserLevel
			if (allowedLevels.has(part2)) {
				result[part2] = true
			}
		}

		return result
	}

	return null
}
