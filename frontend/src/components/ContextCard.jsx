// Fiche contextuelle affichée sur un moment : œuvre / match / lieu + notes.
// Posée en overlay sur la photo (verre dépoli), façon Letterboxd/Goodreads.
export default function ContextCard({ context }) {
  if (!context?.title) return null
  return (
    <div className="ctx-card">
      {context.image && <img src={context.image} alt="" />}
      <div className="ctx-card-info">
        <strong>{context.title}</strong>
        {context.subtitle && <span>{context.subtitle}</span>}
        <span className="ctx-card-notes">
          {context.my_rating != null && (
            <span className="ctx-card-mine">
              {'★'.repeat(context.my_rating)}{'☆'.repeat(5 - context.my_rating)}
            </span>
          )}
          {context.rating != null && (
            <span className="ctx-card-comm">★ {context.rating} · {context.source}</span>
          )}
        </span>
      </div>
    </div>
  )
}
