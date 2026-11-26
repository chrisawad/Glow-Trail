import { useEffect, useRef, useState } from 'react'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const nav = navigator as Navigator & {
  standalone?: boolean
  install?: () => Promise<unknown>
  getInstalledRelatedApps?: () => Promise<{platform: string; id?: string; url?: string}[]>
}
const appMode = matchMedia('(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)')
const installKey = 'glow-trail.installed'
const inApp = () => appMode.matches || nav.standalone === true
const workers = import.meta.env.PROD && window.isSecureContext ? navigator.serviceWorker : undefined
const previewBuild = import.meta.env.PROD && !workers
  ? document.querySelector<HTMLMetaElement>('meta[name="glow-trail-build"]')?.content : undefined
let previewRequest: Promise<boolean> | undefined
function checkPreviewVersion() {
  previewRequest ??= fetch(import.meta.env.BASE_URL + 'version.txt', { cache: 'no-store' })
    .then(async response => {
      const revision = (await response.text()).trim()
      if (!response.ok || !/^[0-9a-f]{16}$/.test(revision)) throw new Error('Version unavailable')
      return revision !== previewBuild
    })
    .finally(() => { previewRequest = undefined })
  return previewRequest
}
function installEvidence() {
  try { return localStorage.getItem(installKey) } catch { return null }
}
const remembered = () => ['1', 'listed'].includes(installEvidence() ?? '')

export function usePwa() {
  const [installed, setInstalled] = useState(() => inApp() || remembered())
  const [installCheckedVisit, setInstallCheckedVisit] = useState(-1)
  const [updateCheckedVisit, setUpdateCheckedVisit] = useState(-1)
  const installRevision = useRef(0)
  const eligible = useRef(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [busy, setBusy] = useState(false)
  const [update, setUpdate] = useState(false)
  const [visit, setVisit] = useState(0)
  const [applying, setApplying] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  const [installMessage, setInstallMessage] = useState('')
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const acceptingUpdate = useRef(false)
  const timeout = useRef<number | undefined>(undefined)

  useEffect(() => {
    let away = document.hidden
    function leave() { away = true }
    function resume() {
      if (!away || document.hidden) return
      away = false
      setVisit(previous => previous + 1)
    }
    function visibilityChanged() {
      if (document.hidden) leave()
      else resume()
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    window.addEventListener('pagehide', leave)
    window.addEventListener('pageshow', resume)
    return () => {
      document.removeEventListener('visibilitychange', visibilityChanged)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('pageshow', resume)
    }
  }, [])

  useEffect(() => {
    let active = true
    function reflect(value: boolean, listed = false) {
      try {
        if (value) localStorage.setItem(installKey, listed || installEvidence() === 'listed' ? 'listed' : '1')
        else localStorage.removeItem(installKey)
      } catch { /* Browser storage is optional. */ }
      setInstalled(inApp() || value)
    }
    async function checkInstall() {
      const current = ++installRevision.current
      if (document.readyState !== 'complete') return
      let listed: boolean | undefined
      if (!inApp() && nav.getInstalledRelatedApps && window.isSecureContext) {
        try {
          const apps = await nav.getInstalledRelatedApps()
          const manifest = document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href
          const id = new URL('./', manifest).href
          listed = apps.some(app => app.platform === 'webapp' && (app.url === manifest || app.id === id))
        } catch { /* Use display mode and installation events when the listing is unavailable. */ }
      }
      if (!active || current !== installRevision.current) return
      if (inApp() || listed) {
        eligible.current = false
        setInstallPrompt(null)
        reflect(true, listed)
      } else if (eligible.current || (listed === false && installEvidence() === 'listed')) {
        reflect(false)
      } else setInstalled(remembered())
      setInstallCheckedVisit(visit)
    }
    function capture(event: Event) {
      event.preventDefault()
      if (inApp()) return
      eligible.current = true
      setInstallPrompt(event as InstallPrompt)
      void checkInstall()
    }
    function installedNow() {
      installRevision.current++
      eligible.current = false
      reflect(true)
      setInstallPrompt(null)
      setInstallCheckedVisit(visit)
    }
    const syncStorage = (event: StorageEvent) => {
      if (event.key === installKey) {
        if (remembered()) eligible.current = false
        void checkInstall()
      }
    }
    void checkInstall()
    appMode.addEventListener('change', checkInstall)
    window.addEventListener('load', checkInstall)
    window.addEventListener('focus', checkInstall)
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installedNow)
    window.addEventListener('storage', syncStorage)
    return () => {
      active = false
      appMode.removeEventListener('change', checkInstall)
      window.removeEventListener('load', checkInstall)
      window.removeEventListener('focus', checkInstall)
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', installedNow)
      window.removeEventListener('storage', syncStorage)
    }
  }, [visit])

  useEffect(() => {
    let live = true
    let controller = workers?.controller
    const cleanup: (() => void)[] = []
    const settled = () => { if (live) setUpdateCheckedVisit(visit) }
    function switched() {
      const next = workers?.controller
      if (acceptingUpdate.current) { window.location.reload(); return }
      if (controller && next && next !== controller) setUpdate(true)
      controller = next
    }
    function inspectWaiting() {
      const reg = registration.current
      if (reg?.active && reg.waiting) { setUpdate(true); settled() }
    }
    async function check() {
      if (document.hidden) return
      try {
        if (previewBuild) {
          const available = await checkPreviewVersion()
          if (live) setUpdate(available)
        } else if (registration.current) {
          inspectWaiting()
          await registration.current.update()
        }
      } catch { /* An offline visit can still offer installation. */ }
      if (!live) return
      inspectWaiting()
      if (!registration.current?.installing) settled()
    }
    if (workers) {
      // A first installation has no previous release to offer.
      void workers.getRegistration().then(reg => { if (!reg?.active) settled() }, settled)
      void workers.ready.then(reg => {
        if (!live) return
        registration.current = reg
        const discover = () => {
          const worker = reg.installing
          inspectWaiting()
          if (worker) {
            const stateChanged = () => {
              inspectWaiting()
              if (worker.state === 'redundant' || worker.state === 'activated') settled()
            }
            worker.addEventListener('statechange', stateChanged)
            cleanup.push(() => worker.removeEventListener('statechange', stateChanged))
          }
        }
        discover()
        reg.addEventListener('updatefound', discover)
        cleanup.push(() => reg.removeEventListener('updatefound', discover))
        void check()
      })
      workers.addEventListener('controllerchange', switched)
      window.addEventListener('focus', check)
      const interval = window.setInterval(check, 60000)
      cleanup.push(() => {
        clearInterval(interval)
        workers.removeEventListener('controllerchange', switched)
        window.removeEventListener('focus', check)
      })
    } else void check()
    return () => {
      live = false
      cleanup.forEach(fn => fn())
    }
  }, [visit])
  useEffect(() => () => clearTimeout(timeout.current), [])

  async function install() {
    setInstallMessage('')
    if (busy || installed || !window.isSecureContext || (!installPrompt && !nav.install)) return
    setBusy(true)
    try {
      let accepted = false
      if (nav.install) {
        await nav.install()
        accepted = true
      } else if (installPrompt) {
        setInstallPrompt(null)
        await installPrompt.prompt()
        accepted = (await installPrompt.userChoice).outcome === 'accepted'
      }
      if (accepted) {
        installRevision.current++
        eligible.current = false
        setInstalled(true)
        try { localStorage.setItem(installKey, '1') } catch { /* Storage is optional. */ }
      } else setInstallMessage('Installation canceled. You can keep playing here.')
    } catch (error) {
      setInstallMessage(error instanceof DOMException && error.name === 'AbortError'
        ? 'Installation canceled. You can keep playing here.'
        : 'You can install from your browser menu using the steps below.')
    }
    finally { setBusy(false) }
  }
  function applyUpdate() {
    if (acceptingUpdate.current) return
    const waiting = registration.current?.waiting
    if (!waiting) { window.location.reload(); return }
    acceptingUpdate.current = true
    setApplying(true)
    setUpdateMessage('')
    waiting.postMessage({ type: 'SKIP_WAITING' })
    timeout.current = window.setTimeout(() => {
      acceptingUpdate.current = false
      setApplying(false)
      setUpdateMessage('The update is taking longer than expected. Try again or keep playing.')
    }, 10000)
  }
  async function checkForUpdates() {
    try {
      if (previewBuild) {
        const available = await checkPreviewVersion()
        setUpdate(available)
        setUpdateMessage(available ? 'An update is ready.' : 'You have the latest version.')
        return
      }
      if (!registration.current) { setUpdateMessage('The game is preparing for offline play.'); return }
      await registration.current.update()
      setUpdateMessage(registration.current.installing ? 'Downloading the update…' : registration.current.waiting ? 'An update is ready.' : 'You have the latest version.')
    } catch { setUpdateMessage('Connect to the internet to check for updates.') }
  }
  return {
    installed, offerInstall: installCheckedVisit === visit && !installed,
    checkedForUpdate: updateCheckedVisit === visit,
    install, busy, canInstall: !installed && isSecureContext && !!(installPrompt || nav.install), installMessage,
    update, visit, applying, applyUpdate, checkForUpdates, updateMessage,
  }
}
