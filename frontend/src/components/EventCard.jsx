import { useRef, useState } from 'react'
import { api, CATEGORY_META } from '../api'
import Media from './Media'

export default function EventCard({ event, onChanged, onEdit }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.autre
  const hasPhotos = event.photos.length > 0

  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) await api.uploadPhoto(event.id, file)
      onChanged()
    } catch (err) {
      alert(`Upload impossible : ${err.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDeletePhoto(photoId) {
    if (!confirm('Supprimer ce média ?')) return
    await api.deletePhoto(photoId)
    onChanged()
  }

  async function handleDeleteEvent() {
    if (!confirm(`Supprimer « ${event.title} » ?`)) return
    await api.deleteEvent(event.id)
    onChanged()
  }

  const time =
    event.start_time
      ? event.end_time
        ? `${event.start_time} – ${event.end_time}`
        : event.start_time
      : 'Toute la journée'

  return (
    <div className={`event-card ${hasPhotos ? 'captured' : ''}`} style={{ '--cat': meta.color }}>
      <div className="event-head">
        <span className="event-time">{time}</span>
        <span className="event-cat">{meta.emoji} {meta.label}</span>
        <span className="event-actions">
          <button className="icon-btn" title="Modifier" onClick={() => onEdit(event)}>✏️</button>
          <button className="icon-btn" title="Supprimer" onClick={handleDeleteEvent}>🗑️</button>
        </span>
      </div>

      <h3 className="event-title">{event.title}</h3>
      {event.notes && <p className="event-notes">{event.notes}</p>}

      {hasPhotos ? (
        <div className="photo-row">
          {event.photos.map((p) => (
            <div className="thumb" key={p.id}>
              <Media media={p} alt="" />
              <button className="thumb-del" title="Supprimer le média"
                      onClick={() => handleDeletePhoto(p.id)}>×</button>
            </div>
          ))}
          <button className="thumb add" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '…' : '+'}
          </button>
        </div>
      ) : (
        <button className="capture-nudge" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Envoi en cours…' : '📸 Capture ce moment — photo ou vidéo souvenir'}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={handleFiles}
      />
    </div>
  )
}
