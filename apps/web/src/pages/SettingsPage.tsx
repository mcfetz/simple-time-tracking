import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { UserSettings } from '../lib/types'

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState<number>(468)
  const [homeOfficeRatio, setHomeOfficeRatio] = useState<number>(0.4)
  const [overtimeStartDate, setOvertimeStartDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function load() {
    setError(null)
    const data = await apiFetch<UserSettings>('/settings/me')
    setSettings(data)
    setDailyTargetMinutes(data.daily_target_minutes)
    setHomeOfficeRatio(data.home_office_target_ratio)
    setOvertimeStartDate(data.overtime_start_date ?? '')
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

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>Settings</h1>

      {error ? <div className="error">{error}</div> : null}
      {!settings ? <div className="muted">...</div> : null}

      {settings ? (
        <>
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

        </>
      ) : null}
    </div>
  )
}
