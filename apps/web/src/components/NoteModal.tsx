import { useEffect, useState } from 'react'

type Props = {
  dateLocal: string
  open: boolean
  initialContent: string
  saving: boolean
  onClose: () => void
  onSave: (content: string) => void
  onDelete: () => void
}

export function NoteModal({
  dateLocal,
  open,
  initialContent,
  saving,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [value, setValue] = useState(initialContent)

  useEffect(() => {
    setValue(initialContent)
  }, [initialContent, open])

  if (!open) return null

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row">
          <strong>Notiz: {dateLocal}</strong>
          <button type="button" className="secondary" onClick={onClose}>
            Schließen
          </button>
        </div>

        <textarea
          rows={8}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Notiz (mehrzeilig)"
          style={{ width: '100%' }}
        />

        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="secondary" disabled={saving} onClick={() => onDelete()}>
            Löschen
          </button>
          <button type="button" disabled={saving} onClick={() => onSave(value)}>
            {saving ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
