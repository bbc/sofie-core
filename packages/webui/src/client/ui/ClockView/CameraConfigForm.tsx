import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import Form from 'react-bootstrap/esm/Form'

import './PrompterConfigForm.scss'

interface CameraConfigState {
	sourceLayerIds: string
	studioLabels: string
	fullscreen: boolean
}

const initialState: CameraConfigState = {
	sourceLayerIds: '',
	studioLabels: '',
	fullscreen: false,
}

/** Generate the complete camera screen URL */
function generateCameraUrl(studioId: StudioId, config: CameraConfigState): string {
	const params = new URLSearchParams()

	if (config.sourceLayerIds.trim()) {
		params.set('sourceLayerIds', config.sourceLayerIds.trim())
	}
	if (config.studioLabels.trim()) {
		params.set('studioLabels', config.studioLabels.trim())
	}
	if (config.fullscreen) {
		params.set('fullscreen', '1')
	}

	const queryString = params.toString()
	return `/countdowns/${studioId}/camera${queryString ? '?' + queryString : ''}`
}

export function CameraConfigForm({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const { t } = useTranslation()
	const [config, setConfig] = useState<CameraConfigState>(initialState)

	const updateConfig = useCallback(<K extends keyof CameraConfigState>(key: K, value: CameraConfigState[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value }))
	}, [])

	const generatedUrl = useMemo(() => generateCameraUrl(studioId, config), [config, studioId])

	return (
		<div className="prompter-config-form">
			<div className="mb-3">
				<Form.Group className="mb-2">
					<Form.Label>{t('Source Layer IDs')}</Form.Label>
					<Form.Control
						type="text"
						size="sm"
						placeholder={t('e.g., camera,remote,split')}
						value={config.sourceLayerIds}
						onChange={(e) => updateConfig('sourceLayerIds', e.target.value)}
					/>
					<Form.Text className="text-muted">
						{t('Comma-separated list of source layer IDs to display. Leave empty for all.')}
					</Form.Text>
				</Form.Group>

				<Form.Group className="mb-2">
					<Form.Label>{t('Studio Labels')}</Form.Label>
					<Form.Control
						type="text"
						size="sm"
						placeholder={t('e.g., Studio A,Studio B')}
						value={config.studioLabels}
						onChange={(e) => updateConfig('studioLabels', e.target.value)}
					/>
					<Form.Text className="text-muted">
						{t('Comma-separated list of studio labels to filter by. Leave empty for all.')}
					</Form.Text>
				</Form.Group>

				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="camera-fullscreen"
						label={t('Fullscreen mode')}
						checked={config.fullscreen}
						onChange={(e) => updateConfig('fullscreen', e.target.checked)}
					/>
				</Form.Group>
			</div>

			{/* Generated URL and Open Button */}
			<div className="nested-section mt-3">
				<Form.Group className="mb-2">
					<Form.Label>
						<strong>{t('Generated URL')}:</strong>
					</Form.Label>
					<Form.Control type="text" size="sm" readOnly value={generatedUrl} onClick={(e) => e.currentTarget.select()} />
				</Form.Group>
				<Link to={generatedUrl} className="btn btn-primary">
					{t('Open Camera Screen')}
				</Link>
			</div>
		</div>
	)
}
