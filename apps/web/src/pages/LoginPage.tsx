import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function LoginPage() {
  const auth = useAuth()
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
          <h1 style={{ margin: 0 }}>Time Tracking</h1>
          <p className="muted" style={{ margin: 0 }}>
            Bitte anmelden.
          </p>
          {flash ? <div className="warn small">{flash}</div> : null}
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            E-Mail
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            Passwort
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>

          {error ? <div className="error">{error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? '...' : 'Login'}
          </button>
        </form>

        <p className="muted" style={{ margin: 0 }}>
          Kein Account? <Link to="/register">Registrieren</Link>
        </p>
      </div>
    </div>
  )
}
