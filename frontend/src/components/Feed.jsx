import { useEffect, useState } from 'react'
import { api } from '../api'
import ImmersiveFeed from './ImmersiveFeed'

export default function Feed() {
  const [moments, setMoments] = useState(null)

  useEffect(() => {
    api.feed().then(setMoments).catch(() => setMoments([]))
  }, [])

  if (moments === null) return <p className="muted center ifeed-empty">Chargement…</p>

  if (moments.length === 0) {
    return (
      <div className="empty-state ifeed-empty">
        <span className="empty-emoji">🫂</span>
        <h3>Ton feed est vide</h3>
        <p>
          Ajoute des amis depuis ton profil, capture tes moments en photo —
          et vous verrez la vraie vie des uns et des autres ici.
        </p>
      </div>
    )
  }

  return <ImmersiveFeed moments={moments} />
}
