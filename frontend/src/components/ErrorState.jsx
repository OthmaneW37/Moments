// État d'erreur réutilisable, avec bouton "réessayer".
export default function ErrorState({ message = "Une erreur s'est produite.", onRetry }) {
  return (
    <div className="error-state">
      <span style={{ fontSize: 40 }} aria-hidden="true">🌱</span>
      <p>{message}</p>
      {onRetry && <button className="btn primary" onClick={onRetry}>Réessayer</button>}
    </div>
  )
}
