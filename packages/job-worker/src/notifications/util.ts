import {
	ITranslatableMessage,
	wrapTranslatableMessageFromBlueprints,
} from '@sofie-automation/corelib/dist/TranslatableMessage'
import type { INotification } from './NotificationsModel'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getHash } from '@sofie-automation/corelib/dist/hash'

/** Generate the translation for a string, to be applied later when it gets rendered */
export function generateTranslation(
	key: string,
	args?: { [k: string]: any },
	namespaces?: string[]
): ITranslatableMessage {
	return {
		key,
		args,
		namespaces,
	}
}

export function convertNoteToNotification(note: INoteBase, blueprintIds: BlueprintId[]): INotification {
	return {
		id: getHash(JSON.stringify(note.message)), // Notes don't have an id, so fake one from the message
		severity: note.type,
		message: wrapTranslatableMessageFromBlueprints(note.message, blueprintIds),
	}
}
