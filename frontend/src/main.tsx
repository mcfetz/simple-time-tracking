import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { installAutoFlush } from './lib/offlineQueue'
import { I18nProvider } from './lib/i18n'
import { loadAccessTokenFromStorage } from './lib/api'

loadAccessTokenFromStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </AppErrorBoundary>
  </StrictMode>,
)

installAutoFlush()
