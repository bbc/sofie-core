import { Blueprint } from './dataModel/Blueprint.js'
import { generateTranslation } from './lib.js'
import { ITranslatableMessage, wrapTranslatableMessageFromBlueprints } from './TranslatableMessage.js'
import { BlueprintErrorCode } from '@sofie-automation/shared-lib/dist/blueprintErrorMessages'
import { SystemErrorCode } from '@sofie-automation/shared-lib/dist/systemErrorMessages'

/**
 * Default error messages for blueprint errors
 */
const DEFAULT_BLUEPRINT_ERROR_MESSAGES: Record<BlueprintErrorCode, ITranslatableMessage> = {
	[BlueprintErrorCode.MISSING_SEGMENT_DATA]: generateTranslation(
		'Segment {{segmentId}} is missing required field: {{field}}'
	),
	[BlueprintErrorCode.INVALID_TIMING]: generateTranslation('Segment {{segmentId}} has invalid timing: {{reason}}'),
	[BlueprintErrorCode.PIECE_GENERATION_FAILED]: generateTranslation(
		'Failed to generate piece {{pieceId}}: {{error}}'
	),
	[BlueprintErrorCode.PART_GENERATION_FAILED]: generateTranslation('Failed to generate part {{partId}}: {{error}}'),
	[BlueprintErrorCode.VALIDATION_ERROR]: generateTranslation('Blueprint validation error: {{reason}}'),
}

/**
 * Default error messages for system errors
 */
const DEFAULT_SYSTEM_ERROR_MESSAGES: Record<SystemErrorCode, ITranslatableMessage> = {
	[SystemErrorCode.DATABASE_CONNECTION_LOST]: generateTranslation('Database connection to {{database}} lost'),
	[SystemErrorCode.INSUFFICIENT_RESOURCES]: generateTranslation(
		'Insufficient {{resource}}: {{available}} available, {{required}} required'
	),
	[SystemErrorCode.SERVICE_UNAVAILABLE]: generateTranslation('Service {{service}} unavailable: {{reason}}'),
}

export type BlueprintForErrorMessages = Pick<
	Blueprint,
	'_id' | 'deviceErrorMessages' | 'blueprintErrorMessages' | 'systemErrorMessages'
>

/**
 * Type for the optional dynamic error message resolver function from blueprints.
 * This function is called first, before checking static message records.
 * Return undefined to fall through to static messages.
 */
export type ErrorMessageResolverFunction = (
	errorCode: string | BlueprintErrorCode | SystemErrorCode,
	args: Record<string, unknown>
) => string | undefined

/**
 * Resolves error messages with blueprint customizations.
 * Follows the same pattern as PieceContentStatusMessageFactory from PR #1369
 *
 * For device errors, the default message templates come from TSR devices.
 * Blueprints can override these by providing custom templates in deviceErrorMessages.
 *
 * @example
 * ```typescript
 * import { AtemErrorCode, AtemErrorMessages } from 'timeline-state-resolver'
 *
 * // Get blueprint from database
 * const blueprint = await Blueprints.findOneAsync(blueprintId)
 *
 * // Create resolver (with optional dynamic resolver function from blueprint manifest)
 * const resolver = new ErrorMessageResolver(blueprint, blueprintManifest.resolveErrorMessage)
 *
 * // Resolve device error - pass default message from TSR
 * const message = resolver.getDeviceErrorMessage(
 *   AtemErrorCode.DISCONNECTED,
 *   { deviceName: 'Vision Mixer', host: '192.168.1.10' },
 *   AtemErrorMessages[AtemErrorCode.DISCONNECTED]
 * )
 * ```
 */
export class ErrorMessageResolver {
	readonly #blueprint: BlueprintForErrorMessages | undefined
	readonly #resolverFunction: ErrorMessageResolverFunction | undefined

	constructor(blueprint: BlueprintForErrorMessages | undefined, resolverFunction?: ErrorMessageResolverFunction) {
		this.#blueprint = blueprint
		this.#resolverFunction = resolverFunction
	}

	/**
	 * Get a translatable message for a device error.
	 *
	 * @param errorCode - The error code string from TSR (e.g., 'DEVICE_ATEM_DISCONNECTED')
	 * @param args - Context values for message interpolation
	 * @param defaultMessage - The default message template from TSR (e.g., 'ATEM disconnected from {{host}}')
	 * @returns ITranslatableMessage with the resolved message, or null if suppressed
	 */
	getDeviceErrorMessage(
		errorCode: string,
		args: { deviceName: string; deviceId?: string; [k: string]: unknown },
		defaultMessage: string
	): ITranslatableMessage | null {
		// 1. Try dynamic resolver function first
		if (this.#resolverFunction) {
			const dynamicMessage = this.#resolverFunction(errorCode, args)
			if (dynamicMessage !== undefined) {
				if (dynamicMessage === '') {
					// Empty string means suppress the message
					return null
				}
				return this.#blueprint
					? wrapTranslatableMessageFromBlueprints({ key: dynamicMessage, args }, [this.#blueprint._id])
					: { key: dynamicMessage, args }
			}
		}

		// 2. Check static blueprint messages
		if (this.#blueprint) {
			const blueprintMessage = this.#blueprint.deviceErrorMessages?.[errorCode]

			if (blueprintMessage === '') {
				// Empty string means suppress the message
				return null
			}

			if (blueprintMessage) {
				return wrapTranslatableMessageFromBlueprints(
					{
						key: blueprintMessage,
						args,
					},
					[this.#blueprint._id]
				)
			}
		}

		// 3. Use default message from TSR
		return {
			key: defaultMessage,
			args,
		}
	}

	/**
	 * Get a translatable message for a blueprint error
	 */
	getBlueprintErrorMessage(
		errorCode: BlueprintErrorCode,
		args: { error?: string; [k: string]: unknown }
	): ITranslatableMessage | null {
		// 1. Try dynamic resolver function first
		if (this.#resolverFunction) {
			const dynamicMessage = this.#resolverFunction(errorCode, args)
			if (dynamicMessage !== undefined) {
				if (dynamicMessage === '') {
					return null
				}
				return this.#blueprint
					? wrapTranslatableMessageFromBlueprints({ key: dynamicMessage, args }, [this.#blueprint._id])
					: { key: dynamicMessage, args }
			}
		}

		// 2. Check static blueprint messages
		if (this.#blueprint) {
			const blueprintMessage = this.#blueprint.blueprintErrorMessages?.[errorCode]

			if (blueprintMessage === '') {
				// Empty string means suppress the message
				return null
			}

			if (blueprintMessage) {
				return wrapTranslatableMessageFromBlueprints(
					{
						key: blueprintMessage,
						args,
					},
					[this.#blueprint._id]
				)
			}
		}

		// Use default message
		return {
			key: DEFAULT_BLUEPRINT_ERROR_MESSAGES[errorCode]?.key ?? errorCode,
			args,
		}
	}

	/**
	 * Get a translatable message for a system error
	 */
	getSystemErrorMessage(errorCode: SystemErrorCode, args: { [k: string]: any }): ITranslatableMessage | null {
		// 1. Check dynamic resolver function (if available)
		if (this.#resolverFunction) {
			const dynamicMessage = this.#resolverFunction(errorCode, args)

			if (dynamicMessage === '') {
				// Empty string means suppress the message
				return null
			}

			if (dynamicMessage !== undefined) {
				// Resolver returned a custom message
				return this.#blueprint
					? wrapTranslatableMessageFromBlueprints({ key: dynamicMessage, args }, [this.#blueprint._id])
					: { key: dynamicMessage, args }
			}
		}

		// 2. Check static blueprint messages
		if (this.#blueprint) {
			const blueprintMessage = this.#blueprint.systemErrorMessages?.[errorCode]

			if (blueprintMessage === '') {
				// Empty string means suppress the message
				return null
			}

			if (blueprintMessage) {
				return wrapTranslatableMessageFromBlueprints(
					{
						key: blueprintMessage,
						args,
					},
					[this.#blueprint._id]
				)
			}
		}

		// 3. Use default message
		return {
			key: DEFAULT_SYSTEM_ERROR_MESSAGES[errorCode]?.key ?? errorCode,
			args,
		}
	}
}
