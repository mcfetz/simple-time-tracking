import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { apiFetch } from './api'
import type { CreateClockEventRequest } from './types'

type QueuedClockEvent = {
  id: string
  created_at_ms: number
  payload: CreateClockEventRequest & { ts_utc: string }
}

type QueueListener = (count: number) => void

interface TimeTrackingDB extends DBSchema {
  clock_event_queue: {
    key: string
    value: QueuedClockEvent
    indexes: { 'by-created': number }
  }
}

const listeners = new Set<QueueListener>()
let dbPromise: Promise<IDBPDatabase<TimeTrackingDB> | null> | null = null

function getDb(): Promise<IDBPDatabase<TimeTrackingDB> | null> {
  if (!dbPromise) {
    dbPromise = openDB<TimeTrackingDB>('time-tracking', 1, {
      upgrade(db) {
        const hasStore = db.objectStoreNames.contains('clock_event_queue')
        if (!hasStore) {
          const store = db.createObjectStore('clock_event_queue', { keyPath: 'id' })
          store.createIndex('by-created', 'created_at_ms')
        }
      },
    }).catch(() => null)
  }

  return dbPromise
}

async function emitCount() {
  const db = await getDb()
  const count = db ? await db.count('clock_event_queue') : 0
  for (const l of listeners) l(count)
}

export function subscribeQueueCount(listener: QueueListener) {
  listeners.add(listener)
  emitCount().catch(() => undefined)
  return () => {
    listeners.delete(listener)
  }
}

export async function getQueueCount(): Promise<number> {
  const db = await getDb()
  if (!db) return 0
  return db.count('clock_event_queue')
}

export async function enqueueClockEvent(payload: CreateClockEventRequest): Promise<void> {
  const db = await getDb()
  if (!db) return

  const ts = new Date().toISOString()
  const id = payload.client_event_id ?? crypto.randomUUID()

  const entry: QueuedClockEvent = {
    id,
    created_at_ms: Date.now(),
    payload: {
      ...payload,
      client_event_id: id,
      ts_utc: ts,
    },
  }
  await db.put('clock_event_queue', entry)
  await emitCount()
}

export async function flushClockEventQueue(): Promise<{ sent: number; remaining: number }> {
  const db = await getDb()
  if (!db) return { sent: 0, remaining: 0 }

  let sent = 0

  while (true) {
    const tx = db.transaction('clock_event_queue', 'readonly')
    const index = tx.store.index('by-created')
    const cursor = await index.openCursor()
    await tx.done

    if (!cursor) break
    const item = cursor.value

    try {
      await apiFetch('/clock/events', { method: 'POST', body: item.payload })
      const delTx = db.transaction('clock_event_queue', 'readwrite')
      await delTx.store.delete(item.id)
      await delTx.done
      sent += 1
    } catch {
      break
    }
  }

  const remaining = await db.count('clock_event_queue')
  await emitCount()
  return { sent, remaining }
}

export function installAutoFlush() {
  const onOnline = () => {
    flushClockEventQueue().catch(() => undefined)
  }

  window.addEventListener('online', onOnline)
  flushClockEventQueue().catch(() => undefined)

  return () => {
    window.removeEventListener('online', onOnline)
  }
}
