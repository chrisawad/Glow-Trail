const entry = new URL(location.href)
const fragment = new URLSearchParams(entry.hash.slice(1))
const dashboardMarker = fragment.getAll('from').includes('games-dashboard')
const referrer = document.referrer ? new URL(document.referrer) : null
const dashboardReferrer = referrer?.hostname === 'games.chrisawad.com'
  || (referrer?.hostname === 'chrisawad.github.io' && /^\/Games-Dashboard(?:\/|$)/i.test(referrer.pathname))

const ua = navigator.userAgent
export const appleMobile = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const android = /Android/i.test(ua)
const androidAppReferrer = android && referrer?.protocol === 'android-app:'
  && !referrer.hostname.startsWith('org.chromium.webapk.')
const externalReferrer = dashboardReferrer || androidAppReferrer
const externalEntry = dashboardMarker || externalReferrer || history.state?.glowTrailExternalEntry === true
const namedApp = /FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|\bLine\/|LinkedInApp|GSA\/|Snapchat|TikTok|BytedanceWebview|Pinterest|Twitter for/i.test(ua)
// iOS web views often omit Safari's product token. Home Screen web apps can
// omit it too, so use that heuristic only outside standalone mode.
const appleWebView = appleMobile && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)
  && (navigator as Navigator & {standalone?: boolean}).standalone !== true
  && !matchMedia('(display-mode: standalone)').matches
const androidWebView = android && /;\s*wv\b|Version\/4\.0.*Chrome\//i.test(ua)

export const embeddedLaunch = externalEntry || window.top !== window.self || appleWebView || androidWebView
  || ((appleMobile || android) && namedApp)

const fragmentPuzzle = fragment.get('puzzle')
export const launchPuzzle = fragmentPuzzle || entry.searchParams.get('puzzle')

export function replaceGameUrl(url: URL) {
  try {
    // This history entry survives reload; a clean navigation starts independently.
    const state = externalEntry ? {...history.state, glowTrailExternalEntry: true} : history.state
    history.replaceState(state, '', url)
  } catch { /* Sandboxed frames may play the puzzle without rewriting their URL. */ }
}

export function normalizeLaunchUrl() {
  // The forwarding domain carries fragments to Pages. Consume just our fields
  // so a combined dashboard / shared puzzle link still opens the chosen board.
  if (fragmentPuzzle) {
    entry.searchParams.set('puzzle', fragmentPuzzle)
    fragment.delete('puzzle')
  }
  if (dashboardMarker) fragment.delete('from', 'games-dashboard')
  if (fragmentPuzzle || dashboardMarker) entry.hash = fragment.toString()
  if (fragmentPuzzle || dashboardMarker || (externalReferrer && !history.state?.glowTrailExternalEntry)) {
    replaceGameUrl(entry)
  }
}
