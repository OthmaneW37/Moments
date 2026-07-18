import { useEffect, useRef, useState } from 'react'
import { api, CATEGORY_META, CONTEXT_SEARCH } from '../api'

const EMPTY = { title: '', category: 'autre', start_time: '', end_time: '', notes: '', visibility: 'friends', context: null }

function Stars({ value, onChange }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Ta note">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={n <= (value || 0) ? 'star on' : 'star'}
          onClick={() => onChange(n === value ? null : n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function ContextPicker({ category, context, onChange }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)

  const prompt = CONTEXT_SEARCH[category]

  // Reset la recherche quand la catégorie change
  useEffect(() => { setQ(''); setResults(null) }, [category])

  useEffect(() => {
    clearTimeout(debounce.current)
    if (q.trim().length < 2) { setResults(null); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await api.contextSearch(category, q.trim()))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(debounce.current)
  }, [q, category])

  if (!prompt) return null

  // Fiche choisie : on l'affiche avec sa note perso
  if (context) {
    return (
      <div className="ctx-block">
        <div className="ctx-selected">
          {context.image && <img src={context.image} alt="" />}
          <div className="ctx-selected-info">
            <strong>{context.title}</strong>
            <span className="muted">{context.subtitle}</span>
            {context.rating != null && (
              <span className="ctx-community">note communauté : {context.rating}</span>
            )}
          </div>
          <button type="button" className="ctx-remove" onClick={() => onChange(null)} aria-label="Retirer">×</button>
        </div>
        <div className="ctx-rate">
          <span>Ta note</span>
          <Stars value={context.my_rating} onChange={(n) => onChange({ ...context, my_rating: n })} />
        </div>
      </div>
    )
  }

  return (
    <div className="ctx-block">
      <input
        placeholder={prompt}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {searching && <p className="muted ctx-hint">Recherche…</p>}
      {results !== null && !searching && results.length === 0 && (
        <p className="muted ctx-hint">Rien trouvé — essaie un autre nom.</p>
      )}
      {results && results.length > 0 && (
        <div className="ctx-results">
          {results.map((r, i) => (
            <button
              type="button"
              key={i}
              className="ctx-result"
              onClick={() => onChange({ ...r, my_rating: null })}
            >
              {r.image
                ? <img src={r.image} alt="" />
                : <span className="ctx-thumb-fallback">📍</span>}
              <span className="ctx-result-info">
                <strong>{r.title}</strong>
                <span className="muted">{r.subtitle}</span>
              </span>
              {r.rating != null && <span className="ctx-result-note">★ {r.rating}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EventForm({ date, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY })
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
        context: form.context,
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
                onClick={() => setForm((f) => ({ ...f, category: key, context: null }))}
              >
                {meta.emoji} {meta.label}
              </button>
            ))}
          </div>
        </label>

        {CONTEXT_SEARCH[form.category] && (
          <label>
            Contexte {form.context ? '✓' : '(optionnel)'}
            <ContextPicker
              category={form.category}
              context={form.context}
              onChange={(ctx) => setForm((f) => ({ ...f, context: ctx }))}
            />
          </label>
        )}

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
