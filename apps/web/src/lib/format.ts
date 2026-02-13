import type { Lang } from './i18n'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseIsoDateUtc(iso: string): Date | null {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return dt
}

export function formatDateLocal(isoDate: string, lang: Lang): string {
  const dt = parseIsoDateUtc(isoDate)
  if (!dt) return isoDate
  const y = dt.getUTCFullYear()
  const m = pad2(dt.getUTCMonth() + 1)
  const d = pad2(dt.getUTCDate())
  return lang === 'de' ? `${d}.${m}.${y}` : `${m}/${d}/${y}`
}

export function formatDateTime(isoUtc: string, tz: string, lang: Lang): string {
  const d = new Date(isoUtc)
  if (Number.isNaN(d.getTime())) return isoUtc

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const yyyy = get('year')
  const mm = get('month')
  const dd = get('day')
  const hh = get('hour')
  const mi = get('minute')
  const ss = get('second')

  const date = lang === 'de' ? `${dd}.${mm}.${yyyy}` : `${mm}/${dd}/${yyyy}`
  const time = `${hh}:${mi}:${ss}`
  return `${date} ${time}`
}

export function formatTime(isoUtc: string, tz: string): string {
  const d = new Date(isoUtc)
  if (Number.isNaN(d.getTime())) return isoUtc

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('hour')}:${get('minute')}:${get('second')}`
}

export function localIsoDateFromUtc(isoUtc: string, tz: string): string {
  const d = new Date(isoUtc)
  if (Number.isNaN(d.getTime())) return isoUtc

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const yyyy = get('year')
  const mm = get('month')
  const dd = get('day')
  if (!yyyy || !mm || !dd) return isoUtc
  return `${yyyy}-${mm}-${dd}`
}
