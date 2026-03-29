import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { UserSettings } from '../lib/types'
import { useI18n, type Lang } from '../lib/i18n'
import { ensurePushPermission, getCurrentPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../lib/push'
import { useAuth } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

export function SettingsPage() {
  const i18n = useI18n()
  const { t } = i18n
  const auth = useAuth()
  const nav = useNavigate()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState<number>(468)
  const [homeOfficeRatio, setHomeOfficeRatio] = useState<number>(0.4)
  const [overtimeStartDate, setOvertimeStartDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushWorkMinutes, setPushWorkMinutes] = useState('')
  const [pushBreakMinutes, setPushBreakMinutes] = useState('')

  async function load() {
    setError(null)
    const data = await apiFetch<UserSettings>('/settings/me')
    setSettings(data)
    setDailyTargetMinutes(data.daily_target_minutes)
    setHomeOfficeRatio(data.home_office_target_ratio)
    setOvertimeStartDate(data.overtime_start_date ?? '')

    setPushWorkMinutes((data.push_work_minutes ?? []).join(', '))
    setPushBreakMinutes((data.push_break_minutes ?? []).join(', '))

    const sub = await getCurrentPushSubscription()
    setPushEnabled(Boolean(sub))
  }

  useEffect(() => {
    setPushSupported(isPushSupported())
    load().catch((e) => setError((e as { message?: string })?.message || t('errors.generic')))
  }, [])

  function parseMinuteList(raw: string): number[] {
    const parts = raw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)

    const nums: number[] = []
    for (const p of parts) {
      const n = Number(p)
      if (!Number.isFinite(n)) continue
      const i = Math.floor(n)
      if (i <= 0) continue
      nums.push(i)
    }
    return Array.from(new Set(nums)).sort((a, b) => a - b)
  }

  async function enablePush() {
    setError(null)
    if (!pushSupported) {
      setError(t('errors.pushNotSupported'))
      return
    }

    const perm = await ensurePushPermission()
    if (perm !== 'granted') {
      setError(t('errors.pushPermissionDenied'))
      return
    }

    try {
      await subscribeToPush(i18n.lang)
      setPushEnabled(true)
    } catch (e) {
      const msg = (e as { message?: string })?.message
      setError(t(msg || 'errors.generic'))
    }
  }

  async function disablePush() {
    setError(null)
    await unsubscribeFromPush()
    setPushEnabled(false)
  }

  async function testPush() {
    setError(null)
    const sub = await getCurrentPushSubscription()
    if (!sub) {
      setPushEnabled(false)
      return
    }

    await apiFetch('/push/test', {
      method: 'POST',
      body: {
        endpoint: sub.endpoint,
      },
    })
  }

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
          push_work_minutes: parseMinuteList(pushWorkMinutes),
          push_break_minutes: parseMinuteList(pushBreakMinutes),
        },
      })
      setSettings(data)
      setSaved(true)
    } catch (err) {
      setError((err as { message?: string })?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteAccount() {
    if (!confirm(t('confirm.deleteAccount1'))) return
    if (!confirm(t('confirm.deleteAccount2'))) return

    setError(null)
    setLoading(true)
    try {
      await apiFetch('/settings/me', { method: 'DELETE' })
    } finally {
      await auth.logout()
      nav('/login')
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>{t('settings.title')}</h1>

      {error ? <div className="error">{error}</div> : null}
      {!settings ? <div className="muted">...</div> : null}

      {settings ? (
        <>
          <section className="card">
            <h2>{t('settings.language')}</h2>
            <label>
              {t('settings.appLanguage')}
              <select value={i18n.lang} onChange={(e) => i18n.setLang(e.target.value as Lang)}>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </label>
          </section>

          <section className="card">
            <h2>{t('settings.pushNotifications')}</h2>
            <div className="row">
              <span className="muted">{pushEnabled ? t('settings.pushEnabled') : t('settings.pushDisabled')}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {pushEnabled ? (
                  <>
                    <button className="secondary" type="button" onClick={() => testPush()}>
                      {t('settings.pushTest')}
                    </button>
                    <button className="secondary" type="button" onClick={() => disablePush()}>
                      {t('settings.pushDisable')}
                    </button>
                  </>
                ) : (
                  <button className="secondary" type="button" onClick={() => enablePush()}>
                    {t('settings.pushEnable')}
                  </button>
                )}
              </div>
            </div>
            <label>
              {t('settings.pushWorkMinutes')}
              <input value={pushWorkMinutes} onChange={(e) => setPushWorkMinutes(e.target.value)} placeholder={t('settings.pushWorkMinutesHint')} />
            </label>
            <label>
              {t('settings.pushBreakMinutes')}
              <input value={pushBreakMinutes} onChange={(e) => setPushBreakMinutes(e.target.value)} placeholder={t('settings.pushBreakMinutesHint')} />
            </label>
          </section>

          <form className="card" onSubmit={onSubmit}>
            <label>
              {t('settings.dailyTarget')}
              <input
                type="number"
                min={0}
                max={24 * 60}
                value={dailyTargetMinutes}
                onChange={(e) => setDailyTargetMinutes(Number(e.target.value))}
              />
            </label>

            <label>
              {t('settings.homeOfficeTarget')}
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
              {t('settings.overtimeStart')} (YYYY-MM-DD)
              <input
                type="date"
                value={overtimeStartDate}
                onChange={(e) => setOvertimeStartDate(e.target.value)}
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? t('common.loading') : t('common.save')}
            </button>

            {saved ? <div className="ok">{t('settings.saved')}</div> : null}
          </form>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>{t('settings.deleteAccount')}</h2>
            <button type="button" disabled={loading} onClick={() => deleteAccount()} style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#991b1b' }}>
              {t('settings.deleteAccount')}
            </button>
          </section>

        </>
      ) : null}
    </div>
  )
}
