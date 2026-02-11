import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { ClockEvent } from '../lib/types'

type EditState = {
  id: number
  ts_utc: string
  type: ClockEvent['type']
  location: ClockEvent['location']
}

function toLocal(tsUtc: string): string {
  const d = new Date(tsUtc)
  return d.toLocaleString()
}

export function HistoryPage() {
  const [events, setEvents] = useState<ClockEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => (a.ts_utc < b.ts_utc ? 1 : -1))
  }, [events])

  async function load() {
    setError(null)
    const data = await apiFetch<ClockEvent[]>('/clock/events?limit=200')
    setEvents(data)
  }

  useEffect(() => {
    load().catch((e) => setError((e as { message?: string })?.message || 'Fehler'))
  }, [])

  async function onDelete(id: number) {
    if (!confirm('Eintrag wirklich löschen?')) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch<void>(`/clock/events/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(e: ClockEvent) {
    setEdit({ id: e.id, ts_utc: e.ts_utc, type: e.type, location: e.location })
  }

  async function submitEdit(ev: FormEvent) {
    ev.preventDefault()
    if (!edit) return
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        ts_utc: new Date(edit.ts_utc).toISOString(),
        type: edit.type,
      }
      if (edit.type === 'COME') {
        body.location = edit.location
      } else {
        body.location = null
      }

      await apiFetch<ClockEvent>(`/clock/events/${edit.id}`, { method: 'PUT', body })
      setEdit(null)
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1>History</h1>
      <div className="row">
        <span className="muted">{events.length} Einträge</span>
        <button className="secondary" disabled={loading} onClick={() => load()}>
          Aktualisieren
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {edit ? (
        <form className="card" onSubmit={submitEdit}>
          <div className="row">
            <strong>Eintrag bearbeiten</strong>
            <button className="secondary" type="button" onClick={() => setEdit(null)}>
              Abbrechen
            </button>
          </div>

          <label>
            Zeit (UTC)
            <input value={edit.ts_utc} onChange={(e) => setEdit({ ...edit, ts_utc: e.target.value })} />
          </label>
          <label>
            Typ
            <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as EditState['type'] })}>
              <option value="COME">COME</option>
              <option value="GO">GO</option>
              <option value="BREAK_START">BREAK_START</option>
              <option value="BREAK_END">BREAK_END</option>
            </select>
          </label>
          {edit.type === 'COME' ? (
            <label>
              Location
              <select
                value={edit.location ?? 'OFFICE'}
                onChange={(e) => setEdit({ ...edit, location: e.target.value as EditState['location'] })}
              >
                <option value="OFFICE">OFFICE</option>
                <option value="HOME">HOME</option>
              </select>
            </label>
          ) : null}

          <button type="submit" disabled={loading}>
            {loading ? '...' : 'Speichern'}
          </button>
        </form>
      ) : null}

      <div className="card">
        <div className="thead" style={{ gridTemplateColumns: '170px 120px 120px 1fr' }}>
          <div>Zeit</div>
          <div>Typ</div>
          <div>Location</div>
          <div>Aktionen</div>
        </div>
        {sorted.map((e) => (
          <div key={e.id} className="trow" style={{ gridTemplateColumns: '170px 120px 120px 1fr' }}>
            <div>{toLocal(e.ts_utc)}</div>
            <div>{e.type}</div>
            <div className="muted">{e.location ?? '-'}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="secondary" disabled={loading} onClick={() => startEdit(e)}>
                Bearbeiten
              </button>
              <button disabled={loading} onClick={() => onDelete(e.id)}>
                Löschen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
