import { apiFetch } from './api'
import { type Lang } from './i18n'

export type PushSubscriptionJson = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  expirationTime?: number | null
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function ensurePushPermission(): Promise<NotificationPermission> {
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export async function subscribeToPush(lang: Lang): Promise<void> {
  if (!('serviceWorker' in navigator)) throw new Error('errors.pushNotSupported')
  const keyResp = await apiFetch<{ public_key: string }>('/push/vapid-public-key')
  const publicKey = keyResp.public_key
  if (!publicKey) throw new Error('errors.pushMissingVapidKey')

  const readyPromise = navigator.serviceWorker.ready
  const timeoutPromise = new Promise<ServiceWorkerRegistration>((_resolve, reject) => {
    window.setTimeout(() => reject(new Error('errors.pushNoServiceWorker')), 4000)
  })
  const reg = await Promise.race([readyPromise, timeoutPromise])
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  const json = sub.toJSON() as PushSubscriptionJson
  await apiFetch('/push/subscribe', {
    method: 'POST',
    body: {
      endpoint: json.endpoint,
      keys: json.keys,
      lang,
    },
  })
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return

  const json = sub.toJSON() as PushSubscriptionJson
  await sub.unsubscribe()

  await apiFetch('/push/subscribe', {
    method: 'DELETE',
    body: {
      endpoint: json.endpoint,
    },
  })
}

export async function getCurrentPushSubscription(): Promise<PushSubscriptionJson | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? (sub.toJSON() as PushSubscriptionJson) : null
}
