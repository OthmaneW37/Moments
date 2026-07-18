import { useState } from 'react'
import { CATEGORY_META } from '../api'

const EMPTY = { title: '', category: 'autre', start_time: '', end_time: '', notes: '', visibility: 'friends' }

export default function EventForm({ date, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY })
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title: form.title.trim(),
        category: form.category,
        date: initial?.date ?? date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        notes: form.notes,
        visibility: form.visibility || 'friends',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{initial ? 'Modifier le moment' : 'Nouveau moment'}</h2>

        <label>
          Titre
          <input
            autoFocus
            placeholder="Ex : Regarder la finale au café ⚽"
            value={form.title}
            onChange={set('title')}
          />
        </label>

        <label>
          Catégorie
          <div className="cat-picker">
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <button
                type="button"
                key={key}
                className={`cat-chip ${form.category === key ? 'active' : ''}`}
                style={{ '--cat': meta.color }}
                onClick={() => setForm((f) => ({ ...f, category: key }))}
              >
                {meta.emoji} {meta.label}
              </button>
            ))}
          </div>
        </label>

        <div className="time-row">
          <label>
            Début
            <input type="time" value={form.start_time ?? ''} onChange={set('start_time')} />
          </label>
          <label>
            Fin
            <input type="time" value={form.end_time ?? ''} onChange={set('end_time')} />
          </label>
        </div>

        <label>
          Notes
          <textarea
            rows={2}
            placeholder="Détails, lieu, avec qui..."
            value={form.notes ?? ''}
            onChange={set('notes')}
          />
        </label>

        <label>
          Qui peut voir ce moment ?
          <div className="visibility-picker">
            <button
              type="button"
              className={`vis-chip ${(form.visibility ?? 'friends') === 'friends' ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, visibility: 'friends' }))}
            >
              👥 Mes amis
            </button>
            <button
              type="button"
              className={`vis-chip ${form.visibility === 'public' ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, visibility: 'public' }))}
            >
              🌍 Public (Découverte)
            </button>
          </div>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn primary" disabled={saving || !form.title.trim()}>
            {saving ? '...' : initial ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </div>
  )
}
