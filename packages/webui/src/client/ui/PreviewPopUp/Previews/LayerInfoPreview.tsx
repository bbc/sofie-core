import { PreviewContent } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../lib/rundown'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'

type layerInfoContent = Extract<PreviewContent, { type: 'layerInfo' }>

export function LayerInfoPreview(content: layerInfoContent): React.ReactElement {
	const { t } = useTranslation()
	const sourceLayerClassName =
		content.layerType !== undefined ? RundownUtils.getSourceLayerClassName(content.layerType) : undefined

	return (
		<div className="preview-popUp__element-with-time-info">
			<span className={classNames('preview-popUp__element-with-time-info__layer-color', sourceLayerClassName)}>
				{'◼️'}
			</span>
			{content.text.map((line, index) => (
				<div key={index} className="mini-inspector__full-text">
					{line}
				</div>
			))}
			<div className="preview-popUp__timing">
				{content.inTime && (
					<>
						<span className="label">IN: </span> {RundownUtils.formatTimeToShortTime((content.inTime as any as number) || 0)}
					</>
				)}
				&nbsp;{' '}
				{content.outTime && (
					<>
						<span className="label">{t('DURATION: ')}</span>
						{RundownUtils.formatTimeToShortTime((content.outTime as any as number) || 0)}
					</>
				)}
			</div>
		</div>
	)
}
