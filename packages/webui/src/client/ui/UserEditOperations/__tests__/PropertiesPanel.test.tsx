jest.mock('../../../../__mocks__/tracker', () => {
	interface TrackerComputation {
		stop: () => void
		_recompute: () => void
		invalidate: () => void
		onInvalidate: () => void
	}
	const computations = new Set<TrackerComputation>()

	return {
		setup: () => ({
			Tracker: {
				autorun: jest.fn((fn) => {
					const computation = {
						stop: jest.fn(),
						_recompute: () => fn(computation),
						invalidate: function () {
							this._recompute()
						},
						onInvalidate: jest.fn(),
					}
					computations.add(computation)
					fn(computation)
					return computation
				}),
				nonreactive: jest.fn((fn) => fn()),
				active: false,
				currentComputation: null,
				afterFlush: (fn: () => void) => {
					setTimeout(fn, 0)
				},
				flush: () => {
					computations.forEach((comp) => comp._recompute())
				},
				Dependency: jest.fn().mockImplementation(() => {
					const dependents = new Set<TrackerComputation>()
					return {
						depend: jest.fn(() => {
							if (Tracker.currentComputation) {
								dependents.add(Tracker.currentComputation as any as TrackerComputation)
							}
						}),
						changed: jest.fn(() => {
							dependents.forEach((comp) => comp.invalidate())
						}),
						hasDependents: jest.fn(() => dependents.size > 0),
					}
				}),
			},
		}),
	}
})

// Mock the ReactiveDataHelper:
jest.mock('../../../lib/reactiveData/ReactiveDataHelper', () => {
	interface MockSubscription {
		stop: () => void
		ready: () => boolean
	}

	class MockReactiveDataHelper {
		protected _subs: MockSubscription[] = []
		protected _computations: any[] = []

		protected subscribe(_name: string, ..._args: any[]): MockSubscription {
			const sub: MockSubscription = {
				stop: jest.fn(),
				ready: jest.fn().mockReturnValue(true),
			}
			this._subs.push(sub)
			return sub
		}

		protected autorun(f: () => void) {
			// Execute the function immediately
			f()
			const computation = {
				stop: jest.fn(),
				_recompute: () => f(),
				invalidate: function () {
					this._recompute()
				},
				onInvalidate: jest.fn(),
			}
			this._computations.push(computation)
			return computation
		}

		destroy() {
			this._subs.forEach((sub) => sub.stop())
			this._computations.forEach((comp) => comp.stop())
			this._subs = []
			this._computations = []
		}
	}

	class MockWithManagedTracker extends MockReactiveDataHelper {
		constructor() {
			super()
		}

		triggerUpdate() {
			this._computations.forEach((comp) => comp.invalidate())
		}
	}

	return {
		__esModule: true,
		WithManagedTracker: MockWithManagedTracker,
		meteorSubscribe: jest.fn().mockReturnValue({
			stop: jest.fn(),
			ready: jest.fn().mockReturnValue(true),
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
import { renderHook, act, render, screen, waitFor } from '@testing-library/react'
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
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Tracker } from 'meteor/tracker'

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
		jest.useFakeTimers()
	})

	afterEach(() => {
		jest.useRealTimers()
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
				label: { key: 'TEST_LABEL', namespaces: ['blueprint_main-showstyle'] },
				type: UserEditingType.ACTION,
				buttonType: UserEditingButtonType.SWITCH,
				isActive: false,
				svgIcon: '<svg></svg>',
			},
		],
		isHidden: false,
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
				label: { key: 'TEST_PART_LABEL', namespaces: ['blueprint_main-showstyle'] },
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

		const mockId = mockSegmentsCollection.insert(mockSegment) as any as SegmentId

		const verifySegment = mockSegmentsCollection.findOne({ _id: mockId })
		expect(verifySegment).toBeTruthy()
		console.log('Verify segment :', verifySegment?._id)

		expect(mockSegmentsCollection.findOne({ _id: mockId })).toBeTruthy()

		const { result } = renderHook(() => useSelection(), { wrapper })

		// Update selection and wait for component to update
		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockId,
			})
		})

		await act(async () => {
			jest.advanceTimersByTime(100)
		})

		// Open component after segment is selected (as used in rundownview)
		const { container } = render(<PropertiesPanel />, { wrapper })

		await act(async () => {
			jest.advanceTimersByTime(100)
		})

		console.log('result', result.current.listSelectedElements())
		// Use findByTestId instead of querySelector
		await waitFor(
			() => {
				expect(screen.getByText(`SEGMENT : ${mockSegment.name}`)).toBeInTheDocument()
			},
			{ timeout: 1000 }
		)

		const button = container.querySelector('.propertiespanel-pop-up__button')
		expect(button).toBeInTheDocument()
	})

	test('renders part properties when part is selected', async () => {
		const mockSegment = createMockSegment('segment1')
		const mockPart = createMockPart('part1', String(mockSegment._id))

		mockSegmentsCollection.insert(mockSegment)
		mockPartsCollection.insert(mockPart)

		const { result } = renderHook(() => useSelection(), { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'part',
				elementId: mockPart._id,
			})
		})
		// Open component after part is selected (as used in rundownview)
		const { container } = render(<PropertiesPanel />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText(`PART : ${mockPart.title}`)).toBeInTheDocument()
			},
			{ timeout: 1000 }
		)

		const button = container.querySelector('.propertiespanel-pop-up__button')
		expect(button).toBeInTheDocument()
	})

	test('handles user edit operations for segments', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		const { result } = renderHook(() => useSelection(), { wrapper })
		const { container } = render(<PropertiesPanel />, { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		// Wait for the switch button to be available
		const switchButton = await waitFor(() => container.querySelector('.propertiespanel-pop-up__switchbutton'))
		expect(switchButton).toBeTruthy()

		// Toggle the switch
		await act(async () => {
			await userEvent.click(switchButton!)
		})

		// Check if commit button is enabled
		const commitButton = screen.getByText('COMMIT CHANGES')
		expect(commitButton).toBeEnabled()

		// Commit changes
		await act(async () => {
			await userEvent.click(commitButton)
		})

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

		const { result } = renderHook(() => useSelection(), { wrapper })
		const { container } = render(<PropertiesPanel />, { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		// Wait for the switch button to be available
		const switchButton = await waitFor(() => container.querySelector('.propertiespanel-pop-up__switchbutton'))

		// Make a change
		await act(async () => {
			await userEvent.click(switchButton!)
		})

		// Click revert button
		const revertButton = screen.getByText('REVERT CHANGES')
		await act(async () => {
			await userEvent.click(revertButton)
		})

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
	}, 10000) // Increase timeout for this test

	test('closes panel when close button is clicked', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		const { result } = renderHook(() => useSelection(), { wrapper })
		const { container } = render(<PropertiesPanel />, { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		const closeButton = await waitFor(() => container.querySelector('.propertiespanel-pop-up_close'))
		expect(closeButton).toBeTruthy()

		await act(async () => {
			await userEvent.click(closeButton!)
		})

		expect(container.querySelector('.propertiespanel-pop-up__contents')).toBeFalsy()
	})
})
