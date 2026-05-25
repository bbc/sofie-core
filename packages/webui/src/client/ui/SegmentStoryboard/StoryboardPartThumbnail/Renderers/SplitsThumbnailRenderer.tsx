import type { IProps } from './ThumbnailRendererFactory.js'
import { getSplitItems } from '../../../SegmentContainer/getSplitItems.js'
import { useContentStatusForPieceInstance } from '../../../SegmentTimeline/withMediaObjectStatus.js'

export function SplitsThumbnailRenderer({ pieceInstance }: Readonly<IProps>): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(pieceInstance.instance)
	const splitItems = getSplitItems(pieceInstance, 'segment-storyboard__thumbnail__item', contentStatus?.boxPreviews)

	return (
		<>
			<div className="segment-storyboard__thumbnail__contents">{splitItems}</div>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
