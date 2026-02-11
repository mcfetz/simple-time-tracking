import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { MonthReport, WeekReport } from '../lib/types'

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export function ReportsPage() {
  const [week, setWeek] = useState<WeekReport | null>(null)
  const [month, setMonth] = useState<MonthReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setError(null)
      const w = await apiFetch<WeekReport>('/reports/week')
      const m = await apiFetch<MonthReport>('/reports/month')
      setWeek(w)
      setMonth(m)
    })().catch((e) => setError((e as { message?: string })?.message || 'Fehler'))
  }, [])

  return (
    <div className="page">
      <h1>Reports</h1>
      {error ? <div className="error">{error}</div> : null}

      <div className="grid">
        <section className="card">
          <h2>Woche</h2>
          {!week ? (
            <div className="muted">...</div>
          ) : (
            <>
              <div className="row">
                <span className="muted">Zeitraum</span>
                <strong>
                  {week.week_start_local} – {week.week_end_local_exclusive}
                </strong>
              </div>
              <div className="row">
                <span className="muted">Arbeit</span>
                <strong>{fmtMinutes(week.total_worked_minutes)}</strong>
              </div>
              <div className="row">
                <span className="muted">Pause</span>
                <strong>{fmtMinutes(week.total_break_minutes)}</strong>
              </div>

              <div className="table">
                <div className="thead">
                  <div>Tag</div>
                  <div>Arbeit</div>
                  <div>Pause</div>
                  <div>Warnungen</div>
                </div>
                {week.days.map((d) => (
                  <div key={d.date_local} className="trow">
                    <div>{d.date_local}</div>
                    <div>{fmtMinutes(d.worked_minutes)}</div>
                    <div>{fmtMinutes(d.break_minutes)}</div>
                    <div className="muted">
                      {d.max_daily_work_exceeded ? '>10h ' : ''}
                      {d.rest_period_violation ? 'Ruhezeit<11h ' : ''}
                      {!d.break_compliant_total ? 'Pause' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="card">
          <h2>Monat</h2>
          {!month ? (
            <div className="muted">...</div>
          ) : (
            <>
              <div className="row">
                <span className="muted">Zeitraum</span>
                <strong>
                  {month.month_start_local} – {month.month_end_local_exclusive}
                </strong>
              </div>
              <div className="row">
                <span className="muted">Arbeit</span>
                <strong>{fmtMinutes(month.total_worked_minutes)}</strong>
              </div>
              <div className="row">
                <span className="muted">Home Office</span>
                <strong>
                  {month.home_office_days}/{month.worked_days} ({Math.round(month.home_office_ratio * 100)}% / Ziel{' '}
                  {Math.round(month.home_office_target_ratio * 100)}%)
                </strong>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
