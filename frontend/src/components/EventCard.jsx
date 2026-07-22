import { useRef, useState } from 'react'
import { api, CATEGORY_META } from '../api'
import { toast } from '../toast'
import Media from './Media'
import ConfirmDialog from './ConfirmDialog'

export default function EventCard({ event, onChanged, onEdit }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [confirm, setConfirm] = useState(null) // { title, message, onConfirm } | null
  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.autre
  const hasPhotos = event.photos.length > 0

  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) await api.uploadPhoto(event.id, file)
      onChanged()
      toast.success(files.length > 1 ? `${files.length} médias ajoutés` : 'Souvenir capturé ✨')
    } catch (err) {
      toast.error(`Envoi impossible : ${err.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function handleDeletePhoto(photoId) {
    setConfirm({
      title: 'Supprimer ce média ?',
      message: 'Cette action est définitive.',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await api.deletePhoto(photoId)
          onChanged()
          toast.success('Média supprimé')
        } catch {
          toast.error('Suppression impossible')
        }
      },
    })
  }

  function handleDeleteEvent() {
    setConfirm({
      title: `Supprimer « ${event.title} » ?`,
      message: 'Le moment et ses photos seront définitivement supprimés.',
      onConfirm: async () => {
        setConfirm(null)
        try {
          await api.deleteEvent(event.id)
          onChanged()
          toast.success('Moment supprimé')
        } catch {
          toast.error('Suppression impossible')
        }
      },
    })
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

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Supprimer"
        danger
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
