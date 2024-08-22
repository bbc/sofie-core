import type { IngestPart, MutableIngestPart } from '@sofie-automation/blueprints-integration'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')

export class MutableIngestPartImpl<TPartPayload = unknown> implements MutableIngestPart<TPartPayload> {
	readonly #ingestPart: Omit<IngestPart, 'rank'>
	#hasChanges = false

	constructor(ingestPart: Omit<IngestPart, 'rank'>, hasChanges = false) {
		this.#ingestPart = ingestPart
		this.#hasChanges = hasChanges
	}

	get externalId(): string {
		return this.#ingestPart.externalId
	}

	get name(): string {
		return this.#ingestPart.name
	}

	get payload(): ReadonlyDeep<TPartPayload> | undefined {
		return this.#ingestPart.payload
	}

	get userEditStates(): Record<string, boolean> | undefined {
		return this.#ingestPart.userEditStates
	}

	setName(name: string): void {
		if (this.#ingestPart.name !== name) {
			this.#ingestPart.name = name
			this.#hasChanges = true
		}
	}

	replacePayload(payload: ReadonlyDeep<TPartPayload> | TPartPayload): void {
		if (this.#hasChanges || !_.isEqual(this.#ingestPart.payload, payload)) {
			this.#ingestPart.payload = clone(payload)
			this.#hasChanges = true
		}
	}

	setPayloadProperty<TKey extends keyof TPartPayload>(key: TKey, value: TPartPayload[TKey]): void {
		if (!this.#ingestPart.payload) {
			throw new Error('Part payload is not set')
		}

		if (this.#hasChanges || !_.isEqual(this.#ingestPart.payload[key], value)) {
			this.#ingestPart.payload[key] = clone(value)
			this.#hasChanges = true
		}
	}

	#setUserEditState(key: string, protect: boolean): boolean {
		if (this.#ingestPart.userEditStates !== undefined) {
			this.#ingestPart.userEditStates[key] = protect
			this.#hasChanges = true
		}
		return true
	}

	setUserEditState(key: string, protect: boolean): boolean {
		return this.#setUserEditState(key, protect)
	}

	/**
	 * Check if the part has changes and clear any changes flags
	 * Note: this is not visible to blueprints
	 */
	checkAndClearChangesFlags(): boolean {
		const hasChanges = this.#hasChanges

		this.#hasChanges = false

		return hasChanges
	}
}
