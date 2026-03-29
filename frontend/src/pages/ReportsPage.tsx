import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import type { MonthReport, WeekReport } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { formatDateLocal } from '../lib/format'

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export function ReportsPage() {
  const { t, lang } = useI18n()
  const [search, setSearch] = useSearchParams()

  const todayLocal = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const weekStart = search.get('week') || ''
  const monthKey = search.get('month') || ''

  const [week, setWeek] = useState<WeekReport | null>(null)
  const [month, setMonth] = useState<MonthReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setWeekParam(startLocal: string) {
    const next = new URLSearchParams(search)
    if (startLocal) next.set('week', startLocal)
    else next.delete('week')
    setSearch(next, { replace: true })
  }

  function setMonthParam(month: string) {
    const next = new URLSearchParams(search)
    if (month) next.set('month', month)
    else next.delete('month')
    setSearch(next, { replace: true })
  }

  function shiftIsoDate(iso: string, days: number): string {
    const [y, m, dd] = iso.split('-').map((x) => Number(x))
    const d = new Date(Date.UTC(y, m - 1, dd))
    d.setUTCDate(d.getUTCDate() + days)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  function shiftMonthKey(yyyyMm: string, delta: number): string {
    const [y, m] = yyyyMm.split('-').map((x) => Number(x))
    const d = new Date(Date.UTC(y, m - 1, 1))
    d.setUTCMonth(d.getUTCMonth() + delta)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  useEffect(() => {
    ;(async () => {
      setError(null)
      const w = await apiFetch<WeekReport>(weekStart ? `/reports/week?start=${encodeURIComponent(weekStart)}` : '/reports/week')
      const m = await apiFetch<MonthReport>(monthKey ? `/reports/month?month=${encodeURIComponent(monthKey)}` : '/reports/month')
      setWeek(w)
      setMonth(m)
    })().catch((e) => setError((e as { message?: string })?.message || t('errors.generic')))
  }, [weekStart, monthKey])

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>{t('reports.title')}</h1>
      {error ? <div className="error">{error}</div> : null}

      <div className="grid">
        <section className="card">
          <div className="row" style={{ alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{t('reports.week')}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                className="secondary"
                type="button"
                onClick={() => setWeekParam(shiftIsoDate((week?.week_start_local ?? weekStart) || todayLocal, -7))}
              >
                ‹
              </button>
              <input
                type="date"
                value={(week?.week_start_local ?? weekStart) || ''}
                onChange={(e) => setWeekParam(e.target.value)}
              />
              <button
                className="secondary"
                type="button"
                onClick={() => setWeekParam(shiftIsoDate((week?.week_start_local ?? weekStart) || todayLocal, 7))}
              >
                ›
              </button>
            </div>
          </div>
          {!week ? (
            <div className="muted">{t('common.loading')}</div>
          ) : (
            <>
              <div className="row">
                <span className="muted">{t('reports.period')}</span>
                <strong>
                  {formatDateLocal(week.week_start_local, lang)} – {formatDateLocal(week.week_end_local_exclusive, lang)}
                </strong>
              </div>
              <div className="row">
                <span className="muted">{t('reports.work')}</span>
                <strong>{fmtMinutes(week.total_worked_minutes)}</strong>
              </div>
              <div className="row">
                <span className="muted">{t('reports.break')}</span>
                <strong>{fmtMinutes(week.total_break_minutes)}</strong>
              </div>

              <div className="reportsWeekList">
                {week.days.map((d) => (
                  <div key={d.date_local} className="card" style={{ padding: 10 }}>
                    <div className="row" style={{ alignItems: 'center' }}>
                      <strong>{d.date_local}</strong>
                      <span className="muted small">{fmtMinutes(d.worked_minutes)}</span>
                    </div>
                    <div className="row">
                      <span className="muted small">{t('reports.break')}</span>
                      <span className="muted small">{fmtMinutes(d.break_minutes)}</span>
                    </div>
                    {d.max_daily_work_exceeded || d.rest_period_violation || !d.break_compliant_total ? (
                      <div className="muted small">
                        {d.max_daily_work_exceeded ? `${t('reports.warningOver10h')} ` : ''}
                        {d.rest_period_violation ? `${t('reports.warningRest11h')} ` : ''}
                        {!d.break_compliant_total ? t('reports.warningBreak') : ''}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="card">
          <div className="row" style={{ alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{t('reports.month')}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  setMonthParam(shiftMonthKey((monthKey || month?.month_start_local?.slice(0, 7)) ?? todayLocal.slice(0, 7), -1))
                }
              >
                ‹
              </button>
              <input
                type="month"
                value={(monthKey || month?.month_start_local?.slice(0, 7)) ?? ''}
                onChange={(e) => setMonthParam(e.target.value)}
              />
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  setMonthParam(shiftMonthKey((monthKey || month?.month_start_local?.slice(0, 7)) ?? todayLocal.slice(0, 7), 1))
                }
              >
                ›
              </button>
            </div>
          </div>
          {!month ? (
            <div className="muted">{t('common.loading')}</div>
          ) : (
            <>
              <div className="row">
                <span className="muted">{t('reports.period')}</span>
                <strong>
                  {formatDateLocal(month.month_start_local, lang)} – {formatDateLocal(month.month_end_local_exclusive, lang)}
                </strong>
              </div>
              <div className="row">
                <span className="muted">{t('reports.work')}</span>
                <strong>{fmtMinutes(month.total_worked_minutes)}</strong>
              </div>
              <div className="row">
                <span className="muted">{t('reports.homeOffice')}</span>
                <strong>
                  {month.home_office_days}/{month.worked_days} ({Math.round(month.home_office_ratio * 100)}% / {t('reports.target')}{' '}
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
