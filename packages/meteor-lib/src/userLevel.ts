import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from './lib'

export const USER_LEVEL_HEADER = 'dnt'
export const USER_LEVEL_USER_ID = protectString<UserId>('fake-user')

export enum UserLevel {
	Readonly = 'readonly',
	Studio = 'studio',
	Admin = 'admin',
	PeripheralDevice = 'peripheral-device',
}
const allowedLevels = new Set(Object.values<UserLevel>(UserLevel))

export function parseUserLevel(level: string | undefined): UserLevel | null {
	if (!level) return null
	const levelTyped = level as UserLevel
	if (allowedLevels.has(levelTyped)) return levelTyped
	return null
}
