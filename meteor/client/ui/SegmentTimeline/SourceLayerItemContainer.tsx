import * as React from 'react'
import { ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { useContentStatusForPieceInstance } from './withMediaObjectStatus'
import { UIStudio } from '../../../lib/api/studios'

interface IPropsHeader extends Omit<ISourceLayerItemProps, 'contentStatus'> {
	playlist: DBRundownPlaylist
	studio: UIStudio
}

export function SourceLayerItemContainer(props: IPropsHeader): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(props.piece.instance)

	return <SourceLayerItem {...props} contentStatus={contentStatus} />
}
