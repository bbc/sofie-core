type Props = {
	editable: boolean | undefined
	label: string
	labelRef: React.Ref<HTMLTextAreaElement>
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
	onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void
	onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function EditableLabel(props: Props): JSX.Element {
	if (props.editable) {
		return (
			<textarea
				ref={props.labelRef}
				className="dashboard-panel__panel__button__label dashboard-panel__panel__button__label--editable"
				value={props.label}
				onChange={props.onChange}
				onBlur={props.onBlur}
				onKeyUp={props.onKeyUp}
			/>
		)
	}

	return <div className="dashboard-panel__panel__button__label">{props.label}</div>
}
