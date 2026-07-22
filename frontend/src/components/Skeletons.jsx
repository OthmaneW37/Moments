// Skeletons de chargement, calqués sur la forme réelle des contenus.

export function FeedSkeleton() {
  return (
    <div className="sk-feed">
      <div className="sk sk-avatar" style={{ width: 40, height: 40 }} />
      <div className="sk sk-line" style={{ width: '55%' }} />
      <div className="sk sk-line" style={{ width: '78%', height: 22 }} />
      <div className="sk sk-line" style={{ width: '40%' }} />
    </div>
  )
}

export function GridSkeleton({ count = 6 }) {
  return (
    <div className="sk-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="sk sk-tile" key={i} />
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 6 }) {
  return (
    <div className="sk-list">
      {Array.from({ length: count }).map((_, i) => (
        <div className="sk-row" key={i}>
          <div className="sk sk-avatar" />
          <div className="sk-row-lines">
            <div className="sk sk-line" style={{ width: '45%' }} />
            <div className="sk sk-line" style={{ width: '72%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 3 }) {
  return (
    <div style={{ paddingTop: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div className="sk sk-card" key={i} />
      ))}
    </div>
  )
}
