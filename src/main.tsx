import { createRoot } from 'react-dom/client'
import App from './App'
import { normalizeLaunchUrl } from './launchContext'
import './game.css'

normalizeLaunchUrl()
createRoot(document.getElementById('root')!).render(<App/>)
async function registerOfflineGame() {
  try {
    await navigator.serviceWorker?.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' })
  } catch { /* Some embedded browsers deny even reading the worker container. */ }
}
if (import.meta.env.PROD && window.isSecureContext) void registerOfflineGame()
