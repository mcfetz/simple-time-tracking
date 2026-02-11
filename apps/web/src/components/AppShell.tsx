import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function AppShell() {
  const auth = useAuth()
  const loc = useLocation()

  return (
    <div className="shell">
      <header className="header">
        <div className="brand">
          <Link to="/">Time Tracking</Link>
        </div>
        <nav className="nav">
          <Link className={loc.pathname === '/' ? 'active' : ''} to="/">
            Dashboard
          </Link>
          <Link className={loc.pathname.startsWith('/history') ? 'active' : ''} to="/history">
            History
          </Link>
          <Link className={loc.pathname.startsWith('/reports') ? 'active' : ''} to="/reports">
            Reports
          </Link>
          <Link className={loc.pathname.startsWith('/settings') ? 'active' : ''} to="/settings">
            Settings
          </Link>
        </nav>
        <div className="headerRight">
          {auth.state.status === 'authenticated' ? (
            <>
              <span className="muted small">{auth.state.user.email}</span>
              <button className="secondary" onClick={() => auth.logout()}>
                Logout
              </button>
            </>
          ) : null}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
