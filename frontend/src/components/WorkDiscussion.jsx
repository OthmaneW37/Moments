import { useState } from 'react'
import { api } from '../api'
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

// Fil de discussion attaché à une ŒUVRE (film/livre/match/lieu), indépendant
// des moments — on débat de l'œuvre elle-même, façon forum Letterboxd.
export default function WorkDiscussion({ kind, title, initial, onOpenUser }) {
  const [comments, setComments] = useState(initial)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const c = await api.addWorkComment(kind, title, text.trim())
      setComments((cs) => [...cs, c])
      setText('')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id) {
    await api.deleteWorkComment(id)
    setComments((cs) => cs.filter((c) => c.id !== id))
  }

  return (
    <section className="work-disc">
      <h3><Icon emoji="💬" size="17" /> Discussion</h3>
      {comments.length === 0 && (
        <p className="muted work-disc-empty">Lance la discussion sur cette œuvre — donne ton avis !</p>
      )}
      <div className="work-disc-list">
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <button className="comment-avatar" onClick={() => onOpenUser?.(c.username)}>
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
          placeholder="Donne ton avis sur cette œuvre…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <button className="btn primary sm" type="submit" disabled={!text.trim() || sending}>➤</button>
      </form>
    </section>
  )
}
