import { useEffect, useState } from 'react'
import { subscribeToasts } from '../toast'

const ICONS = { success: '✓', error: '✕', info: 'ℹ' }
const DEFAULT_MS = 2600

// Pile de toasts en haut de l'écran. Auto-dismiss + tap pour fermer.
export default function ToastHost() {
  const [toasts, setToasts] = useState([])

  useEffect(() => subscribeToasts((t) => {
    setToasts((list) => [...list, t])
    const ttl = t.duration ?? DEFAULT_MS
    setTimeout(() => {
      setToasts((list) => list.filter((x) => x.id !== t.id))
    }, ttl)
  }), [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`toast toast--${t.type}`}
          onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
        >
          <span className="toast-icon" aria-hidden="true">{ICONS[t.type] ?? ICONS.info}</span>
          <span className="toast-msg">{t.message}</span>
          {t.action && (
            <span
              className="toast-action"
              onClick={(e) => { e.stopPropagation(); t.action.onClick(); setToasts((l) => l.filter((x) => x.id !== t.id)) }}
            >
              {t.action.label}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
