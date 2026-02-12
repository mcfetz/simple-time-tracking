import { apiFetch } from './api'
import type { DayNote } from './types'

export async function getDayNote(dateLocal: string): Promise<DayNote | null> {
  return apiFetch<DayNote | null>(`/notes/${dateLocal}`)
}

export async function upsertDayNote(dateLocal: string, content: string): Promise<DayNote> {
  return apiFetch<DayNote>(`/notes/${dateLocal}`, { method: 'PUT', body: { content } })
}

export async function deleteDayNote(dateLocal: string): Promise<void> {
  await apiFetch<void>(`/notes/${dateLocal}`, { method: 'DELETE' })
}
