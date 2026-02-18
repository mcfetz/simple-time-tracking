import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { IconHistory } from '../components/icons'

export function LoginPage() {
  const auth = useAuth()
  const { t } = useI18n()
  const nav = useNavigate()

  const [flash, setFlash] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const msg = sessionStorage.getItem('tt_flash')
    if (msg) {
      setFlash(msg)
      sessionStorage.removeItem('tt_flash')
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await auth.login(email, password)
      nav('/')
    } catch (err) {
      const msg = (err as { message?: string })?.message
      setError(msg || 'Login fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', justifySelf: 'center' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'grid', gap: 2, justifyItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: 0.3,
              }}
            >
              <span aria-hidden="true" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center' }}>
                <IconHistory className="authLogoIcon" />
              </span>
              <span>STT</span>
            </div>
            <div className="muted" style={{ fontSize: 14 }}>
              {t('app.name.long')}
            </div>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {t('auth.login.title')}
          </p>
          {flash ? <div className="warn small">{flash}</div> : null}
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          <label>
            {t('auth.login.email')}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            {t('auth.login.password')}
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>

          {error ? <div className="error">{error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? '...' : t('auth.login.submit')}
          </button>
        </form>

        <p className="muted" style={{ margin: 0 }}>
          {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.register')}</Link>
        </p>
        <p className="muted" style={{ margin: 0 }}>
          <Link to="/forgot-password">{t('auth.login.forgotPassword')}</Link>
        </p>
      </div>
    </div>
  )
}
