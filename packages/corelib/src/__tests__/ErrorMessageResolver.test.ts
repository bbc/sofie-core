import { ErrorMessageResolver } from '../ErrorMessageResolver.js'
import { BlueprintErrorCode } from '@sofie-automation/shared-lib/dist/blueprintErrorMessages'
import { SystemErrorCode } from '@sofie-automation/shared-lib/dist/systemErrorMessages'
import { protectString } from '../protectedString.js'

// Mock device error codes (these would come from TSR in production)
const MockDeviceErrorCode = {
	HTTP_TIMEOUT: 'DEVICE_HTTP_TIMEOUT',
	CASPARCG_DISCONNECTED: 'DEVICE_CASPARCG_DISCONNECTED',
	CASPARCG_FILE_NOT_FOUND: 'DEVICE_CASPARCG_FILE_NOT_FOUND',
} as const

// Mock default messages (these would come from TSR in production)
const MockDeviceErrorMessages = {
	[MockDeviceErrorCode.HTTP_TIMEOUT]: '{{deviceName}}: HTTP request to {{url}} timed out after {{timeout}}ms',
	[MockDeviceErrorCode.CASPARCG_DISCONNECTED]: '{{deviceName}}: CasparCG server at {{host}}:{{port}} disconnected',
	[MockDeviceErrorCode.CASPARCG_FILE_NOT_FOUND]: '{{deviceName}}: File "{{fileName}}" not found on CasparCG server',
}

describe('ErrorMessageResolver', () => {
	describe('Device errors', () => {
		it('returns default message from TSR when no blueprint provided', () => {
			const resolver = new ErrorMessageResolver(undefined)
			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
					url: 'http://graphics/api',
					timeout: 5000,
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.HTTP_TIMEOUT]
			)

			expect(message).toBeTruthy()
			expect(message?.key).toBe('{{deviceName}}: HTTP request to {{url}} timed out after {{timeout}}ms')
			expect(message?.args).toMatchObject({
				deviceName: 'Graphics Server',
				url: 'http://graphics/api',
				timeout: 5000,
			})
		})

		it('returns blueprint custom message when provided', () => {
			const resolver = new ErrorMessageResolver({
				_id: protectString('blueprint123'),
				deviceErrorMessages: {
					[MockDeviceErrorCode.HTTP_TIMEOUT]: 'Graphics system {{deviceName}} not responding',
				},
				blueprintErrorMessages: undefined,
				systemErrorMessages: undefined,
			})

			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
					url: 'http://graphics/api',
					timeout: 5000,
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.HTTP_TIMEOUT]
			)

			expect(message).toBeTruthy()
			expect(message?.key).toBe('Graphics system {{deviceName}} not responding')
			expect(message?.args?.deviceName).toBe('Graphics Server')
		})

		it('returns null when blueprint provides empty string (suppression)', () => {
			const resolver = new ErrorMessageResolver({
				_id: protectString('blueprint123'),
				deviceErrorMessages: {
					[MockDeviceErrorCode.HTTP_TIMEOUT]: '',
				},
				blueprintErrorMessages: undefined,
				systemErrorMessages: undefined,
			})

			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.HTTP_TIMEOUT]
			)

			expect(message).toBeNull()
		})

		it('returns default for CasparCG errors', () => {
			const resolver = new ErrorMessageResolver(undefined)
			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.CASPARCG_FILE_NOT_FOUND,
				{
					deviceName: 'CasparCG1',
					fileName: 'video.mp4',
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.CASPARCG_FILE_NOT_FOUND]
			)

			expect(message).toBeTruthy()
			expect(message?.key).toContain('File')
			expect(message?.key).toContain('not found')
		})
	})

	describe('Blueprint errors', () => {
		it('returns default message when no blueprint provided', () => {
			const resolver = new ErrorMessageResolver(undefined)
			const message = resolver.getBlueprintErrorMessage(BlueprintErrorCode.MISSING_SEGMENT_DATA, {
				segmentId: 'seg123',
				field: 'timing',
			})

			expect(message).toBeTruthy()
			expect(message?.key).toContain('missing')
			expect(message?.args?.segmentId).toBe('seg123')
		})

		it('returns blueprint custom message', () => {
			const resolver = new ErrorMessageResolver({
				_id: protectString('blueprint123'),
				deviceErrorMessages: undefined,
				blueprintErrorMessages: {
					[BlueprintErrorCode.MISSING_SEGMENT_DATA]: 'Segment data incomplete - contact production',
				},
				systemErrorMessages: undefined,
			})

			const message = resolver.getBlueprintErrorMessage(BlueprintErrorCode.MISSING_SEGMENT_DATA, {
				segmentId: 'seg123',
				field: 'timing',
			})

			expect(message?.key).toBe('Segment data incomplete - contact production')
		})

		it('suppresses message with empty string', () => {
			const resolver = new ErrorMessageResolver({
				_id: protectString('blueprint123'),
				deviceErrorMessages: undefined,
				blueprintErrorMessages: {
					[BlueprintErrorCode.VALIDATION_ERROR]: '',
				},
				systemErrorMessages: undefined,
			})

			const message = resolver.getBlueprintErrorMessage(BlueprintErrorCode.VALIDATION_ERROR, {
				reason: 'test',
			})

			expect(message).toBeNull()
		})
	})

	describe('System errors', () => {
		it('returns default message when no blueprint provided', () => {
			const resolver = new ErrorMessageResolver(undefined)
			const message = resolver.getSystemErrorMessage(SystemErrorCode.DATABASE_CONNECTION_LOST, {
				database: 'MongoDB',
			})

			expect(message).toBeTruthy()
			expect(message?.key).toContain('Database')
			expect(message?.args?.database).toBe('MongoDB')
		})

		it('returns blueprint custom message', () => {
			const resolver = new ErrorMessageResolver({
				_id: protectString('blueprint123'),
				deviceErrorMessages: undefined,
				blueprintErrorMessages: undefined,
				systemErrorMessages: {
					[SystemErrorCode.DATABASE_CONNECTION_LOST]: 'System database offline - please wait',
				},
			})

			const message = resolver.getSystemErrorMessage(SystemErrorCode.DATABASE_CONNECTION_LOST, {
				database: 'MongoDB',
			})

			expect(message?.key).toBe('System database offline - please wait')
		})

		it('suppresses message with empty string', () => {
			const resolver = new ErrorMessageResolver({
				_id: protectString('blueprint123'),
				deviceErrorMessages: undefined,
				blueprintErrorMessages: undefined,
				systemErrorMessages: {
					[SystemErrorCode.INSUFFICIENT_RESOURCES]: '',
				},
			})

			const message = resolver.getSystemErrorMessage(SystemErrorCode.INSUFFICIENT_RESOURCES, {
				resource: 'memory',
			})

			expect(message).toBeNull()
		})
	})

	describe('Fallback behavior', () => {
		it('falls back to TSR default when blueprint has no customization for that error', () => {
			const resolver = new ErrorMessageResolver({
				_id: protectString('blueprint123'),
				deviceErrorMessages: {
					[MockDeviceErrorCode.HTTP_TIMEOUT]: 'Custom timeout message',
				},
				blueprintErrorMessages: undefined,
				systemErrorMessages: undefined,
			})

			// Ask for a different error that has no customization
			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.CASPARCG_DISCONNECTED,
				{
					deviceName: 'CasparCG1',
					host: 'localhost',
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.CASPARCG_DISCONNECTED]
			)

			expect(message).toBeTruthy()
			expect(message?.key).toContain('CasparCG')
		})
	})

	describe('Dynamic resolver function', () => {
		it('uses resolver function when it returns a message', () => {
			const resolverFn = jest.fn().mockReturnValue('Dynamic message for {{deviceName}}')

			const resolver = new ErrorMessageResolver(
				{
					_id: protectString('blueprint123'),
					deviceErrorMessages: {
						[MockDeviceErrorCode.HTTP_TIMEOUT]: 'Static message',
					},
					blueprintErrorMessages: undefined,
					systemErrorMessages: undefined,
				},
				resolverFn
			)

			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.HTTP_TIMEOUT]
			)

			expect(resolverFn).toHaveBeenCalledWith(MockDeviceErrorCode.HTTP_TIMEOUT, {
				deviceName: 'Graphics Server',
			})
			expect(message?.key).toBe('Dynamic message for {{deviceName}}')
		})

		it('falls through to static message when resolver returns undefined', () => {
			const resolverFn = jest.fn().mockReturnValue(undefined)

			const resolver = new ErrorMessageResolver(
				{
					_id: protectString('blueprint123'),
					deviceErrorMessages: {
						[MockDeviceErrorCode.HTTP_TIMEOUT]: 'Static fallback message',
					},
					blueprintErrorMessages: undefined,
					systemErrorMessages: undefined,
				},
				resolverFn
			)

			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.HTTP_TIMEOUT]
			)

			expect(resolverFn).toHaveBeenCalled()
			expect(message?.key).toBe('Static fallback message')
		})

		it('suppresses message when resolver returns empty string', () => {
			const resolverFn = jest.fn().mockReturnValue('')

			const resolver = new ErrorMessageResolver(
				{
					_id: protectString('blueprint123'),
					deviceErrorMessages: {
						[MockDeviceErrorCode.HTTP_TIMEOUT]: 'Should not see this',
					},
					blueprintErrorMessages: undefined,
					systemErrorMessages: undefined,
				},
				resolverFn
			)

			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.HTTP_TIMEOUT]
			)

			expect(resolverFn).toHaveBeenCalled()
			expect(message).toBeNull()
		})

		it('works for blueprint errors', () => {
			const resolverFn = jest.fn().mockReturnValue('Dynamic blueprint error')

			const resolver = new ErrorMessageResolver(
				{
					_id: protectString('blueprint123'),
					deviceErrorMessages: undefined,
					blueprintErrorMessages: undefined,
					systemErrorMessages: undefined,
				},
				resolverFn
			)

			const message = resolver.getBlueprintErrorMessage(BlueprintErrorCode.VALIDATION_ERROR, {
				reason: 'test',
			})

			expect(resolverFn).toHaveBeenCalledWith(BlueprintErrorCode.VALIDATION_ERROR, {
				reason: 'test',
			})
			expect(message?.key).toBe('Dynamic blueprint error')
		})

		it('works for system errors', () => {
			const resolverFn = jest.fn().mockReturnValue('Dynamic system error')

			const resolver = new ErrorMessageResolver(
				{
					_id: protectString('blueprint123'),
					deviceErrorMessages: undefined,
					blueprintErrorMessages: undefined,
					systemErrorMessages: undefined,
				},
				resolverFn
			)

			const message = resolver.getSystemErrorMessage(SystemErrorCode.DATABASE_CONNECTION_LOST, {
				database: 'MongoDB',
			})

			expect(resolverFn).toHaveBeenCalledWith(SystemErrorCode.DATABASE_CONNECTION_LOST, {
				database: 'MongoDB',
			})
			expect(message?.key).toBe('Dynamic system error')
		})

		it('works without blueprint (resolver function only)', () => {
			const resolverFn = jest.fn().mockReturnValue('Resolver-only message')

			const resolver = new ErrorMessageResolver(undefined, resolverFn)

			const message = resolver.getDeviceErrorMessage(
				MockDeviceErrorCode.HTTP_TIMEOUT,
				{
					deviceName: 'Server',
				},
				MockDeviceErrorMessages[MockDeviceErrorCode.HTTP_TIMEOUT]
			)

			expect(message?.key).toBe('Resolver-only message')
			// Should not have namespace prefix when no blueprint
			expect(message?.namespaces).toBeUndefined()
		})
	})
})
