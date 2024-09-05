/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run "yarn generate-schema-types" to regenerate this file.
 */

export interface MosDeviceConfig {
	primary: {
		id: string
		host: string
		dontUseQueryPort?: boolean
		timeout?: number
		heartbeatInterval?: number
		ports?: {
			lower: number
			upper: number
			query: number
		}
	}
	secondary?: {
		id: string
		host: string
		dontUseQueryPort?: boolean
		timeout?: number
		heartbeatInterval?: number
		hotStandby?: boolean
		ports?: {
			lower: number
			upper: number
			query: number
		}
	}
}
