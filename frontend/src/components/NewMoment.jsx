import { useEffect, useRef, useState } from 'react'
import { api, CATEGORY_META, CONTEXT_SEARCH, toISO } from '../api'
import { ContextPicker } from './EventForm'
import Icon from './Icon'

// Création d'un moment "sur le vif" : on capture d'abord une photo/vidéo,
// puis on renseigne le titre, la catégorie, le contexte et l'audience.
// Pas de début/fin ni de notes — c'est l'instant présent.
export default function NewMoment({ onDone, onCancel }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isVideo, setIsVideo] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'autre', visibility: 'friends', context: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)
  const opened = useRef(false)

  // Ouvre l'appareil photo / la galerie dès l'arrivée sur l'écran
  useEffect(() => {
    if (!opened.current) {
      opened.current = true
      fileRef.current?.click()
    }
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setIsVideo(f.type.startsWith('video'))
    setPreviewUrl(URL.createObjectURL(f))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file || !form.title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const ev = await api.createEvent({
        title: form.title.trim(),
        category: form.category,
        date: toISO(now),
        start_time: `${hh}:${mm}`,
        end_time: null,
        notes: '',
        visibility: form.visibility,
        context: form.context,
      })
      await api.uploadPhoto(ev.id, file)
      onDone()
    } catch (err) {
      setError(err.message || 'Échec de la publication')
      setSaving(false)
    }
  }

  return (
    <div className="page-sheet newmoment">
      <header className="page-sheet-head">
        <button className="page-sheet-back" onClick={onCancel} aria-label="Annuler">←</button>
        <span className="page-sheet-title">Nouveau moment</span>
      </header>

      {!file ? (
        <div className="capture-choice">
          <Icon name="camera" size="72" />
          <h3>Capture l'instant</h3>
          <p className="muted">Prends une photo ou une vidéo — c'est ce qui se passe maintenant.</p>
          <button className="btn primary big" onClick={() => fileRef.current?.click()}>
            📸 Ouvrir l'appareil
          </button>
        </div>
      ) : (
        <form className="newmoment-form" onSubmit={handleSubmit}>
          <div className="newmoment-preview">
            {isVideo
              ? <video src={previewUrl} muted loop autoPlay playsInline />
              : <img src={previewUrl} alt="Aperçu" />}
            <button type="button" className="newmoment-retake" onClick={() => fileRef.current?.click()}>
              Reprendre
            </button>
          </div>

          <label>
            Titre
            <input
              autoFocus
              placeholder="Ex : Coucher de soleil sur la plage 🌅"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>

          <div className="field">
            <span className="field-title">Catégorie</span>
            <div className="cat-picker">
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <button
                  type="button"
                  key={key}
                  className={`cat-chip ${form.category === key ? 'active' : ''}`}
                  style={{ '--cat': meta.color }}
                  onClick={() => setForm((f) => ({ ...f, category: key, context: null }))}
                >
                  <Icon emoji={meta.emoji} size="15" /> {meta.label}
                </button>
              ))}
            </div>
          </div>

          {CONTEXT_SEARCH[form.category] && (
            <div className="field">
              <span className="field-title">Contexte {form.context ? '✓' : '(optionnel)'}</span>
              <ContextPicker
                category={form.category}
                context={form.context}
                onChange={(ctx) => setForm((f) => ({ ...f, context: ctx }))}
              />
            </div>
          )}

          <div className="field">
            <span className="field-title">Qui peut voir ce moment ?</span>
            <div className="visibility-picker">
              <button
                type="button"
                className={`vis-chip ${form.visibility === 'friends' ? 'active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, visibility: 'friends' }))}
              >
                <Icon emoji="🫂" size="15" /> Mes abonnés
              </button>
              <button
                type="button"
                className={`vis-chip ${form.visibility === 'public' ? 'active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, visibility: 'public' }))}
              >
                <Icon emoji="🌍" size="15" /> Public (Découverte)
              </button>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <div className="newmoment-actions">
            <button type="submit" className="btn primary big" disabled={saving || !form.title.trim()}>
              {saving ? 'Publication…' : 'Publier le moment'}
            </button>
          </div>
        </form>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={handleFile}
      />
    </div>
  )
}
