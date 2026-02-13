import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { deleteDayNote, getDayNote, upsertDayNote } from '../lib/notes'
import type { ClockEvent } from '../lib/types'
import { NoteModal } from '../components/NoteModal'
import { useI18n } from '../lib/i18n'

type EditState = {
  id: number
  ts_utc: string
  type: ClockEvent['type']
  location: ClockEvent['location']
}

type DayGroup = {
  date_local: string
  events: ClockEvent[]
}

function formatLocalDate(tsUtc: string, tz: string): string {
  const d = new Date(tsUtc)
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function toLocal(tsUtc: string, tz: string): string {
  const d = new Date(tsUtc)
  return d.toLocaleString(undefined, { timeZone: tz })
}

export function HistoryPage() {
  const auth = useAuth()
  const { t } = useI18n()
  const tz = auth.state.status === 'authenticated' ? auth.state.user.timezone : 'UTC'

  const [events, setEvents] = useState<ClockEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDateLocal, setNoteDateLocal] = useState<string | null>(null)
  const [noteInitial, setNoteInitial] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => (a.ts_utc < b.ts_utc ? 1 : -1))
  }, [events])

  const grouped = useMemo<DayGroup[]>(() => {
    const by: Record<string, ClockEvent[]> = {}
    for (const e of sorted) {
      const key = formatLocalDate(e.ts_utc, tz)
      ;(by[key] ??= []).push(e)
    }

    const keys = Object.keys(by).sort((a, b) => (a < b ? 1 : -1))
    return keys.map((k) => ({ date_local: k, events: by[k] }))
  }, [sorted, tz])

  async function load() {
    setError(null)
    const data = await apiFetch<ClockEvent[]>('/clock/events?limit=200')
    setEvents(data)
  }

  useEffect(() => {
    load().catch((e) => setError((e as { message?: string })?.message || t('errors.generic')))
  }, [])

  async function onDelete(id: number) {
    if (!confirm(t('confirm.deleteEntry'))) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch<void>(`/clock/events/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
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
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  async function openNote(dateLocal: string) {
    setNoteOpen(true)
    setNoteDateLocal(dateLocal)
    setNoteSaving(true)
    setError(null)
    try {
      const n = await getDayNote(dateLocal)
      setNoteInitial(n?.content ?? '')
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
      setNoteInitial('')
    } finally {
      setNoteSaving(false)
    }
  }

  async function saveNote(content: string) {
    if (!noteDateLocal) return
    setNoteSaving(true)
    setError(null)
    try {
      await upsertDayNote(noteDateLocal, content)
      setNoteOpen(false)
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setNoteSaving(false)
    }
  }

  async function deleteNote() {
    if (!noteDateLocal) return
    setNoteSaving(true)
    setError(null)
    try {
      await deleteDayNote(noteDateLocal)
      setNoteOpen(false)
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>{t('history.title')}</h1>
      <div className="row">
        <span className="muted">
          {events.length} {t('history.entries')}
        </span>
        <button className="secondary" disabled={loading} onClick={() => load()}>
          {t('common.refresh')}
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {edit ? (
        <form className="card" onSubmit={submitEdit}>
          <div className="row">
            <strong>{t('history.editEntry')}</strong>
            <button className="secondary" type="button" onClick={() => setEdit(null)}>
              {t('common.cancel')}
            </button>
          </div>

          <label>
            {t('history.timeUtc')}
            <input value={edit.ts_utc} onChange={(e) => setEdit({ ...edit, ts_utc: e.target.value })} />
          </label>
          <label>
            {t('history.type')}
            <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as EditState['type'] })}>
              <option value="COME">COME</option>
              <option value="GO">GO</option>
              <option value="BREAK_START">BREAK_START</option>
              <option value="BREAK_END">BREAK_END</option>
            </select>
          </label>
          {edit.type === 'COME' ? (
            <label>
              {t('history.location')}
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
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </form>
      ) : null}

      {grouped.map((g) => (
        <section key={g.date_local} className="card">
          <div className="row">
            <strong>{g.date_local}</strong>
            <button className="secondary" type="button" disabled={loading} onClick={() => openNote(g.date_local)}>
              {t('common.note')}
            </button>
          </div>

          <div className="thead" style={{ gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)' }}>
            <div>{t('history.timeUtc')}</div>
            <div>{t('history.type')}</div>
            <div>{t('history.location')}</div>
            <div>{t('history.actions')}</div>
          </div>
          {g.events.map((e) => (
            <div
              key={e.id}
              className="trow"
              style={{ gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)' }}
            >
              <div>{toLocal(e.ts_utc, tz)}</div>
              <div>{e.type}</div>
              <div className="muted">{e.location ?? '-'}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="secondary" type="button" disabled={loading} onClick={() => startEdit(e)}>
                  {t('history.edit')}
                </button>
                <button type="button" disabled={loading} onClick={() => onDelete(e.id)}>
                  {t('history.delete')}
                </button>
              </div>
            </div>
          ))}
        </section>
      ))}

      {noteDateLocal ? (
        <NoteModal
          open={noteOpen}
          dateLocal={noteDateLocal}
          initialContent={noteInitial}
          saving={noteSaving}
          onClose={() => setNoteOpen(false)}
          onSave={(c) => saveNote(c)}
          onDelete={() => deleteNote()}
        />
      ) : null}
    </div>
  )
}
