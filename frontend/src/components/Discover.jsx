import { useEffect, useMemo, useState } from 'react'
import { api, CATEGORY_META } from '../api'
import MomentCard from './MomentCard'
import MomentViewer from './MomentViewer'
import UserSheet from './UserSheet'
import ContextSheet from './ContextSheet'
import Icon from './Icon'
import { GridSkeleton } from './Skeletons'

export default function Discover({ onMessage }) {
  const [data, setData] = useState(null)
  const [cat, setCat] = useState(null) // null = tout
  const [viewer, setViewer] = useState(null) // { list, index }
  const [userSheet, setUserSheet] = useState(null)
  const [ctxSheet, setCtxSheet] = useState(null)

  useEffect(() => {
    api.discover().then(setData).catch(() => setData({ city: '', moments: [] }))
  }, [])

  // Seules les catégories réellement présentes deviennent des filtres
  const presentCats = useMemo(() => {
    if (!data) return []
    return [...new Set(data.moments.map((m) => m.category))]
  }, [data])

  if (data === null) return <GridSkeleton count={6} />

  const shown = cat ? data.moments.filter((m) => m.category === cat) : data.moments

  return (
    <div className="feed">
      <div className="discover-head">
        <h1 className="page-title">Découverte</h1>
        <p className="muted">
          {data.moments.length === 0
            ? <>Les moments publics {data.city ? <>autour de <strong>{data.city}</strong></> : 'de la communauté'}</>
            : <><strong>{data.moments.length}</strong> moment{data.moments.length > 1 ? 's' : ''} à découvrir {data.city ? <>près de <strong>{data.city}</strong></> : 'dans la communauté'}</>}
        </p>
      </div>

      {presentCats.length > 1 && (
        <div className="filter-row">
          <button
            className={`filter-chip ${cat === null ? 'active' : ''}`}
            onClick={() => setCat(null)}
          >
            Tout
          </button>
          {presentCats.map((c) => {
            const meta = CATEGORY_META[c] ?? CATEGORY_META.autre
            return (
              <button
                key={c}
                className={`filter-chip ${cat === c ? 'active' : ''}`}
                style={{ '--cat': meta.color }}
                onClick={() => setCat(cat === c ? null : c)}
              >
                <Icon emoji={meta.emoji} size="15" /> {meta.label}
              </button>
            )
          })}
        </div>
      )}

      {data.moments.length === 0 ? (
        <div className="empty-state">
          <Icon emoji="🌍" size="56" className="empty-emoji" />
          <h3>Rien à découvrir pour l'instant</h3>
          <p>
            Passe un de tes moments en <strong>public</strong> (dans le formulaire de création)
            {data.city ? '' : ' et renseigne ta ville dans ton profil'} — les autres pourront le voir ici.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted center">Aucun moment public dans cette catégorie.</p>
      ) : (
        shown.map((m) => (
          <MomentCard
            key={m.id}
            moment={m}
            onOpen={(mm) => setViewer({ list: shown, index: shown.indexOf(mm) })}
            onOpenUser={(u) => { setCtxSheet(null); setUserSheet(u) }}
            onOpenContext={(c) => { setUserSheet(null); setCtxSheet(c) }}
          />
        ))
      )}

      {viewer && (
        <MomentViewer
          moments={viewer.list}
          index={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
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
    </div>
  )
}
