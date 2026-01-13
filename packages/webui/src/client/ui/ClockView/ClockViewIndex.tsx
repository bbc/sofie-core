import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import Container from 'react-bootstrap/esm/Container'
import Accordion from 'react-bootstrap/esm/Accordion'
import { PresenterConfigForm } from './PresenterConfigForm'
import { CameraConfigForm } from './CameraConfigForm'
import { PrompterConfigForm } from './PrompterConfigForm'

export function ClockViewIndex({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const { t } = useTranslation()

	return (
		<Container fluid="true" className="header-clear">
			<section className="mt-5 mx-5">
				<header className="my-2">
					<h1>{t('Available Screens for Studio {{studioId}}', { studioId })}</h1>
				</header>
				<section className="my-5">
					<h2>{t('Quick Links')}</h2>
					<ul>
						<li>
							<Link to={`/countdowns/${studioId}/director`}>{t('Director Screen')}</Link>
						</li>
						<li>
							<Link to={`/countdowns/${studioId}/overlay`}>{t('Overlay Screen')}</Link>
						</li>
						<li>
							<Link to={`/countdowns/${studioId}/multiview`}>{t('All Screens in a MultiViewer')}</Link>
						</li>
						<li>
							<Link to={`/activeRundown/${studioId}`}>{t('Active Rundown View')}</Link>
						</li>
					</ul>

					<h2 className="mt-4">{t('Configurable Screens')}</h2>

					<Accordion className="mt-3">
						<Accordion.Item eventKey="presenter">
							<Accordion.Header>{t('Presenter Screen')}</Accordion.Header>
							<Accordion.Body>
								<PresenterConfigForm studioId={studioId} />
							</Accordion.Body>
						</Accordion.Item>
						<Accordion.Item eventKey="camera">
							<Accordion.Header>{t('Camera Screen')}</Accordion.Header>
							<Accordion.Body>
								<CameraConfigForm studioId={studioId} />
							</Accordion.Body>
						</Accordion.Item>
						<Accordion.Item eventKey="prompter">
							<Accordion.Header>{t('Prompter')}</Accordion.Header>
							<Accordion.Body>
								<PrompterConfigForm studioId={studioId} />
							</Accordion.Body>
						</Accordion.Item>
					</Accordion>
				</section>
			</section>
		</Container>
	)
}
