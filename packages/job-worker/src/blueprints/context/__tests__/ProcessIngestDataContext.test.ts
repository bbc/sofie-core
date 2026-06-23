import { setupDefaultJobEnvironment } from '../../../__mocks__/context.js'
import { ProcessIngestDataContext } from '../ProcessIngestDataContext.js'

describe('ProcessIngestDataContext', () => {
	function createContext(): ProcessIngestDataContext {
		const jobContext = setupDefaultJobEnvironment()

		return new ProcessIngestDataContext(
			{
				name: 'test',
				identifier: 'test',
			},
			jobContext.studio,
			jobContext.getStudioBlueprintConfig()
		)
	}

	test('requestSyncIngestUpdateToPartInstance is one-shot', () => {
		const context = createContext()

		expect(context.consumeRequestSyncIngestUpdateToPartInstance()).toBe(false)

		context.requestSyncIngestUpdateToPartInstance()
		expect(context.consumeRequestSyncIngestUpdateToPartInstance()).toBe(true)
		expect(context.consumeRequestSyncIngestUpdateToPartInstance()).toBe(false)
	})

	test('multiple requests collapse into a single consume result', () => {
		const context = createContext()

		context.requestSyncIngestUpdateToPartInstance()
		context.requestSyncIngestUpdateToPartInstance()

		expect(context.consumeRequestSyncIngestUpdateToPartInstance()).toBe(true)
		expect(context.consumeRequestSyncIngestUpdateToPartInstance()).toBe(false)
	})
})
