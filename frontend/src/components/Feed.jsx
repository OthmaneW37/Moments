import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import ImmersiveFeed from './ImmersiveFeed'
import UserSheet from './UserSheet'
import ContextSheet from './ContextSheet'
import Icon from './Icon'
import { FeedSkeleton } from './Skeletons'
import ErrorState from './ErrorState'

export default function Feed({ onMessage }) {
  const [moments, setMoments] = useState(null)
  const [error, setError] = useState(false)
  const [userSheet, setUserSheet] = useState(null)   // username | null
  const [ctxSheet, setCtxSheet] = useState(null)     // context | null

  const load = useCallback(() => {
    setError(false)
    api.feed().then(setMoments).catch(() => setError(true))
  }, [])

  useEffect(load, [load])

  if (error) return <ErrorState message="Impossible de charger ton feed." onRetry={load} />
  if (moments === null) return <FeedSkeleton />

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
          onMessage={onMessage}
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
