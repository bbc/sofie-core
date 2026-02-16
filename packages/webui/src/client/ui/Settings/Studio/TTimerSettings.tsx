import React, { useCallback, useState } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Studios } from '../../../collections/index.js'
import { TTimerSettingsConfig, TTimerMode } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faPlay,
	faRedo,
	faPen,
	faChevronUp,
	faChevronDown,
	faChevronLeft,
	faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import Form from 'react-bootstrap/Form'

// --- Type aliases ---

/** Which part of HH:MM:SS is being edited */
type TimeSegment = 'h' | 'm' | 's'

/** Shorthand for the fixed-length timer settings tuple */
type TimerTuple = [TTimerSettingsConfig, TTimerSettingsConfig, TTimerSettingsConfig]

/** Visibility toggle fields on TTimerSettingsConfig */
type ShowOnField = 'showOnTopBar' | 'showOnDirectorScreen' | 'showOnPresenterScreen'

// --- Constants ---

const DEFAULT_TIMER_CONFIG: TTimerSettingsConfig = {
	label: 'Stopwatch',
	enabled: false,
	mode: 'freeRun',
	countdownDuration: 30 * 60 * 1000, // 30 minutes
	timeOfDayTarget: '',
	stopAtZero: true,
	showOnTopBar: true,
	showOnDirectorScreen: true,
	showOnPresenterScreen: false,
}

const TIME_FORMAT = 'HH:mm:ss'

// --- Data helpers ---

function getTimerSettings(studio: DBStudio): TimerTuple {
	const settings = studio.settingsWithOverrides?.defaults?.tTimerSettings
	if (settings && Array.isArray(settings) && settings.length === 3) {
		return settings as TimerTuple
	}
	return [
		{ ...DEFAULT_TIMER_CONFIG, label: 'Stopwatch A' },
		{ ...DEFAULT_TIMER_CONFIG, label: 'Stopwatch B' },
		{ ...DEFAULT_TIMER_CONFIG, label: 'Stopwatch C' },
	]
}

function saveTimerSettings(studioId: DBStudio['_id'], timers: TimerTuple): void {
	Studios.update(studioId, {
		$set: {
			'settingsWithOverrides.defaults.tTimerSettings': timers,
		},
	})
}

// --- Segmented time input ---

interface SegmentInputProps {
	readonly segment: TimeSegment
	readonly value: number
	readonly onIncrement: (seg: TimeSegment) => void
	readonly onDecrement: (seg: TimeSegment) => void
	readonly onChange: (seg: TimeSegment, raw: string) => void
}

function SegmentInput({ segment, value, onIncrement, onDecrement, onChange }: SegmentInputProps): JSX.Element {
	const [editing, setEditing] = useState(false)
	const [raw, setRaw] = useState('')

	const displayValue = editing ? raw : String(value).padStart(2, '0')

	const commit = () => {
		onChange(segment, raw)
		setEditing(false)
	}

	return (
		<div className="time-segment">
			<button type="button" className="time-segment__btn" onClick={() => onIncrement(segment)}>
				<FontAwesomeIcon icon={faChevronUp} />
			</button>
			<input
				type="text"
				className="time-segment__input"
				value={displayValue}
				onFocus={(e) => {
					setEditing(true)
					setRaw(String(value).padStart(2, '0'))
					e.target.select()
				}}
				onChange={(e) => setRaw(e.target.value.replace(/\D/g, '').slice(0, 2))}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						commit()
						;(e.target as HTMLInputElement).blur()
					}
				}}
				maxLength={2}
			/>
			<button type="button" className="time-segment__btn" onClick={() => onDecrement(segment)}>
				<FontAwesomeIcon icon={faChevronDown} />
			</button>
		</div>
	)
}

interface TimeSegmentInputProps {
	readonly value: string
	readonly onChange: (newValue: string) => void
	readonly showAmPm?: boolean
}

function TimeSegmentInput({ value, onChange, showAmPm }: TimeSegmentInputProps): JSX.Element {
	const parsed = moment(value || '00:00:00', TIME_FORMAT)
	const h = parsed.hours()
	const m = parsed.minutes()
	const s = parsed.seconds()

	const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n))

	const update = (newH: number, newM: number, newS: number) => {
		const ms = moment
			.duration({ hours: clamp(newH, 99), minutes: clamp(newM, 59), seconds: clamp(newS, 59) })
			.asMilliseconds()
		onChange(moment.utc(ms).format(TIME_FORMAT))
	}

	const handleChange = (seg: TimeSegment, raw: string) => {
		const n = Number.parseInt(raw, 10) || 0
		if (seg === 'h') update(n, m, s)
		else if (seg === 'm') update(h, n, s)
		else update(h, m, n)
	}

	const adjust = (seg: TimeSegment, delta: number) => {
		if (seg === 'h') update(h + delta, m, s)
		else if (seg === 'm') update(h, m + delta, s)
		else update(h, m, s + delta)
	}

	const toggleAmPm = () => update(h < 12 ? h + 12 : h - 12, m, s)

	const displayH = showAmPm ? h % 12 || 12 : h
	const isPm = h >= 12

	return (
		<div className="time-segment-group">
			<SegmentInput
				segment="h"
				value={displayH}
				onIncrement={(seg) => adjust(seg, 1)}
				onDecrement={(seg) => adjust(seg, -1)}
				onChange={handleChange}
			/>
			<span className="time-segment__separator">:</span>
			<SegmentInput
				segment="m"
				value={m}
				onIncrement={(seg) => adjust(seg, 1)}
				onDecrement={(seg) => adjust(seg, -1)}
				onChange={handleChange}
			/>
			<span className="time-segment__separator">:</span>
			<SegmentInput
				segment="s"
				value={s}
				onIncrement={(seg) => adjust(seg, 1)}
				onDecrement={(seg) => adjust(seg, -1)}
				onChange={handleChange}
			/>
			{showAmPm && (
				<button type="button" className="time-segment__ampm" onClick={toggleAmPm}>
					{isPm ? 'PM' : 'AM'}
				</button>
			)}
		</div>
	)
}

/** Wrapper that reads/writes milliseconds instead of a time string */
interface DurationSegmentInputProps {
	readonly valueMs: number
	readonly onChange: (newMs: number) => void
}

function DurationSegmentInput({ valueMs, onChange }: DurationSegmentInputProps): JSX.Element {
	const timeStr = moment.utc(Math.max(0, valueMs || 0)).format(TIME_FORMAT)

	const handleChange = (newTimeStr: string) => {
		const t = moment(newTimeStr, TIME_FORMAT)
		onChange(moment.duration({ hours: t.hours(), minutes: t.minutes(), seconds: t.seconds() }).asMilliseconds())
	}

	return <TimeSegmentInput value={timeStr} onChange={handleChange} />
}

// --- Main panel ---

interface TTimerSettingsPanelProps {
	readonly studio: DBStudio
}

export function TTimerSettingsPanel({ studio }: TTimerSettingsPanelProps): JSX.Element {
	const { t } = useTranslation()
	const timers = getTimerSettings(studio)

	const handleTimerChange = useCallback(
		(index: number, updatedTimer: TTimerSettingsConfig) => {
			const newTimers = [...timers] as TimerTuple
			newTimers[index] = updatedTimer
			saveTimerSettings(studio._id, newTimers)
		},
		[studio._id, timers]
	)

	return (
		<div className="t-timer-settings">
			<div className="t-timer-settings__header">
				<h3>{t('T-Timer Settings')}</h3>
			</div>
			{timers.map((timer, index) => (
				<TTimerCard key={index} timer={timer} index={index} onChange={(updated) => handleTimerChange(index, updated)} />
			))}
		</div>
	)
}

// --- Timer card ---

interface TTimerCardProps {
	readonly timer: TTimerSettingsConfig
	readonly index: number
	readonly onChange: (timer: TTimerSettingsConfig) => void
}

function TTimerCard({ timer, onChange }: TTimerCardProps): JSX.Element {
	const { t } = useTranslation()
	const [isEditingLabel, setIsEditingLabel] = useState(false)

	const handleToggle = useCallback(() => {
		onChange({ ...timer, enabled: !timer.enabled })
	}, [timer, onChange])

	const handleLabelChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			onChange({ ...timer, label: e.target.value })
		},
		[timer, onChange]
	)

	const handleModeChange = useCallback(
		(mode: TTimerMode) => {
			onChange({ ...timer, mode })
		},
		[timer, onChange]
	)

	const handleCountdownDurationChange = useCallback(
		(countdownDuration: number) => {
			onChange({ ...timer, countdownDuration })
		},
		[timer, onChange]
	)

	const handleTimeOfDayTargetChange = useCallback(
		(timeOfDayTarget: string) => {
			onChange({ ...timer, timeOfDayTarget })
		},
		[timer, onChange]
	)

	const handleStopAtZeroChange = useCallback(
		(stopAtZero: boolean) => {
			onChange({ ...timer, stopAtZero })
		},
		[timer, onChange]
	)

	const handleShowOnChange = useCallback(
		(field: ShowOnField) => {
			onChange({ ...timer, [field]: !timer[field] })
		},
		[timer, onChange]
	)

	const sectionClass = (activeMode: TTimerMode) =>
		`t-timer-card__section${timer.mode === activeMode ? '' : ' t-timer-card__section--disabled'}`

	return (
		<div className={`t-timer-card${timer.enabled ? '' : ' t-timer-card--disabled'}`}>
			<div className="t-timer-card__top-row">
				<div className="t-timer-card__toggle">
					<Form.Check
						type="switch"
						checked={timer.enabled}
						onChange={handleToggle}
						id={`t-timer-toggle-${timer.label}`}
					/>
				</div>
				<div className="t-timer-card__name">
					{isEditingLabel ? (
						<input
							type="text"
							value={timer.label}
							onChange={handleLabelChange}
							onBlur={() => setIsEditingLabel(false)}
							onKeyDown={(e) => e.key === 'Enter' && setIsEditingLabel(false)}
							autoFocus
						/>
					) : (
						<>
							<span>{timer.label}</span>
							<button className="t-timer-card__edit-btn" onClick={() => setIsEditingLabel(true)}>
								<FontAwesomeIcon icon={faPen} size="xs" />
							</button>
						</>
					)}
				</div>
				<div className="t-timer-card__transport">
					<button title={t('Play reverse')}>
						<FontAwesomeIcon icon={faChevronLeft} />
					</button>
					<button title={t('Play')}>
						<FontAwesomeIcon icon={faPlay} />
					</button>
					<button title={t('Play forward')}>
						<FontAwesomeIcon icon={faChevronRight} />
					</button>
					<button title={t('Replay')}>
						<FontAwesomeIcon icon={faRedo} />
					</button>
				</div>
			</div>

			<div className="t-timer-card__body">
				<div className="t-timer-card__section">
					<div className="t-timer-card__radio-group">
						<label>
							<input
								type="radio"
								name={`mode-${timer.label}`}
								checked={timer.mode === 'freeRun'}
								onChange={() => handleModeChange('freeRun')}
							/>
							{t('Free Run')}
						</label>
						<label>
							<input
								type="radio"
								name={`mode-${timer.label}`}
								checked={timer.mode === 'countdown'}
								onChange={() => handleModeChange('countdown')}
							/>
							{t('Countdown')}
						</label>
						<label>
							<input
								type="radio"
								name={`mode-${timer.label}`}
								checked={timer.mode === 'timeOfDay'}
								onChange={() => handleModeChange('timeOfDay')}
							/>
							{t('Time of Day')}
						</label>
					</div>
				</div>

				<div className={sectionClass('freeRun')}>
					<div className="t-timer-card__section-label">{t('TIME OF DAY')}</div>
					<TimeSegmentInput value="00:00:00" onChange={() => {}} showAmPm />
				</div>

				<div className={sectionClass('countdown')}>
					<div className="t-timer-card__section-label">{t('COUNT FROM')}</div>
					<DurationSegmentInput valueMs={timer.countdownDuration} onChange={handleCountdownDurationChange} />
				</div>

				<div className={sectionClass('timeOfDay')}>
					<div className="t-timer-card__section-label">{t('COUNT TO')}</div>
					<TimeSegmentInput value={timer.timeOfDayTarget} onChange={handleTimeOfDayTargetChange} />
				</div>

				<div className="t-timer-card__section">
					<div className="t-timer-card__section-label">{t('WHEN TIMER REACHES 00:00')}</div>
					<div className="t-timer-card__radio-group">
						<label>
							<input
								type="radio"
								name={`stopAtZero-${timer.label}`}
								checked={timer.stopAtZero === true}
								onChange={() => handleStopAtZeroChange(true)}
							/>
							{t('Stop at 00:00')}
						</label>
						<label>
							<input
								type="radio"
								name={`stopAtZero-${timer.label}`}
								checked={timer.stopAtZero === false}
								onChange={() => handleStopAtZeroChange(false)}
							/>
							{t('Continue counting (-)')}
						</label>
					</div>
				</div>

				<div className="t-timer-card__section">
					<div className="t-timer-card__section-label">{t('SHOW ON:')}</div>
					<div className="t-timer-card__checkbox-group">
						<Form.Check
							type="checkbox"
							label={t('Top Bar')}
							checked={timer.showOnTopBar}
							onChange={() => handleShowOnChange('showOnTopBar')}
							id={`showOnTopBar-${timer.label}`}
						/>
						<Form.Check
							type="checkbox"
							label={t('Director Screen')}
							checked={timer.showOnDirectorScreen}
							onChange={() => handleShowOnChange('showOnDirectorScreen')}
							id={`showOnDirectorScreen-${timer.label}`}
						/>
						<Form.Check
							type="checkbox"
							label={t('Presenter Scr. + Prompter')}
							checked={timer.showOnPresenterScreen}
							onChange={() => handleShowOnChange('showOnPresenterScreen')}
							id={`showOnPresenterScreen-${timer.label}`}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
