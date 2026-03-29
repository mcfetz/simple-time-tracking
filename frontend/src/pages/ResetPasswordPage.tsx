import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useI18n } from '../lib/i18n'

export function ResetPasswordPage() {
  const { t } = useI18n()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    setLoading(true)
    try {
      if (!token) {
        setError(t('auth.reset.confirm.missingToken'))
        return
      }
      await apiFetch('/auth/password-reset/confirm', {
        method: 'POST',
        body: { token, new_password: password },
        retryOn401: false,
      })
      setDone(true)
      sessionStorage.setItem('tt_flash', t('auth.reset.confirm.done'))
      nav('/login')
    } catch (err) {
      setError((err as { message?: string })?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', justifySelf: 'center' }}>
        <h1 style={{ margin: 0 }}>{t('auth.reset.confirm.title')}</h1>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label>
            {t('auth.reset.confirm.password')}
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>

          {error ? <div className="error">{error}</div> : null}
          {done ? <div className="ok">{t('auth.reset.confirm.done')}</div> : null}

          <button type="submit" disabled={loading}>
            {loading ? '...' : t('auth.reset.confirm.submit')}
          </button>
        </form>

        <p className="muted" style={{ margin: 0 }}>
          <Link to="/login">{t('auth.register.toLogin')}</Link>
        </p>
      </div>
    </div>
  )
}
