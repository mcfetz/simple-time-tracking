import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function RegisterPage() {
  const auth = useAuth()
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
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 0.3 }}>STT</div>
            <div className="muted" style={{ fontSize: 14 }}>
              Simple Time Tracking
            </div>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Account erstellen.
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          <label>
            E-Mail
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            Passwort (min. 8 Zeichen)
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? '...' : 'Account erstellen'}
          </button>
        </form>

        <p className="muted" style={{ margin: 0 }}>
          Schon registriert? <Link to="/login">Zum Login</Link>
        </p>
      </div>
    </div>
  )
}
