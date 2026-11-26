import { createRoot } from 'react-dom/client'
import App from './App'
import './game.css'

// The share domain forwards to Pages without query parameters. Browsers carry
// the fragment across that redirect; use the game's usual puzzle URL on arrival.
const entry = new URL(location.href)
if (entry.hash.startsWith('#puzzle=')) {
  const shared = new URLSearchParams(entry.hash.slice(1)).get('puzzle')
  if (shared) {
    entry.searchParams.set('puzzle', shared)
    entry.hash = ''
    history.replaceState(history.state, '', entry)
  }
}

createRoot(document.getElementById('root')!).render(<App/>)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' }).catch(() => {})
}
