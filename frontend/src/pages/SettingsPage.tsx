import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { UserSettings, WebhookToken } from '../lib/types'
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

  const [webhook, setWebhook] = useState<WebhookToken | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState('')
  const [webhookOffset, setWebhookOffset] = useState('')

  function webhookBase(): string {
    if (typeof window !== 'undefined' && window.location.origin) return window.location.origin
    return ''
  }

  async function loadWebhook() {
    try {
      const data = await apiFetch<WebhookToken>('/webhooks/token')
      setWebhook(data)
    } catch {
      setWebhook(null)
    }
  }

  async function generateWebhook() {
    if (webhook && !confirm(t('settings.webhookConfirmRegenerate'))) return
    setWebhookLoading(true)
    setError(null)
    try {
      const data = await apiFetch<WebhookToken>('/webhooks/token', { method: 'POST' })
      setWebhook(data)
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setWebhookLoading(false)
    }
  }

  async function deleteWebhook() {
    if (!confirm(t('settings.webhookConfirmDelete'))) return
    setWebhookLoading(true)
    setError(null)
    try {
      await apiFetch('/webhooks/token', { method: 'DELETE' })
      setWebhook(null)
    } catch (e) {
      setError((e as { message?: string })?.message || t('errors.generic'))
    } finally {
      setWebhookLoading(false)
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const el = document.createElement('textarea')
      el.value = value
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    setWebhookCopied(t('settings.webhookCopied'))
    setTimeout(() => setWebhookCopied(''), 1400)
  }

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
    loadWebhook()
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

          <section className="card">
            <h2 style={{ marginTop: 0 }}>{t('settings.webhooks')}</h2>
            <div className="muted small" style={{ marginBottom: 8 }}>{t('settings.webhookDesc')}</div>
            <label style={{ display: 'grid', gap: 4, marginBottom: 10, maxWidth: 320 }}>
              <span className="muted small">{t('settings.webhookOffset')}</span>
              <input
                type="number"
                step="1"
                value={webhookOffset}
                onChange={(e) => setWebhookOffset(e.target.value)}
                placeholder="-5"
                style={{ maxWidth: 180 }}
              />
            </label>
            {webhook ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <button type="button" className="secondary" disabled={webhookLoading} onClick={generateWebhook}>
                    {webhookLoading ? t('common.loading') : t('settings.webhookRegenerate')}
                  </button>
                  <button type="button" className="secondary" disabled={webhookLoading} onClick={deleteWebhook} style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#991b1b' }}>
                    {t('settings.webhookDelete')}
                  </button>
                  {webhookCopied ? <span className="muted small" style={{ alignSelf: 'center' }}>{webhookCopied}</span> : null}
                </div>
                {(() => {
                  const base = webhookBase()
                  const tok = webhook.token
                  const offRaw = webhookOffset.trim()
                  const off = offRaw ? (Number(offRaw) || 0) : null
                  const offSuffix = off !== null && off !== 0 ? `&offset=${off}` : ''
                  const rows: Array<[string, string]> = [
                    [t('settings.webhookComeOffice'), `${base}/api/webhooks/${tok}/come?location=OFFICE${offSuffix}`],
                    [t('settings.webhookComeHome'), `${base}/api/webhooks/${tok}/come?location=HOME${offSuffix}`],
                    [t('settings.webhookGo'), `${base}/api/webhooks/${tok}/go${offSuffix ? `?offset=${off}` : ''}`],
                  ]
                  return (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {rows.map(([label, url]) => (
                        <div
                          key={label}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', gap: 8 }}
                        >
                          <strong className="small">{label}</strong>
                          <button type="button" className="secondary" onClick={() => copyText(url)}>Copy</button>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
            ) : (
              <>
                <div className="muted" style={{ marginBottom: 8 }}>{t('settings.webhookNoToken')}</div>
                <button type="button" disabled={webhookLoading} onClick={generateWebhook}>
                  {webhookLoading ? t('common.loading') : t('settings.webhookGenerate')}
                </button>
              </>
            )}
          </section>

        </>
      ) : null}
    </div>
  )
}
