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
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 style={{ margin: 0 }}>Registrieren</h1>
        <p className="muted" style={{ margin: 0 }}>
          Neuen Benutzer anlegen.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card">
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

      <p className="muted">
        Schon registriert? <Link to="/login">Zum Login</Link>
      </p>
    </div>
  )
}
