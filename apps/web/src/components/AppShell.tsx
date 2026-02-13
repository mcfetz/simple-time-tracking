import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

type Tab = {
  to: string
  label: string
  icon: string
}

const TABS: Tab[] = [
  { to: '/', label: 'nav.today', icon: '⌂' },
  { to: '/history', label: 'nav.history', icon: '⏱' },
  { to: '/reports', label: 'nav.reports', icon: '▦' },
  { to: '/absences', label: 'nav.absences', icon: '✈' },
  { to: '/settings', label: 'nav.settings', icon: '⚙' },
]

export function AppShell() {
  const auth = useAuth()
  const { t } = useI18n()

  return (
    <div className="shell">
      <header className="header desktopOnly">
        <div className="brand">
          <Link to="/">⏱  STT - Simple Time Tracking</Link>
        </div>
        <div />
        <div className="headerRight">
          {auth.state.status === 'authenticated' ? <span className="muted small">{auth.state.user.email}</span> : null}
        </div>
      </header>

      <main className="main mainWithTabBar">
        <Outlet />
      </main>

      <nav className="tabBar mobileOnly" aria-label="Navigation">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `tabItem${isActive ? ' active' : ''}`}
            end={tab.to === '/'}
          >
            <span className="tabIcon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="tabLabel">{t(tab.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
