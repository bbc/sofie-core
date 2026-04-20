import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ClassNames from 'classnames'
import { PieceDisplayStyle } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownUtils } from '../../../lib/rundown.js'
import type { ReadonlyDeep } from 'type-fest'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import type { IPreviewPopUpContext } from '../../PreviewPopUp/PreviewPopUpContext.js'
import type { IDashboardButtonProps } from './types.js'
import { DEFAULT_BUTTON_HEIGHT, DEFAULT_BUTTON_WIDTH } from './types.js'
import { DashboardButtonTagStrip } from './subcomponents/DashboardButtonTagStrip.js'
import { HotkeyBadge } from './subcomponents/HotkeyBadge.js'
import { EditableLabel } from './subcomponents/EditableLabel.js'
import { MediaRegion } from './subcomponents/MediaRegion.js'
import { useDashboardButtonInteractions } from './useDashboardButtonInteractions.js'

export type DashboardPieceButtonContentProps = React.PropsWithChildren<IDashboardButtonProps> & {
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
	previewContext: IPreviewPopUpContext
}

export const DashboardPieceButtonContent = React.forwardRef<HTMLDivElement, DashboardPieceButtonContentProps>(
	function DashboardPieceButtonContent(props, forwardedRef): JSX.Element {
		const {
			piece,
			layer,
			displayStyle,
			widthScale,
			heightScale,
			isOnAir,
			isNext,
			isSelected,
			disabled,
			showThumbnailsInList,
			disableHoverInspector,
			toggleOnSingleClick,
			queueAllAdlibs,
			canOverflowHorizontally,
			editableName,
			onNameChanged,
			studio,
		} = props

		const [label, setLabel] = useState(piece.name)
		const [active] = useState(false)

		useEffect(() => {
			setLabel(piece.name)
		}, [piece.name])

		const labelElRef = useRef<HTMLTextAreaElement | null>(null)

		const layerTypeClassName = useMemo(
			() => (layer ? RundownUtils.getSourceLayerClassName(layer.type) : undefined),
			[layer]
		)

		const interactions = useDashboardButtonInteractions({
			piece,
			layer,
			contentStatus: props.contentStatus,
			previewContext: props.previewContext,
			toggleOnSingleClick,
			queueAllAdlibs,
			canOverflowHorizontally,
			onToggleAdLib: props.onToggleAdLib,
			onSelectAdLib: props.onSelectAdLib,
		})

		useEffect(() => {
			if (editableName && labelElRef.current) {
				labelElRef.current.focus()
				labelElRef.current.setSelectionRange(0, labelElRef.current.value.length)
			}
		}, [editableName])

		const onLabelChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => setLabel(e.currentTarget.value || ''),
			[]
		)

		const onLabelBlur = useCallback(
			(e: React.FocusEvent<HTMLTextAreaElement>) => {
				if (!label.trim()) {
					e.persist()
					setLabel(piece.name)
					interactions.deferredNameChange(() => onNameChanged?.(e, piece.name))
				} else {
					onNameChanged?.(e, label)
				}
			},
			[interactions, label, onNameChanged, piece.name]
		)

		const onLabelKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (e.key === 'Escape') {
					setLabel(piece.name)
					labelElRef.current?.blur()
					e.preventDefault()
					e.stopPropagation()
				} else if (e.key === 'Enter') {
					labelElRef.current?.blur()
					e.preventDefault()
					e.stopPropagation()
				}
			},
			[piece.name]
		)

		const isList = displayStyle === PieceDisplayStyle.LIST

		return (
			<div
				className={ClassNames(
					'dashboard-panel__panel__button',
					{
						invalid: piece.invalid,
						floated: piece.floated,
						active,
						live: isOnAir,
						disabled: disabled,
						list: isList,
						selected: isNext || isSelected,
					},
					RundownUtils.getPieceStatusClassName(props.contentStatus?.status),
					...(piece.tags ? piece.tags.map((tag) => `piece-tag--${tag}`) : [])
				)}
				style={{
					width: isList ? 'calc(100% - 8px)' : widthScale ? widthScale * DEFAULT_BUTTON_WIDTH + 'em' : undefined,
					height: !isList && heightScale ? heightScale * DEFAULT_BUTTON_HEIGHT + 'em' : undefined,
				}}
				onClick={interactions.onClick}
				onDoubleClick={interactions.onDoubleClick}
				ref={(node) => {
					interactions.elementRef.current = node
					if (typeof forwardedRef === 'function') {
						forwardedRef(node)
					} else if (forwardedRef) {
						;(forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node
					}
				}}
				onMouseDown={interactions.onMouseDown}
				onPointerEnter={interactions.onPointerEnter}
				onPointerLeave={interactions.onPointerLeave}
				onMouseMove={interactions.onMouseMove}
				onPointerDown={interactions.onPointerDown}
				onPointerOut={interactions.onPointerOut}
				onPointerUp={interactions.onPointerUp}
				onTouchStart={interactions.onTouchStart}
				onTouchEnd={interactions.onTouchEnd}
				onTouchMove={interactions.onTouchMove}
				data-obj-id={piece._id}
			>
				<div className="dashboard-panel__panel__button__content">
					<MediaRegion
						piece={piece}
						layer={layer}
						studio={studio}
						displayStyle={displayStyle}
						showThumbnailsInList={showThumbnailsInList}
						disableHoverInspector={disableHoverInspector}
						contentStatus={props.contentStatus}
					/>
					<HotkeyBadge hotkey={piece.hotkey} />
					<div className="dashboard-panel__panel__button__label-container">
						<DashboardButtonTagStrip layerTypeClassName={layerTypeClassName} />
						<EditableLabel
							editable={editableName}
							label={label}
							labelRef={(el) => {
								labelElRef.current = el
							}}
							onChange={onLabelChange}
							onBlur={onLabelBlur}
							onKeyUp={onLabelKeyUp}
						/>
					</div>
				</div>
			</div>
		)
	}
)
