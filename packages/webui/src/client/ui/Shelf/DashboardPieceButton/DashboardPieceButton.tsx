import React, { useContext } from 'react'
import { PreviewPopUpContext } from '../../PreviewPopUp/PreviewPopUpContext.js'
import { useContentStatusForItem } from '../../SegmentTimeline/withMediaObjectStatus.js'
import type { IDashboardButtonProps } from './types.js'
import { DashboardPieceButtonContent } from './DashboardPieceButtonContent.js'

export function DashboardPieceButton(props: React.PropsWithChildren<IDashboardButtonProps>): JSX.Element {
	const contentStatus = useContentStatusForItem(props.piece)
	const previewContext = useContext(PreviewPopUpContext)

	return <DashboardPieceButtonContent {...props} contentStatus={contentStatus} previewContext={previewContext} />
}
