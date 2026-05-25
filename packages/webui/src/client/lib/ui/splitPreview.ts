import type {
	SourceLayerType,
	SplitsContentBoxContent,
	SplitsContentBoxProperties,
} from '@sofie-automation/blueprints-integration'
import type { SplitBoxPreviewUrls } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { literal } from '@sofie-automation/corelib/dist/lib'
import type { ReadonlyDeep } from 'type-fest'

const DEFAULT_POSITIONS = [
	{
		x: 0.25,
		y: 0.5,
		scale: 0.5,
	},
	{
		x: 0.75,
		y: 0.5,
		scale: 0.5,
	},
]

export enum SplitRole {
	ART = 0,
	BOX = 1,
}

export interface SplitSubItem {
	_id: string
	type: SourceLayerType
	label: string
	role: SplitRole
	content?: SplitsContentBoxProperties['geometry']
	thumbnailUrl?: string
	previewUrl?: string
}

export function getSplitPreview(
	boxSourceConfiguration:
		| (SplitsContentBoxContent & SplitsContentBoxProperties)[]
		| ReadonlyDeep<(SplitsContentBoxContent & SplitsContentBoxProperties)[]>,
	boxPreviews?: ReadonlyDeep<SplitBoxPreviewUrls[]>
): ReadonlyArray<Readonly<SplitSubItem>> {
	return boxSourceConfiguration.map((item, index) => {
		const boxPreview = boxPreviews?.[index]
		return literal<Readonly<SplitSubItem>>({
			_id: item.studioLabel + '_' + index,
			type: item.type,
			label: item.studioLabel,
			role: SplitRole.BOX,
			content: item.geometry || DEFAULT_POSITIONS[index],
			thumbnailUrl: boxPreview?.thumbnailUrl,
			previewUrl: boxPreview?.previewUrl,
		})
	})
}
