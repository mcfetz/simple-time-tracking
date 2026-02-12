import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Absence, AbsenceReason } from '../lib/types'

type Draft = {
  start_date: string
  end_date: string
  reason_id: number | ''
}

export function AbsencesPage() {
  const [reasons, setReasons] = useState<AbsenceReason[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [draft, setDraft] = useState<Draft>({ start_date: today, end_date: today, reason_id: '' })

  async function load() {
    setError(null)
    const [rs, as] = await Promise.all([
      apiFetch<AbsenceReason[]>('/absences/reasons'),
      apiFetch<Absence[]>('/absences'),
    ])
    setReasons(rs)
    setAbsences(as)
  }

  useEffect(() => {
    load().catch((e) => setError((e as { message?: string })?.message || 'Fehler'))
  }, [])

  async function create() {
    if (!draft.reason_id) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch<Absence>('/absences', {
        method: 'POST',
        body: {
          start_date: draft.start_date,
          end_date: draft.end_date,
          reason_id: draft.reason_id,
        },
      })
      setDraft({ ...draft })
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Abwesenheit wirklich löschen?')) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch<void>(`/absences/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>Abwesenheiten</h1>
      {error ? <div className="error">{error}</div> : null}

      <section className="card">
        <h2>Neu</h2>
          <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          <label>
            Start
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
            />
          </label>
          <label>
            Ende
            <input
              type="date"
              value={draft.end_date}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            />
          </label>
        </div>
        <label>
          Grund
          <select
            value={draft.reason_id}
            onChange={(e) => setDraft({ ...draft, reason_id: Number(e.target.value) })}
          >
            <option value="">Bitte wählen</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={loading || !draft.reason_id} onClick={() => create()}>
          Anlegen
        </button>
        <p className="muted small">Hinweis: Wenn bereits Zeitbuchungen im Zeitraum existieren, wird das Anlegen abgelehnt.</p>
      </section>

      <section className="card">
        <h2>Liste</h2>
        <div className="table">
          <div className="thead" style={{ gridTemplateColumns: '140px 140px 1fr 160px' }}>
            <div>Start</div>
            <div>Ende</div>
            <div>Grund</div>
            <div />
          </div>
          {absences.map((a) => (
            <div key={a.id} className="trow" style={{ gridTemplateColumns: '140px 140px 1fr 160px' }}>
              <div>{a.start_date}</div>
              <div>{a.end_date}</div>
              <div>{a.reason.name}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="secondary" disabled={loading} onClick={() => remove(a.id)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
          {absences.length === 0 ? <div className="muted">Keine Abwesenheiten.</div> : null}
        </div>
      </section>
    </div>
  )
}
