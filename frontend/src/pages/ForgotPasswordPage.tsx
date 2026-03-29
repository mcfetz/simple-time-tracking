import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useI18n } from '../lib/i18n'

export function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    setLoading(true)
    try {
      await apiFetch('/auth/password-reset/request', {
        method: 'POST',
        body: { email },
        retryOn401: false,
      })
      setDone(true)
    } catch (err) {
      setError((err as { message?: string })?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', justifySelf: 'center' }}>
        <h1 style={{ margin: 0 }}>{t('auth.reset.request.title')}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {t('auth.reset.request.hint')}
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label>
            {t('auth.login.email')}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>

          {error ? <div className="error">{error}</div> : null}
          {done ? <div className="ok">{t('auth.reset.request.done')}</div> : null}

          <button type="submit" disabled={loading}>
            {loading ? '...' : t('auth.reset.request.submit')}
          </button>
        </form>

        <p className="muted" style={{ margin: 0 }}>
          <Link to="/login">{t('auth.register.toLogin')}</Link>
        </p>
      </div>
    </div>
  )
}
