import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { IconHistory } from '../components/icons'

export function RegisterPage() {
  const auth = useAuth()
  const { t } = useI18n()
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await auth.register(email, password)
      nav('/')
    } catch (err) {
      const msg = (err as { message?: string })?.message
      setError(msg || 'Registrierung fehlgeschlagen')
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
            {t('auth.register.title')}
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          <label>
            {t('auth.register.email')}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            {t('auth.register.password')}
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? '...' : t('auth.register.submit')}
          </button>
        </form>

        <p className="muted" style={{ margin: 0 }}>
          {t('auth.register.hasAccount')} <Link to="/login">{t('auth.register.toLogin')}</Link>
        </p>
      </div>
    </div>
  )
}
