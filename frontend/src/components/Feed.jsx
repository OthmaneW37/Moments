import { useEffect, useState } from 'react'
import { api } from '../api'
import MomentCard from './MomentCard'
import Memories from './Memories'

export default function Feed() {
  const [moments, setMoments] = useState(null)

  useEffect(() => {
    api.feed().then(setMoments).catch(() => setMoments([]))
  }, [])

  if (moments === null) return <p className="muted center">Chargement…</p>

  return (
    <div className="feed">
      <Memories />
      {moments.length === 0 ? (
        <div className="empty-state">
          <span className="empty-emoji">🫂</span>
          <h3>Ton feed est vide</h3>
          <p>
            Ajoute des amis depuis ton profil, capture tes moments en photo —
            et vous verrez la vraie vie des uns et des autres ici.
          </p>
        </div>
      ) : (
        moments.map((m) => <MomentCard key={m.id} moment={m} />)
      )}
    </div>
  )
}
