import type { SplitsContentBoxContent, SplitsContentBoxProperties } from '@sofie-automation/blueprints-integration'
import type { SplitBoxPreviewUrls } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import classNames from 'classnames'
import { useMemo } from 'react'
import { getSplitPreview, SplitRole } from '../../../lib/ui/splitPreview.js'
import type { ReadonlyDeep } from 'type-fest'
import { RundownUtils } from '../../../lib/rundown.js'

interface BoxLayoutPreviewProps {
	content: {
		type: 'boxLayout'
		boxSourceConfiguration: ReadonlyDeep<(SplitsContentBoxContent & SplitsContentBoxProperties)[]>
		boxPreviews?: ReadonlyDeep<SplitBoxPreviewUrls[]>
		showLabels?: boolean
		backgroundArtSrc?: string
	}
}

export function BoxLayoutPreview({ content }: BoxLayoutPreviewProps): React.ReactElement {
	const reversedItems = useMemo(
		() =>
			content.boxSourceConfiguration
				? getSplitPreview(content.boxSourceConfiguration, content.boxPreviews).slice().reverse()
				: [],
		[content.boxSourceConfiguration, content.boxPreviews]
	)

	return (
		<div className="preview-popUp__box-layout">
			{content.backgroundArtSrc && (
				<div className="video-preview background">
					<img src={content.backgroundArtSrc} alt="" />
				</div>
			)}
			{reversedItems.map((item, index, array) => (
				<div
					className={classNames(
						'video-preview',
						RundownUtils.getSourceLayerClassName(item.type),
						{
							background: item.role === SplitRole.ART,
							box: item.role === SplitRole.BOX,
						},
						{
							second: array.length > 1 && index > 0 && item.type === array[index - 1].type,
						},
						{ upper: index >= array.length / 2 },
						{ lower: index < array.length / 2 }
					)}
					key={item._id + '-preview'}
					style={{
						left: ((item.content?.x ?? 0) * 100).toString() + '%',
						top: ((item.content?.y ?? 0) * 100).toString() + '%',
						width: ((item.content?.scale ?? 1) * 100).toString() + '%',
						height: ((item.content?.scale ?? 1) * 100).toString() + '%',
						clipPath: item.content?.crop
							? `inset(${item.content.crop.top * 100}% ${item.content.crop.right * 100}% ${
									item.content.crop.bottom * 100
								}% ${item.content.crop.left * 100}%)`
							: undefined,
					}}
				>
					{(item.thumbnailUrl || item.previewUrl) && (
						<img src={item.thumbnailUrl || item.previewUrl} alt="" className="video-preview__image" />
					)}
					{content.showLabels && item.role === SplitRole.BOX && (
						<div className="video-preview__label">{item.label}</div>
					)}
				</div>
			))}
		</div>
	)
}
