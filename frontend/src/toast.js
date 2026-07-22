// Petit bus d'événements pour les toasts — utilisable partout (composants ou
// non), sans prop-drilling ni contexte. `<ToastHost/>` s'y abonne et affiche.
let listeners = []
let nextId = 1

function emit(type, message, opts = {}) {
  const toast = { id: nextId++, type, message, ...opts }
  listeners.forEach((fn) => fn(toast))
  return toast.id
}

export const toast = {
  success: (message, opts) => emit('success', message, opts),
  error: (message, opts) => emit('error', message, opts),
  info: (message, opts) => emit('info', message, opts),
}

export function subscribeToasts(fn) {
  listeners.push(fn)
  return () => { listeners = listeners.filter((l) => l !== fn) }
}
