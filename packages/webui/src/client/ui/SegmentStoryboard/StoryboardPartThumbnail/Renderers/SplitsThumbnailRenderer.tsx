import { IProps } from './ThumbnailRendererFactory'
import { getSplitItems } from '../../../SegmentContainer/getSplitItems'

export function SplitsThumbnailRenderer({ pieceInstance }: Readonly<IProps>): JSX.Element {
	const splitItems = getSplitItems(pieceInstance, 'segment-storyboard__thumbnail__item')

	return (
		<>
			<div className="segment-storyboard__thumbnail__contents">{splitItems}</div>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
