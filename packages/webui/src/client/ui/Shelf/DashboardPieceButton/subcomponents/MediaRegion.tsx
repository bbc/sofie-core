import { useMemo } from 'react'
import { PieceDisplayStyle } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { SourceLayerType, VTContent } from '@sofie-automation/blueprints-integration'
import type { ReadonlyDeep } from 'type-fest'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import type { IDashboardButtonProps } from '../types'
import { DashboardButtonSubLabel } from './DashboardButtonSubLabel'
import { DashboardButtonThumbnail } from './DashboardButtonThumbnail'
import { DashboardPieceButtonSplitPreview } from '../../DashboardPieceButtonSplitPreview.js'
import SplitInputIcon from '../../../PieceIcons/Renderers/SplitInputIcon.js'

type Props = Pick<
	IDashboardButtonProps,
	'piece' | 'layer' | 'studio' | 'displayStyle' | 'showThumbnailsInList' | 'disableHoverInspector'
> & {
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
}

export function MediaRegion(props: Props): JSX.Element | null {
	const { piece, layer, studio, displayStyle, showThumbnailsInList, disableHoverInspector, contentStatus } = props

	const isList = displayStyle === PieceDisplayStyle.LIST
	const isButtons = displayStyle === PieceDisplayStyle.BUTTONS
	const shouldRenderThumbnail = isButtons || (isList && showThumbnailsInList)

	const chosenUrl = useMemo(() => contentStatus?.thumbnailUrl || contentStatus?.previewUrl, [contentStatus])

	if (disableHoverInspector || !layer) return null

	if (layer.type === SourceLayerType.VT || layer.type === SourceLayerType.LIVE_SPEAK) {
		const vtContent = piece.content as VTContent | undefined
		const sourceDuration = vtContent?.sourceDuration

		return (
			<>
				{sourceDuration ? (
					<DashboardButtonSubLabel sourceDuration={sourceDuration} studioSettings={studio?.settings} />
				) : null}
				{chosenUrl && shouldRenderThumbnail ? <DashboardButtonThumbnail url={chosenUrl} /> : null}
			</>
		)
	}

	if (layer.type === SourceLayerType.SPLITS) {
		if (isList && showThumbnailsInList) {
			return <DashboardPieceButtonSplitPreview piece={piece} />
		}

		return <SplitInputIcon abbreviation={layer?.abbreviation} piece={piece} hideLabel={true} />
	}

	return null
}
