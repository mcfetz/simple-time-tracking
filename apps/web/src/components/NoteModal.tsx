import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'

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
  const { t } = useI18n()
  const [value, setValue] = useState(initialContent)

  useEffect(() => {
    setValue(initialContent)
  }, [initialContent, open])

  if (!open) return null

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row">
          <strong>
            {t('common.note')}: {dateLocal}
          </strong>
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        <textarea
          rows={8}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('dashboard.notePlaceholder')}
          style={{ width: '100%' }}
        />

        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="secondary" disabled={saving} onClick={() => onDelete()}>
            {t('common.delete')}
          </button>
          <button type="button" disabled={saving} onClick={() => onSave(value)}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
