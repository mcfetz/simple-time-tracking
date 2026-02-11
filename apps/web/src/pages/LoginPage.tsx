import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function LoginPage() {
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
    <div className="page">
      <h1>Time Tracking</h1>
      <p className="muted">Bitte anmelden.</p>

      <form onSubmit={onSubmit} className="card">
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

      <p className="muted">
        Kein Account? <Link to="/register">Registrieren</Link>
      </p>
    </div>
  )
}
