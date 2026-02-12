import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { AbsenceReason, UserSettings } from '../lib/types'

export function SettingsPage() {
  const auth = useAuth()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState<number>(468)
  const [homeOfficeRatio, setHomeOfficeRatio] = useState<number>(0.4)
  const [overtimeStartDate, setOvertimeStartDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [reasons, setReasons] = useState<AbsenceReason[]>([])
  const [newReason, setNewReason] = useState('')
  const [reasonsError, setReasonsError] = useState<string | null>(null)

  async function load() {
    setError(null)
    const data = await apiFetch<UserSettings>('/settings/me')
    setSettings(data)
    setDailyTargetMinutes(data.daily_target_minutes)
    setHomeOfficeRatio(data.home_office_target_ratio)
    setOvertimeStartDate(data.overtime_start_date ?? '')

    const rs = await apiFetch<AbsenceReason[]>('/absences/reasons')
    setReasons(rs)
  }

  useEffect(() => {
    load().catch((e) => setError((e as { message?: string })?.message || 'Fehler'))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    setError(null)
    setLoading(true)
    try {
      const data = await apiFetch<UserSettings>('/settings/me', {
        method: 'PUT',
        body: {
          daily_target_minutes: dailyTargetMinutes,
          home_office_target_ratio: homeOfficeRatio,
          overtime_start_date: overtimeStartDate ? overtimeStartDate : null,
        },
      })
      setSettings(data)
      setSaved(true)
    } catch (err) {
      setError((err as { message?: string })?.message || 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function addReason() {
    const name = newReason.trim()
    if (!name) return
    setReasonsError(null)
    try {
      await apiFetch<AbsenceReason>('/absences/reasons', { method: 'POST', body: { name } })
      setNewReason('')
      const rs = await apiFetch<AbsenceReason[]>('/absences/reasons')
      setReasons(rs)
    } catch (e) {
      setReasonsError((e as { message?: string })?.message || 'Fehler')
    }
  }

  async function renameReason(id: number, name: string) {
    setReasonsError(null)
    try {
      await apiFetch<AbsenceReason>(`/absences/reasons/${id}`, { method: 'PUT', body: { name } })
      const rs = await apiFetch<AbsenceReason[]>('/absences/reasons')
      setReasons(rs)
    } catch (e) {
      setReasonsError((e as { message?: string })?.message || 'Fehler')
    }
  }

  async function deleteReason(id: number) {
    if (!confirm('Grund wirklich löschen?')) return
    setReasonsError(null)
    try {
      await apiFetch<void>(`/absences/reasons/${id}`, { method: 'DELETE' })
      const rs = await apiFetch<AbsenceReason[]>('/absences/reasons')
      setReasons(rs)
    } catch (e) {
      setReasonsError((e as { message?: string })?.message || 'Fehler')
    }
  }

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>Settings</h1>

      {error ? <div className="error">{error}</div> : null}
      {!settings ? <div className="muted">...</div> : null}

      {settings ? (
        <>
          <section className="card">
            <h2>Account</h2>
            <div className="row">
              <span className="muted">{auth.state.status === 'authenticated' ? auth.state.user.email : ''}</span>
              <button className="secondary" type="button" onClick={() => auth.logout()}>
                Logout
              </button>
            </div>
          </section>

          <form className="card" onSubmit={onSubmit}>
            <label>
              Sollarbeitszeit pro Tag (Minuten)
              <input
                type="number"
                min={0}
                max={24 * 60}
                value={dailyTargetMinutes}
                onChange={(e) => setDailyTargetMinutes(Number(e.target.value))}
              />
            </label>

            <label>
              Home-Office Ziel (0..1)
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={homeOfficeRatio}
                onChange={(e) => setHomeOfficeRatio(Number(e.target.value))}
              />
            </label>

            <label>
              Startdatum Stundenkonto (YYYY-MM-DD)
              <input
                type="date"
                value={overtimeStartDate}
                onChange={(e) => setOvertimeStartDate(e.target.value)}
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? '...' : 'Speichern'}
            </button>

            {saved ? <div className="ok">Gespeichert.</div> : null}
          </form>

          <section className="card">
            <h2>Abwesenheitsgründe</h2>
            {reasonsError ? <div className="error">{reasonsError}</div> : null}

            <div className="row" style={{ gap: 10 }}>
              <input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Neuer Grund"
              />
              <button type="button" onClick={() => addReason()}>
                Hinzufügen
              </button>
            </div>

            <div className="table">
              {reasons.map((r) => (
                <div key={r.id} className="trow" style={{ gridTemplateColumns: '1fr 220px' }}>
                  <input
                    defaultValue={r.name}
                    onBlur={(e) => {
                      const name = e.target.value.trim()
                      if (name && name !== r.name) renameReason(r.id, name)
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="secondary" type="button" onClick={() => deleteReason(r.id)}>
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
