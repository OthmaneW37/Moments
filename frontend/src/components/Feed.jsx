import { useEffect, useState } from 'react'
import { api } from '../api'
import ImmersiveFeed from './ImmersiveFeed'
import UserSheet from './UserSheet'
import ContextSheet from './ContextSheet'
import Icon from './Icon'

export default function Feed() {
  const [moments, setMoments] = useState(null)
  const [userSheet, setUserSheet] = useState(null)   // username | null
  const [ctxSheet, setCtxSheet] = useState(null)     // context | null

  useEffect(() => {
    api.feed().then(setMoments).catch(() => setMoments([]))
  }, [])

  if (moments === null) return <p className="muted center ifeed-empty">Chargement…</p>

  if (moments.length === 0) {
    return (
      <div className="empty-state ifeed-empty">
        <Icon emoji="🫂" size="56" className="empty-emoji" />
        <h3>Ton feed est vide</h3>
        <p>
          Abonne-toi à des comptes depuis la Découverte ou ton profil,
          capture tes moments en photo — et vous verrez la vraie vie
          des uns et des autres ici.
        </p>
      </div>
    )
  }

  return (
    <>
      <ImmersiveFeed
        moments={moments}
        onOpenUser={(u) => { setCtxSheet(null); setUserSheet(u) }}
        onOpenContext={(c) => { setUserSheet(null); setCtxSheet(c) }}
      />
      {userSheet && (
        <UserSheet
          username={userSheet}
          onClose={() => setUserSheet(null)}
          onOpenContext={(c) => { setUserSheet(null); setCtxSheet(c) }}
          onOpenUser={(u) => setUserSheet(u)}
        />
      )}
      {ctxSheet && (
        <ContextSheet
          context={ctxSheet}
          onClose={() => setCtxSheet(null)}
          onOpenUser={(u) => { setCtxSheet(null); setUserSheet(u) }}
        />
      )}
    </>
  )
}
