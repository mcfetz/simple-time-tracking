import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { CreateClockEventRequest, DailyStatusResponse } from '../lib/types'
import { enqueueClockEvent, flushClockEventQueue, subscribeQueueCount } from '../lib/offlineQueue'

type Location = 'HOME' | 'OFFICE'

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function geoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export function DashboardPage() {
  const [status, setStatus] = useState<DailyStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [location, setLocation] = useState<Location>('OFFICE')
  const [useGeo, setUseGeo] = useState(false)
  const [queued, setQueued] = useState(0)

  const canGeo = useMemo(() => geoSupported(), [])

  async function loadStatus() {
    setError(null)
    const data = await apiFetch<DailyStatusResponse>('/dashboard/today')
    setStatus(data)
  }

  useEffect(() => {
    loadStatus().catch((e) => setError((e as { message?: string })?.message || 'Fehler'))
  }, [])

  useEffect(() => subscribeQueueCount(setQueued), [])

  async function createEvent(event: CreateClockEventRequest) {
    setLoading(true)
    setError(null)
    try {
      await apiFetch('/clock/events', { method: 'POST', body: event })
      await loadStatus()
    } catch (e) {
      await enqueueClockEvent(event)
      setError('Offline: Aktion wurde in Queue gespeichert')
    } finally {
      setLoading(false)
    }
  }

  async function come() {
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

  return (
    <div className="page">
      {!navigator.onLine ? <div className="warn">Offline – Aktionen werden zwischengespeichert.</div> : null}
      {queued > 0 ? (
        <div className="warn">
          <div className="row">
            <span>Queue: {queued}</span>
            <button
              className="secondary"
              disabled={!navigator.onLine}
              onClick={() => flushClockEventQueue().then(() => loadStatus())}
            >
              Sync
            </button>
          </div>
        </div>
      ) : null}
      <div className="grid">
        <section className="card">
          <h2>Heute</h2>
          {error ? <div className="error">{error}</div> : null}
          {!status ? <div className="muted">...</div> : null}

          {status ? (
            <div className="status">
              <div className="row">
                <span className="muted">Status</span>
                <strong>{status.state}</strong>
              </div>
              <div className="row">
                <span className="muted">Gearbeitet</span>
                <strong>{formatMinutes(status.worked_minutes)}</strong>
              </div>
              <div className="row">
                <span className="muted">Noch</span>
                <strong>{formatMinutes(status.remaining_work_minutes)}</strong>
              </div>
              <div className="row">
                <span className="muted">Pause</span>
                <strong>{formatMinutes(status.break_minutes)}</strong>
              </div>
              <div className="row">
                <span className="muted">Pause nötig</span>
                <strong>{formatMinutes(status.required_break_minutes)}</strong>
              </div>
              <div className="row">
                <span className="muted">Pause noch</span>
                <strong>{formatMinutes(status.remaining_break_minutes)}</strong>
              </div>

              {(status.max_daily_work_exceeded || status.rest_period_violation) && (
                <div className="warn">
                  {status.max_daily_work_exceeded ? <div>Warnung: &gt; 10h gearbeitet</div> : null}
                  {status.rest_period_violation ? <div>Warnung: Ruhezeit &lt; 11h</div> : null}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2>Aktionen</h2>
          <div className="controls">
            <label>
              Standort
              <select value={location} onChange={(e) => setLocation(e.target.value as Location)}>
                <option value="OFFICE">Büro</option>
                <option value="HOME">Home Office</option>
              </select>
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={useGeo}
                disabled={!canGeo}
                onChange={(e) => setUseGeo(e.target.checked)}
              />
              Geolocation
            </label>
          </div>

          <div className="actions">
            <button disabled={loading} onClick={() => come()}>
              Kommen
            </button>
            <button disabled={loading} onClick={() => createEvent({ type: 'GO', client_event_id: crypto.randomUUID() })}>
              Gehen
            </button>
            <button
              disabled={loading}
              onClick={() => createEvent({ type: 'BREAK_START', client_event_id: crypto.randomUUID() })}
            >
              Pause Beginn
            </button>
            <button
              disabled={loading}
              onClick={() => createEvent({ type: 'BREAK_END', client_event_id: crypto.randomUUID() })}
            >
              Pause Ende
            </button>
          </div>

          <button className="secondary" disabled={loading} onClick={() => loadStatus()}>
            Status aktualisieren
          </button>
        </section>
      </div>
    </div>
  )
}
