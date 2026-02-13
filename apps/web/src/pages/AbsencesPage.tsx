import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Absence, AbsenceReason } from '../lib/types'
import { useI18n } from '../lib/i18n'

type Draft = {
  start_date: string
  end_date: string
  reason_id: number | ''
}

export function AbsencesPage() {
  const { t } = useI18n()
  const [reasons, setReasons] = useState<AbsenceReason[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [reasonModalOpen, setReasonModalOpen] = useState(false)
  const [newReasonName, setNewReasonName] = useState('')
  const [reasonSaving, setReasonSaving] = useState(false)

  const [manageReasonsOpen, setManageReasonsOpen] = useState(false)
  const [manageBusyId, setManageBusyId] = useState<number | null>(null)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [draft, setDraft] = useState<Draft>({ start_date: today, end_date: today, reason_id: '' })

  async function refreshReasons() {
    const rs = await apiFetch<AbsenceReason[]>('/absences/reasons')
    setReasons(rs)
    return rs
  }

  async function createReason(nameRaw: string) {
    const name = nameRaw.trim()
    if (!name) return
    setReasonSaving(true)
    setError(null)
    try {
      const created = await apiFetch<AbsenceReason>('/absences/reasons', { method: 'POST', body: { name } })
      await refreshReasons()
      setDraft((d) => ({ ...d, reason_id: created.id }))
      setNewReasonName('')
      setReasonModalOpen(false)
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setReasonSaving(false)
    }
  }

  async function load() {
    setError(null)
    const [rs, as] = await Promise.all([
      apiFetch<AbsenceReason[]>('/absences/reasons'),
      apiFetch<Absence[]>('/absences'),
    ])
    setReasons(rs)
    setAbsences(as)
  }

  async function renameReason(id: number, nameRaw: string) {
    const name = nameRaw.trim()
    if (!name) return
    setManageBusyId(id)
    setError(null)
    try {
      await apiFetch<AbsenceReason>(`/absences/reasons/${id}`, { method: 'PUT', body: { name } })
      await refreshReasons()
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setManageBusyId(null)
    }
  }

  async function deleteReason(id: number) {
    if (!confirm(t('confirm.deleteReason'))) return
    setManageBusyId(id)
    setError(null)
    try {
      await apiFetch<void>(`/absences/reasons/${id}`, { method: 'DELETE' })
      const rs = await refreshReasons()
      setDraft((d) => {
        if (d.reason_id && d.reason_id === id) return { ...d, reason_id: '' }
        if (d.reason_id && !rs.some((r) => r.id === d.reason_id)) return { ...d, reason_id: '' }
        return d
      })
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setManageBusyId(null)
    }
  }

  useEffect(() => {
    load().catch((e) => setError((e as { message?: string })?.message || t('errors.generic')))
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
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  async function remove(id: number) {
    if (!confirm(t('confirm.deleteAbsence'))) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch<void>(`/absences/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>{t('absences.title')}</h1>
      {error ? <div className="error">{error}</div> : null}

      <section className="card">
        <h2>{t('absences.new')}</h2>
          <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          <label>
            {t('absences.start')}
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
            />
          </label>
          <label>
            {t('absences.end')}
            <input
              type="date"
              value={draft.end_date}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            />
          </label>
        </div>
        <label>
          {t('absences.reason')}
          <select
            value={draft.reason_id}
            onChange={(e) => {
              const raw = e.target.value
            if (raw === '__new__') {
              setReasonModalOpen(true)
              return
            }
              if (raw === '__manage__') {
                setManageReasonsOpen(true)
                return
              }

              setDraft({ ...draft, reason_id: Number(raw) })
            }}
          >
            <option value="">{t('absences.selectPlaceholder')}</option>
            <option value="__new__">{t('absences.reasonNew')}</option>
            <option value="__manage__">{t('absences.reasonManage')}</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={loading || !draft.reason_id} onClick={() => create()}>
          {t('absences.create')}
        </button>
        <p className="muted small">{t('absences.createHint')}</p>
      </section>

      <section className="card">
        <h2>{t('absences.list')}</h2>
        <div className="table">
          <div
            className="thead"
            style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 0.9fr)' }}
          >
            <div>Start</div>
            <div>Ende</div>
            <div>Grund</div>
            <div />
          </div>
          {absences.map((a) => (
            <div
              key={a.id}
              className="trow"
              style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 0.9fr)' }}
            >
              <div>{a.start_date}</div>
              <div>{a.end_date}</div>
              <div>{a.reason.name}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button className="secondary" disabled={loading} onClick={() => remove(a.id)}>
                    {t('common.delete')}
                  </button>
              </div>
            </div>
          ))}
          {absences.length === 0 ? <div className="muted">{t('absences.none')}</div> : null}
        </div>
      </section>

      {reasonModalOpen ? (
        <div
          className="modalOverlay"
          onMouseDown={() => {
            if (reasonSaving) return
            setReasonModalOpen(false)
          }}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="row">
              <strong>{t('absences.reasonModalTitle')}</strong>
              <button className="secondary" type="button" disabled={reasonSaving} onClick={() => setReasonModalOpen(false)}>
                {t('common.close')}
              </button>
            </div>

            <label>
              {t('absences.reasonName')}
              <input
                value={newReasonName}
                autoFocus
                placeholder={t('absences.reasonCreateExample')}
                onChange={(e) => setNewReasonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    createReason(newReasonName).catch(() => undefined)
                  }
                }}
              />
            </label>

            <div className="row" style={{ marginTop: 10 }}>
              <div />
              <button type="button" disabled={reasonSaving || !newReasonName.trim()} onClick={() => createReason(newReasonName)}>
                {reasonSaving ? t('common.loading') : t('absences.create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manageReasonsOpen ? (
        <div
          className="modalOverlay"
          onMouseDown={() => {
            if (manageBusyId !== null) return
            setManageReasonsOpen(false)
          }}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="row">
              <strong>{t('absences.manageReasonsTitle')}</strong>
              <button className="secondary" type="button" disabled={manageBusyId !== null} onClick={() => setManageReasonsOpen(false)}>
                {t('common.close')}
              </button>
            </div>

            <div className="table">
              {reasons.map((r) => (
                <div key={r.id} className="trow" style={{ gridTemplateColumns: '1fr 120px' }}>
                  <input
                    defaultValue={r.name}
                    disabled={manageBusyId === r.id}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next && next !== r.name) {
                        renameReason(r.id, next).catch(() => undefined)
                      }
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="secondary" type="button" disabled={manageBusyId === r.id} onClick={() => deleteReason(r.id)}>
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
              {reasons.length === 0 ? <div className="muted">{t('absences.noReasons')}</div> : null}
            </div>

            <p className="muted small" style={{ margin: 0 }}>
              {t('absences.reasonDeleteHint')}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
