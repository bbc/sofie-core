// Mock the ReactiveDataHelper:
jest.mock('../../../lib/reactiveData/ReactiveDataHelper', () => {
	class MockReactiveDataHelper {
		protected _subs: Array<{ stop: () => void }> = []

		protected subscribe() {
			const sub = { stop: jest.fn() }
			this._subs.push(sub)
			return sub
		}

		protected autorun(f: () => void) {
			f()
			return { stop: jest.fn() }
		}

		destroy() {
			this._subs.forEach((sub) => sub.stop())
			this._subs = []
		}
	}

	class MockWithManagedTracker extends MockReactiveDataHelper {
		constructor() {
			super()
		}
	}

	return {
		__esModule: true,
		WithManagedTracker: MockWithManagedTracker,
		meteorSubscribe: jest.fn().mockReturnValue({
			stop: jest.fn(),
		}),
	}
})

jest.mock('i18next', () => ({
	use: jest.fn().mockReturnThis(),
	init: jest.fn().mockImplementation(() => Promise.resolve()),
	t: (key: string) => key,
	changeLanguage: jest.fn().mockImplementation(() => Promise.resolve()),
	language: 'en',
	exists: jest.fn(),
	on: jest.fn(),
	off: jest.fn(),
	options: {},
}))

// React-i18next with Promise support
jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: {
			changeLanguage: jest.fn().mockImplementation(() => Promise.resolve()),
			language: 'en',
			exists: jest.fn(),
			use: jest.fn().mockReturnThis(),
			init: jest.fn().mockImplementation(() => Promise.resolve()),
			on: jest.fn(),
			off: jest.fn(),
			options: {},
		},
	}),
	initReactI18next: {
		type: '3rdParty',
		init: jest.fn(),
	},
}))

import React from 'react'
// eslint-disable-next-line node/no-unpublished-import
import { renderHook, act, render, screen, RenderResult } from '@testing-library/react'
// eslint-disable-next-line node/no-unpublished-import
import '@testing-library/jest-dom'
import { MeteorCall } from '../../../lib/meteorApi'
import { TFunction } from 'i18next'

import userEvent from '@testing-library/user-event'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { UIParts } from '../../Collections'
import { Segments } from '../../../../client/collections'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { UserEditingType, UserEditingButtonType } from '@sofie-automation/blueprints-integration'
import { SelectedElementProvider, useSelection } from '../../RundownView/SelectedElementsContext'
import { MongoMock } from '../../../../__mocks__/mongo'
import { PropertiesPanel } from '../PropertiesPanel'
import { UserAction } from '../../../lib/clientUserAction'

const mockSegmentsCollection = MongoMock.getInnerMockCollection(Segments)
const mockPartsCollection = MongoMock.getInnerMockCollection(UIParts)

// Mock Client User Action:
jest.mock('../../../lib/clientUserAction', () => ({
	doUserAction: jest.fn((_t: TFunction, e: unknown, _action: UserAction, callback: Function) =>
		callback(e, Date.now())
	),
}))

// Mock Userchange Operation:
jest.mock('../../../lib/meteorApi', () => ({
	__esModule: true,
	MeteorCall: {
		userAction: {
			executeUserChangeOperation: jest.fn(),
		},
	},
}))

// Mock SchemaFormInPlace Component
jest.mock('../../../lib/forms/SchemaFormInPlace', () => ({
	SchemaFormInPlace: () => <div data-testid="schema-form">Schema Form</div>,
}))

describe('PropertiesPanel', () => {
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<SelectedElementProvider>{children}</SelectedElementProvider>
	)

	beforeEach(() => {
		mockSegmentsCollection.remove({})
		mockPartsCollection.remove({})
		jest.clearAllMocks()
	})

	const createMockSegment = (id: string): DBSegment => ({
		_id: protectString(id),
		_rank: 1,
		name: `Segment ${id}`,
		rundownId: protectString('rundown1'),
		externalId: `ext_${id}`,
		userEditOperations: [
			{
				id: 'operation1',
				label: { key: 'TEST_LABEL' },
				type: UserEditingType.ACTION,
				buttonType: UserEditingButtonType.SWITCH,
				isActive: false,
			},
		],
	})

	const createMockPart = (id: string, segmentId: string): DBPart => ({
		_id: protectString(id),
		_rank: 1,
		expectedDurationWithTransition: 0,
		title: `Part ${id}`,
		rundownId: protectString('rundown1'),
		segmentId: protectString(segmentId),
		externalId: `ext_${id}`,
		userEditOperations: [
			{
				id: 'operation2',
				label: { key: 'TEST_PART_LABEL' },
				type: UserEditingType.ACTION,
				buttonType: UserEditingButtonType.BUTTON,
				isActive: true,
			},
		],
	})

	test('renders empty when no element selected', () => {
		const { container } = render(<PropertiesPanel />, { wrapper })
		expect(container.querySelector('.properties-panel')).toBeTruthy()
		expect(container.querySelector('.propertiespanel-pop-up__contents')).toBeFalsy()
	})

	test('renders segment properties when segment is selected', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		// Create a custom wrapper that includes both providers
		const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
			<SelectedElementProvider>{children}</SelectedElementProvider>
		)

		// Render both the hook and component in the same provider tree
		const { result } = renderHook(() => useSelection(), { wrapper: TestWrapper })
		let rendered: RenderResult

		await act(async () => {
			rendered = render(<PropertiesPanel />, { wrapper: TestWrapper })
		})

		// Update selection
		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})
		//@ts-expect-error error because avoiding an undefined type
		if (!rendered) throw new Error('Component not rendered')

		// Force a rerender
		await act(async () => {
			rendered.rerender(<PropertiesPanel />)
		})

		// Wait for the header element to appear
		await screen.findByText('SEGMENT : Segment segment1')

		const header = rendered.container.querySelector('.propertiespanel-pop-up__header')
		const switchButton = rendered.container.querySelector('.propertiespanel-pop-up__switchbutton')

		expect(header).toHaveTextContent('SEGMENT : Segment segment1')
		expect(switchButton).toBeTruthy()
	})

	test('renders part properties when part is selected', async () => {
		const mockSegment = createMockSegment('segment1')
		const mockPart = createMockPart('part1', String(mockSegment._id))

		mockSegmentsCollection.insert(mockSegment)
		mockPartsCollection.insert(mockPart)

		// Create a custom wrapper that includes both providers
		const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
			<SelectedElementProvider>{children}</SelectedElementProvider>
		)

		// Render both the hook and component in the same provider tree
		const { result } = renderHook(() => useSelection(), { wrapper: TestWrapper })
		let rendered: RenderResult

		await act(async () => {
			rendered = render(<PropertiesPanel />, { wrapper: TestWrapper })
		})

		// Update selection
		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'part',
				elementId: mockPart._id,
			})
		})

		//@ts-expect-error error because avoiding an undefined type
		if (!rendered) throw new Error('Component not rendered')

		// Force a rerender
		await act(async () => {
			rendered.rerender(<PropertiesPanel />)
		})

		// Wait for the header element to appear
		await screen.findByText('PART : Part part1')

		const header = rendered.container.querySelector('.propertiespanel-pop-up__header')
		const button = rendered.container.querySelector('.propertiespanel-pop-up__button')

		expect(header).toHaveTextContent('PART : Part part1')
		expect(button).toBeTruthy()
	})

	test('handles user edit operations for segments', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		// First render the selection hook
		const { result } = renderHook(() => useSelection(), { wrapper })

		// Then render the properties panel
		const { container } = render(<PropertiesPanel />, { wrapper })

		// Update selection using the hook result
		act(() => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		const switchButton = container.querySelector('.propertiespanel-pop-up__switchbutton')
		expect(switchButton).toBeTruthy()

		// Toggle the switch
		await userEvent.click(switchButton!)

		// Check if commit button is enabled
		const commitButton = screen.getByText('COMMIT CHANGES')
		expect(commitButton).toBeEnabled()

		// Commit changes
		await userEvent.click(commitButton)

		expect(MeteorCall.userAction.executeUserChangeOperation).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			protectString('rundown1'),
			{
				segmentExternalId: mockSegment.externalId,
				partExternalId: undefined,
				pieceExternalId: undefined,
			},
			{
				id: 'operation1',
				values: undefined,
			}
		)
	})

	test('handles revert changes', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		// First render the selection hook
		const { result } = renderHook(() => useSelection(), { wrapper })

		// Then render the properties panel
		const { container } = render(<PropertiesPanel />, { wrapper })

		// Update selection using the hook result
		act(() => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		// Make a change
		const switchButton = container.querySelector('.propertiespanel-pop-up__switchbutton')
		await userEvent.click(switchButton!)

		// Click revert button
		const revertButton = screen.getByText('REVERT CHANGES')
		await userEvent.click(revertButton)

		expect(MeteorCall.userAction.executeUserChangeOperation).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			protectString('rundown1'),
			{
				segmentExternalId: mockSegment.externalId,
				partExternalId: undefined,
				pieceExternalId: undefined,
			},
			{
				id: 'REVERT_SEGMENT',
			}
		)
	})

	test('closes panel when close button is clicked', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		// First render the selection hook
		const { result } = renderHook(() => useSelection(), { wrapper })

		// Then render the properties panel
		const { container } = render(<PropertiesPanel />, { wrapper })

		// Update selection using the hook result
		act(() => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		const closeButton = container.querySelector('.propertiespanel-pop-up_close')
		expect(closeButton).toBeTruthy()

		await userEvent.click(closeButton!)

		expect(container.querySelector('.propertiespanel-pop-up__contents')).toBeFalsy()
	})
})
