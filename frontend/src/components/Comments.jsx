import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Comments({ eventId, onCountChange }) {
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
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id) {
    await api.deleteComment(id)
    setComments((cs) => cs.filter((c) => c.id !== id))
    onCountChange(-1)
  }

  if (comments === null) return <p className="muted comment-loading">…</p>

  return (
    <div className="comments">
      {comments.map((c) => (
        <div className="comment" key={c.id}>
          <span className="comment-avatar">{c.emoji}</span>
          <div className="comment-body">
            <span className="comment-author">{c.is_me ? 'Toi' : c.display_name}</span>
            <span className="comment-text">{c.text}</span>
          </div>
          {Boolean(c.is_me) && (
            <button className="comment-del" onClick={() => handleDelete(c.id)}>×</button>
          )}
        </div>
      ))}
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
