import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ClassNames from 'classnames'
import { PieceDisplayStyle } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownUtils } from '../../../lib/rundown.js'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { DEFAULT_BUTTON_HEIGHT, DEFAULT_BUTTON_WIDTH } from './types.js'
import { DashboardButtonTagStrip } from './subcomponents/DashboardButtonTagStrip.js'
import { HotkeyBadge } from './subcomponents/HotkeyBadge.js'
import { EditableLabel } from './subcomponents/EditableLabel.js'
import { MediaBox } from './subcomponents/MediaBox.js'
import { useDashboardButtonInteractions } from './useDashboardButtonInteractions.js'
import { DashboardPieceButtonContentProps } from './DashboardPieceButtonContent.js'

export const DashboardPieceButtonCompactContent = React.forwardRef<HTMLDivElement, DashboardPieceButtonContentProps>(
	function DashboardPieceButtonCompactContent(props, forwardedRef): JSX.Element {
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
			showHotkey = true,
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
		const hasMediaBox = useMemo(() => {
			if (disableHoverInspector || !layer) return false
			if (!(layer.type === SourceLayerType.VT || layer.type === SourceLayerType.LIVE_SPEAK)) return false

			const isButtons = displayStyle === PieceDisplayStyle.BUTTONS
			const shouldRenderThumbnail = isButtons || (isList && showThumbnailsInList)
			if (!shouldRenderThumbnail) return false

			const chosenUrl = props.contentStatus?.thumbnailUrl || props.contentStatus?.previewUrl
			if (chosenUrl) return true

			switch (props.contentStatus?.status) {
				case PieceStatusCode.SOURCE_BROKEN:
				case PieceStatusCode.SOURCE_MISSING:
				case PieceStatusCode.SOURCE_UNKNOWN_STATE:
				case PieceStatusCode.SOURCE_NOT_READY:
				case PieceStatusCode.UNKNOWN:
				case undefined:
					return true
				default:
					return false
			}
		}, [
			disableHoverInspector,
			layer,
			displayStyle,
			isList,
			showThumbnailsInList,
			props.contentStatus?.previewUrl,
			props.contentStatus?.thumbnailUrl,
			props.contentStatus?.status,
		])

		return (
			<div
				className={ClassNames(
					'dashboard-panel__panel__button',
					{
						'dashboard-panel__panel__button--compact': true,
						invalid: piece.invalid,
						floated: piece.floated,
						active,
						live: isOnAir,
						disabled: disabled,
						list: isList,
						selected: isNext || isSelected,
						'dashboard-panel__panel__button--has-hotkey': showHotkey && Boolean(piece.hotkey),
						'dashboard-panel__panel__button--no-media': showHotkey && Boolean(piece.hotkey) && !hasMediaBox,
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
					<MediaBox
						piece={piece}
						layer={layer}
						studio={studio}
						displayStyle={displayStyle}
						showThumbnailsInList={showThumbnailsInList}
						disableHoverInspector={disableHoverInspector}
						contentStatus={props.contentStatus}
					/>
					{showHotkey ? <HotkeyBadge hotkey={piece.hotkey} /> : null}
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
						<DashboardButtonTagStrip layerTypeClassName={layerTypeClassName} />
					</div>
				</div>
			</div>
		)
	}
)
