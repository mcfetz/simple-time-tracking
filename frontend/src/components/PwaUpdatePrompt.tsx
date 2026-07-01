import { useRegisterSW } from 'virtual:pwa-register/react'

import { useI18n } from '../lib/i18n'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
let updateCheckStarted = false

export function PwaUpdatePrompt() {
  const { t } = useI18n()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      if (!registration || updateCheckStarted) return
      updateCheckStarted = true
      window.setInterval(() => {
        void registration.update()
      }, UPDATE_CHECK_INTERVAL_MS)
    },
    onRegisterError(error: unknown) {
      console.error('SW registration error', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="pwaUpdateBanner" role="status" aria-live="polite">
      <div className="pwaUpdateBannerBody">
        <strong>{t('pwa.updateTitle')}</strong>
        <div className="small">{t('pwa.updateBody')}</div>
      </div>
      <div className="pwaUpdateBannerActions">
        <button className="secondary" type="button" onClick={() => setNeedRefresh(false)}>
          {t('common.close')}
        </button>
        <button type="button" onClick={() => void updateServiceWorker(true)}>
          {t('pwa.updateAction')}
        </button>
      </div>
    </div>
  )
}
