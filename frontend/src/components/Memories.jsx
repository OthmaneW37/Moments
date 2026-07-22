import { useEffect, useState } from 'react'
import { api, CATEGORY_META, mediaUrl } from '../api'

export default function Memories() {
  const [memories, setMemories] = useState([])

  useEffect(() => {
    api.memories().then(setMemories).catch(() => setMemories([]))
  }, [])

  if (memories.length === 0) return null

  return (
    <div className="memories">
      <h2 className="memories-title">✨ Souvenirs d'un tel jour</h2>
      <div className="memories-row">
        {memories.map((m) => {
          const meta = CATEGORY_META[m.category] ?? CATEGORY_META.autre
          const photo = m.photos[0]
          return (
            <div className="memory-card" key={m.id} style={{ '--cat': meta.color }}>
              {photo && <img src={mediaUrl(photo.url)} alt={m.title} loading="lazy" />}
              <div className="memory-overlay">
                <span className="memory-label">{m.memory_label}</span>
                <span className="memory-title">{meta.emoji} {m.title}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
