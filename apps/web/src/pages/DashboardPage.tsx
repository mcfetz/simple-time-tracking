import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { deleteDayNote, getDayNote, upsertDayNote } from '../lib/notes'
import { useAuth } from '../lib/auth'
import type { CreateClockEventRequest, DailyStatusResponse, MonthReport } from '../lib/types'
import { enqueueClockEvent, flushClockEventQueue, subscribeQueueCount } from '../lib/offlineQueue'
import { useI18n } from '../lib/i18n'
import { formatDateLocal } from '../lib/format'


function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

type ColorStop = { r: number; g: number; b: number; at: number }

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function mixColor(a: ColorStop, b: ColorStop, at: number): string {
  const t = (at - a.at) / (b.at - a.at)
  const r = Math.round(lerp(a.r, b.r, t))
  const g = Math.round(lerp(a.g, b.g, t))
  const bb = Math.round(lerp(a.b, b.b, t))
  return `rgb(${r} ${g} ${bb})`
}

function colorForRatio(ratio: number, isWeekend: boolean): string {
  if (isWeekend) return 'rgb(226 232 240)'

  const x = clamp(ratio, 0, 2)
  const stops: ColorStop[] = [
    { at: 0.0, r: 239, g: 68, b: 68 },
    { at: 0.7, r: 249, g: 115, b: 22 },
    { at: 1.0, r: 34, g: 197, b: 94 },
    { at: 1.15, r: 59, g: 130, b: 246 },
    { at: 1.35, r: 168, g: 85, b: 247 },
    { at: 2.0, r: 168, g: 85, b: 247 },
  ]

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (x >= a.at && x <= b.at) {
      return mixColor(a, b, x)
    }
  }

  return `rgb(${stops[stops.length - 1].r} ${stops[stops.length - 1].g} ${
    stops[stops.length - 1].b
  })`
}

const ABSENCE_HEAT_COLOR = 'rgb(250 204 21)'

function isWeekendDate(dateLocal: string): boolean {
  const d = new Date(`${dateLocal}T00:00:00`)
  const day = d.getDay()
  return day === 0 || day === 6
}

function isBeforeLocalDate(a: string, b: string): boolean {
  return a < b
}

function geoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export function DashboardPage() {
  const auth = useAuth()
  const { t, lang } = useI18n()
  const [status, setStatus] = useState<DailyStatusResponse | null>(null)
  const [month, setMonth] = useState<MonthReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [noteValue, setNoteValue] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const noteDateLoadedFor = useRef<string | null>(null)
  const lastPersistedNote = useRef('')
  const noteSaveTimer = useRef<number | null>(null)

  const [useGeo, setUseGeo] = useState(false)
  const [queued, setQueued] = useState(0)

  const canGeo = useMemo(() => geoSupported(), [])

  async function loadStatus() {
    setError(null)
    const data = await apiFetch<DailyStatusResponse>('/dashboard/today')
    setStatus(data)
  }

  async function loadMonth() {
    const data = await apiFetch<MonthReport>('/reports/month')
    setMonth(data)
  }

  useEffect(() => {
    loadStatus().catch((e) => setError((e as { message?: string })?.message || t('errors.generic')))
    loadMonth().catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      if (document.visibilityState !== 'visible') return
      loadStatus().catch(() => undefined)
    }

    const onVis = () => tick()
    document.addEventListener('visibilitychange', onVis)

    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  async function persistTodayNote(content: string) {
    if (!status) return
    const dateLocal = status.date_local
    const trimmed = content.trim()
    const prevTrimmed = lastPersistedNote.current.trim()

    if (trimmed === prevTrimmed) return

    setNoteSaving(true)
    setError(null)
    try {
      if (trimmed === '') {
        await deleteDayNote(dateLocal)
        lastPersistedNote.current = ''
      } else {
        await upsertDayNote(dateLocal, content)
        lastPersistedNote.current = content
      }

      await loadMonth()
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setNoteSaving(false)
    }
  }

  function schedulePersist(content: string) {
    if (noteSaveTimer.current) {
      window.clearTimeout(noteSaveTimer.current)
    }
    noteSaveTimer.current = window.setTimeout(() => {
      persistTodayNote(content).catch(() => undefined)
    }, 800)
  }

  useEffect(() => {
    return () => {
      if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!status) return
    const dateLocal = status.date_local
    if (noteDateLoadedFor.current === dateLocal) return
    noteDateLoadedFor.current = dateLocal

    setNoteSaving(true)
    getDayNote(dateLocal)
      .then((n) => {
        const content = n?.content ?? ''
        lastPersistedNote.current = content
        setNoteValue(content)
      })
      .catch((e) => {
        setError((e as { message?: string })?.message || t('errors.generic'))
        lastPersistedNote.current = ''
        setNoteValue('')
      })
      .finally(() => setNoteSaving(false))
  }, [status])

  useEffect(() => subscribeQueueCount(setQueued), [])

  async function createEvent(event: CreateClockEventRequest) {
    setLoading(true)
    setError(null)
    try {
      await apiFetch('/clock/events', { method: 'POST', body: event })
      await loadStatus()
      await loadMonth()
    } catch (e) {
      const statusCode = (e as { status?: number })?.status
        if (typeof statusCode === 'number') {
          setError((e as { message?: string })?.message || t('errors.generic'))
        } else {
          await enqueueClockEvent(event)
          setError(t('errors.offlineQueued'))
        }
    } finally {
      setLoading(false)
    }
  }

  async function come(location: 'HOME' | 'OFFICE') {
    const base: CreateClockEventRequest = {
      type: 'COME',
      location,
      client_event_id: crypto.randomUUID(),
    }

    if (useGeo && canGeo) {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 30_000,
          timeout: 10_000,
        })
      })
      base.geo = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
      }
    }

    await createEvent(base)
  }

  const overtime = useMemo(() => {
    if (!status || !month) return null

    const start = status.overtime_start_date

    let balanceMinutes = 0
    let expectedMinutes = 0
    let workedMinutes = 0

    for (const d of month.days) {
      if (d.date_local > status.date_local) continue

      if (start && isBeforeLocalDate(d.date_local, start)) continue

      if (d.absence) continue

      const weekend = isWeekendDate(d.date_local)
      const expected = weekend ? 0 : status.target_minutes
      expectedMinutes += expected
      workedMinutes += d.worked_minutes
      balanceMinutes += d.worked_minutes - expected
    }

    return { balanceMinutes, expectedMinutes, workedMinutes }
  }, [month, status])

  const heatmapDays = useMemo(() => {
    if (!status || !month) return []
    const target = status.target_minutes
    const start = status.overtime_start_date
    return month.days.map((d) => {
      const weekend = isWeekendDate(d.date_local)
      const expected = weekend ? 0 : target
      const ratio = expected > 0 ? d.worked_minutes / expected : 0

      const isAbsence = !!d.absence
      const hasNote = !!d.has_note

      const isBeforeStart = !!start && isBeforeLocalDate(d.date_local, start)
      return {
        date_local: d.date_local,
        worked_minutes: d.worked_minutes,
        expected_minutes: expected,
        weekend,
        ratio,
        isAbsence,
        absenceReason: d.absence?.reason.name ?? null,
        isBeforeStart,
        hasNote,
        color: isBeforeStart
          ? 'rgb(148 163 184)'
          : isAbsence
            ? ABSENCE_HEAT_COLOR
            : colorForRatio(ratio, weekend),
      }
    })
  }, [month, status])

  const canCome = !!status && status.state === 'OFF' && !status.absence
  const canGo = !!status && (status.state === 'WORKING' || status.state === 'BREAK') && !status.absence
  const canBreakStart = !!status && status.state === 'WORKING' && !status.absence
  const canBreakEnd = !!status && status.state === 'BREAK' && !status.absence
  const showActions = canCome || canGo || canBreakStart || canBreakEnd

  return (
    <div className="page">
      {!navigator.onLine ? <div className="warn">{t('dashboard.offlineBanner')}</div> : null}
      {queued > 0 ? (
        <div className="warn">
          <div className="row">
            <span>
              {t('dashboard.queue')}: {queued}
            </span>
            <button
              className="secondary"
              disabled={!navigator.onLine}
              onClick={() => flushClockEventQueue().then(() => loadStatus())}
            >
              {t('dashboard.sync')}
            </button>
          </div>
        </div>
      ) : null}
      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{t('dashboard.today')}</h2>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {!status ? <div className="muted">...</div> : null}

        {status ? (
          <>
            {status.absence ? (
              <div className="warn">
                {t('dashboard.absenceFullDay')}: {status.absence.reason.name} ({formatDateLocal(status.absence.start_date, lang)} –{' '}
                {formatDateLocal(status.absence.end_date, lang)})
              </div>
            ) : null}

            <div className="dashStatusRow">
              <div
                className="dashMetric"
                style={{
                  background:
                    status.state === 'WORKING'
                      ? 'rgba(34, 197, 94, 0.12)'
                      : status.state === 'BREAK'
                        ? 'rgba(250, 204, 21, 0.16)'
                        : undefined,
                }}
              >
                <div className="muted small">Status</div>
                <strong>{status.state}</strong>
              </div>
            </div>

            <div className="dashRow2">
                <div className="dashMetric">
                <div className="muted small">{t('dashboard.worked')}</div>
                <strong>{formatMinutes(status.worked_minutes)}</strong>
              </div>
              <div className="dashMetric">
                <div className="muted small">{t('dashboard.remaining')}</div>
                <strong>{formatMinutes(status.remaining_work_minutes)}</strong>
              </div>
            </div>

            <div className="dashRow2">
              <div className="dashMetric">
                <div className="muted small">{t('dashboard.break')}</div>
                <strong>{formatMinutes(status.break_minutes)}</strong>
              </div>
              <div className="dashMetric">
                <div className="muted small">{t('dashboard.breakRemaining')}</div>
                <strong>{formatMinutes(status.remaining_break_minutes)}</strong>
              </div>
            </div>

            {(status.max_daily_work_exceeded || status.rest_period_violation) && (
              <div className="warn">
                {status.max_daily_work_exceeded ? <div>{t('dashboard.warningOver10h')}</div> : null}
                {status.rest_period_violation ? <div>{t('dashboard.warningRest11h')}</div> : null}
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="card">
        <h2 style={{ margin: 0 }}>{t('dashboard.actions')}</h2>

        {status && canCome ? (
          <div className="controls">
            <label className="inline">
              <input
                type="checkbox"
                checked={useGeo}
                disabled={!canGeo}
                onChange={(e) => setUseGeo(e.target.checked)}
              />
              {t('dashboard.geolocation')}
            </label>
          </div>
        ) : null}

        {status && !showActions ? <div className="muted">...</div> : null}

        <div className="actions">
          {canCome ? (
            <>
              <button disabled={loading} onClick={() => come('OFFICE')}>
                {t('dashboard.comeOffice')}
              </button>
              <button disabled={loading} onClick={() => come('HOME')}>
                {t('dashboard.comeHome')}
              </button>
            </>
          ) : null}
          {canGo ? (
            <button disabled={loading} onClick={() => createEvent({ type: 'GO', client_event_id: crypto.randomUUID() })}>
              {t('dashboard.go')}
            </button>
          ) : null}
          {canBreakStart ? (
            <button
              disabled={loading}
              onClick={() => createEvent({ type: 'BREAK_START', client_event_id: crypto.randomUUID() })}
            >
              {t('dashboard.breakStart')}
            </button>
          ) : null}
          {canBreakEnd ? (
            <button
              disabled={loading}
              onClick={() => createEvent({ type: 'BREAK_END', client_event_id: crypto.randomUUID() })}
            >
              {t('dashboard.breakEnd')}
            </button>
          ) : null}
        </div>

        <label>
          {t('common.note')} ({t('dashboard.today')})
          <textarea
            rows={5}
            placeholder={t('dashboard.notePlaceholder')}
            value={noteValue}
            disabled={!status}
            onChange={(e) => {
              const next = e.target.value
              setNoteValue(next)
              schedulePersist(next)
            }}
            onBlur={() => {
              if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current)
              persistTodayNote(noteValue).catch(() => undefined)
            }}
            style={{ width: '100%' }}
          />
        </label>
        <div className="muted small">{noteSaving ? t('common.loading') : t('common.save')}</div>
      </section>

      <section className="card">
        <h2 style={{ margin: 0 }}>{t('dashboard.month')}</h2>
        {!month || !status ? <div className="muted">...</div> : null}

        {overtime ? (
          <div className="row">
            <span className="muted">{t('dashboard.overtimeBalanceToDate')}</span>
            <strong className={overtime.balanceMinutes >= 0 ? 'okText' : 'errorText'}>
              {overtime.balanceMinutes >= 0 ? '+' : '-'}
              {formatMinutes(Math.abs(overtime.balanceMinutes))}
            </strong>
          </div>
        ) : null}

        {heatmapDays.length > 0 ? (
          <div className="heatmap">
            {heatmapDays.map((d) => (
              <div
                key={d.date_local}
                className={`heat${d.hasNote ? ' heatNote' : ''}`}
                style={{ background: d.color }}
                title={
                  d.isBeforeStart
                    ? `${formatDateLocal(d.date_local, lang)}: ${t('dashboard.heatmap.beforeOvertimeStart')}`
                    : d.isAbsence
                      ? `${formatDateLocal(d.date_local, lang)}: ${t('dashboard.heatmap.absence')} (${d.absenceReason ?? '—'})`
                      : `${formatDateLocal(d.date_local, lang)}: ${formatMinutes(d.worked_minutes)} / ${formatMinutes(d.expected_minutes)}${
                          d.hasNote ? ` (${t('dashboard.heatmap.note')})` : ''
                        }`
                }
              />
            ))}
          </div>
        ) : null}
      </section>

      <div className="logoutRow">
        <button className="linkButton" type="button" onClick={() => auth.logout()}>
          {t('dashboard.logout')}
        </button>
      </div>
    </div>
  )
}
