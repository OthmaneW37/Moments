import { useEffect, useState } from 'react'
import { api } from '../api'
import { toast } from '../toast'
import Icon from './Icon'

function timeAgo(sqlDate) {
  if (!sqlDate) return ''
  const then = new Date(sqlDate.replace(' ', 'T') + 'Z')
  const mins = Math.max(0, Math.floor((Date.now() - then.getTime()) / 60000))
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} j`
}

export default function Comments({ eventId, onCountChange, onOpenUser }) {
  const [comments, setComments] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.comments(eventId).then(setComments).catch(() => setComments([]))
  }, [eventId])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const c = await api.addComment(eventId, text.trim())
      setComments((cs) => [...cs, c])
      setText('')
      onCountChange(1)
    } catch {
      toast.error('Commentaire non publié, réessaie')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id) {
    const prev = comments
    setComments((cs) => cs.filter((c) => c.id !== id)) // optimiste
    onCountChange(-1)
    try {
      await api.deleteComment(id)
    } catch {
      setComments(prev) // rollback
      onCountChange(1)
      toast.error('Suppression impossible')
    }
  }

  if (comments === null) {
    return (
      <div className="comments-loading">
        <span className="sk sk-line" style={{ width: '60%' }} />
        <span className="sk sk-line" style={{ width: '80%' }} />
      </div>
    )
  }

  return (
    <div className="comments">
      <header className="comments-head">
        <Icon emoji="💬" size="16" /> {comments.length === 0 ? 'Sois le premier à commenter' : `${comments.length} commentaire${comments.length > 1 ? 's' : ''}`}
      </header>

      <div className="comments-list">
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <button
              className="comment-avatar"
              onClick={() => onOpenUser?.(c.username)}
              aria-label={`Profil de ${c.display_name}`}
            >
              <Icon emoji={c.emoji} size="18" />
            </button>
            <div className="comment-body">
              <span className="comment-meta">
                <button className="comment-author" onClick={() => onOpenUser?.(c.username)}>
                  {c.is_me ? 'Toi' : c.display_name}
                </button>
                <span className="comment-time">{timeAgo(c.created_at)}</span>
              </span>
              <span className="comment-text">{c.text}</span>
            </div>
            {Boolean(c.is_me) && (
              <button className="comment-del" onClick={() => handleDelete(c.id)} aria-label="Supprimer">×</button>
            )}
          </div>
        ))}
      </div>

      <form className="comment-form" onSubmit={handleSend}>
        <input
          placeholder="Ajoute un commentaire…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <button className="btn primary sm" type="submit" disabled={!text.trim() || sending}>➤</button>
      </form>
    </div>
  )
}
