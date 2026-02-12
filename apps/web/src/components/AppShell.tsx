import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

type Tab = {
  to: string
  label: string
  icon: string
}

const TABS: Tab[] = [
  { to: '/', label: 'Heute', icon: '⌂' },
  { to: '/history', label: 'History', icon: '⏱' },
  { to: '/reports', label: 'Reports', icon: '▦' },
  { to: '/absences', label: 'Abw.', icon: '✈' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export function AppShell() {
  const auth = useAuth()
  const loc = useLocation()

  return (
    <div className="shell">
      <header className="header desktopOnly">
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
          <Link className={loc.pathname.startsWith('/absences') ? 'active' : ''} to="/absences">
            Abwesenheiten
          </Link>
        </nav>
        <div className="headerRight">
          {auth.state.status === 'authenticated' ? <span className="muted small">{auth.state.user.email}</span> : null}
        </div>
      </header>

      <main className="main mainWithTabBar">
        <Outlet />
      </main>

      <nav className="tabBar mobileOnly" aria-label="Navigation">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `tabItem${isActive ? ' active' : ''}`}
            end={t.to === '/'}
          >
            <span className="tabIcon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="tabLabel">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
