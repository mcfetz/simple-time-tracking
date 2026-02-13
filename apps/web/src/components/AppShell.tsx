import type { ComponentType } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import type { IconProps } from './icons'
import { IconAbsences, IconHistory, IconReports, IconSettings, IconToday } from './icons'

type Tab = {
  to: string
  label: string
  icon: ComponentType<IconProps>
}

const TABS: Tab[] = [
  { to: '/', label: 'nav.today', icon: IconToday },
  { to: '/history', label: 'nav.history', icon: IconHistory },
  { to: '/reports', label: 'nav.reports', icon: IconReports },
  { to: '/absences', label: 'nav.absences', icon: IconAbsences },
  { to: '/settings', label: 'nav.settings', icon: IconSettings },
]

export function AppShell() {
  const auth = useAuth()
  const { t } = useI18n()

  return (
    <div className="shell">
      <header className="header desktopOnly">
        <div className="brand">
          <Link to="/" className="brandLink">
            <span className="brandIcon" aria-hidden="true">
              <IconHistory />
            </span>
            <span>STT - Simple Time Tracking</span>
          </Link>
        </div>
        <nav className="nav" aria-label="Navigation">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) => `navItem${isActive ? ' active' : ''}`}
            >
              <span className="navIcon" aria-hidden="true">
                <tab.icon />
              </span>
              <span className="navLabel">{t(tab.label)}</span>
            </NavLink>
          ))}
        </nav>
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
              <tab.icon />
            </span>
            <span className="tabLabel">{t(tab.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
