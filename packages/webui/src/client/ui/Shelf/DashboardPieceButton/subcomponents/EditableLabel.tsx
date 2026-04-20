type Props = {
	editable: boolean | undefined
	label: string
	labelRef: React.Ref<HTMLTextAreaElement>
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
	onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void
	onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function EditableLabel(props: Props): JSX.Element {
	return (
		<div
			className={[
				'dashboard-panel__panel__button__label',
				props.editable ? 'dashboard-panel__panel__button__label--editable' : undefined,
			]
				.filter(Boolean)
				.join(' ')}
		>
			{props.editable ? (
				<textarea
					ref={props.labelRef}
					className="dashboard-panel__panel__button__label__content dashboard-panel__panel__button__label__content--editable"
					value={props.label}
					onChange={props.onChange}
					onBlur={props.onBlur}
					onKeyUp={props.onKeyUp}
				/>
			) : (
				<div className="dashboard-panel__panel__button__label__content">{props.label}</div>
			)}
		</div>
	)
}
