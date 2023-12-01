import React, { useCallback, useState } from 'react'
import ClassNames from 'classnames'

interface IIntInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	zeroBased?: boolean
	value: number | undefined
	handleUpdate: (value: number) => void

	min?: number
	max?: number
	step?: number
}
export function IntInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
	zeroBased,
	min,
	max,
	step,
}: Readonly<IIntInputControlProps>): JSX.Element {
	const [editingValue, setEditingValue] = useState<number | null>(null)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const number = parseInt(event.target.value, 10)
			setEditingValue(number)

			if (updateOnKey && !isNaN(number)) {
				handleUpdate(zeroBased ? number - 1 : number)
			}
		},
		[handleUpdate, updateOnKey, zeroBased]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			const number = parseInt(event.currentTarget.value, 10)
			if (!isNaN(number)) {
				handleUpdate(zeroBased ? number - 1 : number)
			}

			setEditingValue(null)
		},
		[handleUpdate, zeroBased]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
		setEditingValue(parseInt(event.currentTarget.value, 10))
	}, [])
	const handleKeyUp = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Escape') {
				setEditingValue(null)
			} else if (event.key === 'Enter') {
				const number = parseInt(event.currentTarget.value, 10)
				if (!isNaN(number)) {
					handleUpdate(zeroBased ? number - 1 : number)
				}
			}
		},
		[handleUpdate, zeroBased]
	)

	let showValue: string | number | undefined = editingValue ?? undefined
	if (showValue === undefined && value !== undefined) {
		showValue = zeroBased ? value + 1 : value
	}
	if (showValue === undefined || isNaN(Number(showValue))) showValue = ''

	return (
		<input
			type="number"
			step={step ?? 1}
			min={min}
			max={max}
			className={ClassNames('form-control', classNames, editingValue !== null && modifiedClassName)}
			placeholder={placeholder}
			value={showValue ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleKeyUp}
			disabled={disabled}
		/>
	)
}
