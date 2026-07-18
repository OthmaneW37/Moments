import { useEffect, useState } from 'react'
import { api, CATEGORY_META, prettyDate } from '../api'
import Memories from './Memories'

export default function Timeline() {
  const [days, setDays] = useState(null)

  useEffect(() => {
    api.timeline().then(setDays).catch(() => setDays([]))
  }, [])

  if (days === null) return <p className="muted center">Chargement…</p>

  if (days.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-emoji">🕰️</span>
        <h3>Ta timeline est vide</h3>
        <p>Ajoute des photos à tes moments dans le calendrier — ils apparaîtront ici, comme un journal visuel de ta vie.</p>
      </div>
    )
  }

  return (
    <div className="timeline">
      <Memories />
      {days.map(({ date, moments }) => (
        <section key={date} className="timeline-day">
          <h2 className="timeline-date">{prettyDate(date)}</h2>
          {moments.map((m) => {
            const meta = CATEGORY_META[m.category] ?? CATEGORY_META.autre
            return (
              <article className="timeline-moment" key={m.id} style={{ '--cat': meta.color }}>
                <div className="timeline-meta">
                  <span className="event-cat">{meta.emoji} {meta.label}</span>
                  {m.start_time && <span className="event-time">{m.start_time}</span>}
                  <strong>{m.title}</strong>
                </div>
                <div className="photo-row large">
                  {m.photos.map((p) => (
                    <a className="thumb" key={p.id} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} alt={m.title} loading="lazy" />
                    </a>
                  ))}
                </div>
              </article>
            )
          })}
        </section>
      ))}
    </div>
  )
}
