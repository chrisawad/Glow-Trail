import { useRef, useState } from 'react'
import { Icon, Mark } from './Icons'
import type { usePwa } from './usePwa'
import type { Puzzle } from './puzzles'

type Pwa = ReturnType<typeof usePwa>
export type Panel = 'help' | 'book' | 'reset' | 'share' | 'settings' | 'install' | 'update' | null

function Title({ title, close }: {title: string; close: () => void}) {
  return <div className="dialog-head"><h1 id="dialog-title">{title}</h1><button className="close-button" onClick={close} aria-label={'Close ' + title}><Icon name="close"/></button></div>
}

const gameUrl = 'https://glowtrail.chrisawad.com/'

function useLinkCopy(link: string) {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  async function copy() {
    try { await navigator.clipboard.writeText(link); setMessage('Link copied.') }
    catch { input.current?.focus(); input.current?.select(); setMessage('Use your device’s Copy command to copy the selected link.') }
  }
  return {input, message, setMessage, copy}
}

export function Share({puzzle, close}: {puzzle: Puzzle; close: () => void}) {
  const link = gameUrl + '#puzzle=' + encodeURIComponent(puzzle.id)
  const {input, message, setMessage, copy} = useLinkCopy(link)
  async function share() {
    try { await navigator.share({title: 'Glow Trail', text: 'Play ' + puzzle.name + ' on Glow Trail.', url: link}) }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Use Copy link to share this puzzle.') }
  }
  return <><Title title="Share this puzzle" close={close}/>
    <p className="dialog-copy">Invite someone to play {puzzle.name}.</p>
    <label className="field-label" htmlFor="share-link">Puzzle link</label>
    <input ref={input} className="share-input" id="share-link" readOnly value={link} onFocus={e => e.currentTarget.select()}/>
    <div className="dialog-actions"><button className="action main-action" onClick={copy}>Copy link</button>{typeof navigator.share === 'function' && <button className="action" onClick={share}><Icon name="share"/>Share</button>}</div>
    <p className="dialog-status" role="status">{message}</p>
  </>
}

function InstallSteps() {
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (appleMobile) return <ol className="install-steps">
    <li>Open {window.isSecureContext ? 'Glow Trail' : <a href={gameUrl}>Glow Trail</a>} in Safari and tap <strong>Share</strong>.</li>
    <li>Choose <strong>Add to Home Screen</strong>. Turn on <strong>Open as Web App</strong> if offered, then tap <strong>Add</strong>.</li>
  </ol>
  if (!window.isSecureContext) return <p className="install-steps">To install from this preview, open <a href={gameUrl}>Glow Trail over HTTPS</a>.</p>
  if (/Android/i.test(navigator.userAgent)) return <ol className="install-steps">
    <li>Open Glow Trail in Chrome and tap the <strong>⋮ menu</strong>.</li>
    <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong> and follow the prompt.</li>
  </ol>
  if (/Macintosh/.test(navigator.userAgent) && /Version\/.*Safari\//.test(navigator.userAgent)) return <p className="install-steps">In Safari, choose <strong>File → Add to Dock</strong>, then select <strong>Add</strong>.</p>
  return <p className="install-steps">Open Glow Trail in Chrome or Edge and choose the <strong>install option</strong> in the address bar or browser menu.</p>
}

export function Install({pwa, close}: {pwa: Pwa; close: () => void}) {
  const {input, message, copy} = useLinkCopy(gameUrl)
  return <>
    <div className="install-heading">
      <span className="install-emblem" aria-hidden="true"><Mark/></span>
      <h1 id="dialog-title">Install Glow Trail</h1>
    </div>
    <p id="install-description">{pwa.installed ? 'Glow Trail is installed on this device.' : 'Keep Glow Trail on your home screen and play offline after your first visit.'}</p>
    {!pwa.installed && <>
      {pwa.canInstall || pwa.busy
        ? <button autoFocus className="action main-action install-action" aria-disabled={pwa.busy} onClick={pwa.install}><Icon name="install"/>{pwa.busy ? 'Installing…' : 'Install app'}</button>
        : <>
          <InstallSteps/>
          <details className="install-copy">
            <summary>Copy the game link</summary>
            <div className="install-link-row">
              <input ref={input} className="share-input" aria-label="Game link" readOnly value={gameUrl} onFocus={e => e.currentTarget.select()}/>
              <button className="action" onClick={copy}>Copy link</button>
            </div>
            <p className="dialog-status" role="status">{message}</p>
          </details>
        </>}
      <p className="dialog-status" role="status">{pwa.installMessage}</p>
    </>}
    <button className="action install-dismiss" onClick={close}>{pwa.installed ? 'Back to puzzle' : 'Not now'}</button>
  </>
}

export const trailColors = ['Sunset', 'Meadow', 'Violet'] as const
export type TrailColor = typeof trailColors[number]
const boardSides = ['left', 'right'] as const
export type BoardSide = typeof boardSides[number]

export function Settings({pwa, muted, toggle, color, setColor, boardSide, setBoardSide, open, close}: {
  pwa: Pwa; muted: boolean; toggle: () => void; color: TrailColor; setColor: (color: TrailColor) => void
  boardSide: BoardSide; setBoardSide: (side: BoardSide) => void; open: (panel: Panel) => void; close: () => void
}) {
  return <><Title title="Settings" close={close}/>
    <fieldset className="choice-setting"><legend>Landscape board position</legend><div className="choice-options board-options">{boardSides.map(side => <label key={side}>
      <input type="radio" name="landscape-board-position" checked={boardSide === side} onChange={() => setBoardSide(side)}/>
      {side === 'left' ? 'Left' : 'Right'}
    </label>)}</div></fieldset>
    <fieldset className="choice-setting"><legend>Trail color</legend><div className="choice-options trail-options">{trailColors.map(name => <label key={name}>
      <input type="radio" name="trail-color" checked={color === name} onChange={() => setColor(name)}/>
      <span className={'swatch swatch-' + name.toLowerCase()}/>{name}
    </label>)}</div></fieldset>
    <div className="setting-row"><span>Celebration sound</span><button role="switch" aria-checked={!muted} aria-label="Celebration sound" className="switch" onClick={toggle}><span/></button></div>
    <div className="setting-row"><span>Glow Trail app</span>{pwa.installed ? <strong>Installed</strong> : <button className="setting-button" onClick={() => open('install')}>Install app</button>}</div>
    <div className="setting-row"><span>Game updates</span><button className="setting-button" onClick={() => pwa.update ? open('update') : void pwa.checkForUpdates()}>{pwa.update ? 'Update available' : 'Check now'}</button></div>
    <p role="status" className="dialog-status">{pwa.updateMessage}</p>
  </>
}

export function Update({pwa, close, playing}: {pwa: Pwa; close: () => void; playing: boolean}) {
  return <><div className="dialog-head"><h1 id="dialog-title">Game update ready</h1></div>
    <p className="dialog-copy">{playing ? 'Your trail is saved. Update now to reload and resume this puzzle, or keep playing and update later.' : 'A new version of Glow Trail is ready. Your puzzles and best times are saved when the game reloads.'}</p>
    <div className="dialog-actions"><button autoFocus disabled={pwa.applying} className="action" onClick={close}>Later</button><button disabled={pwa.applying} className="action main-action" onClick={pwa.applyUpdate}>{pwa.applying ? 'Updating…' : 'Update now'}</button></div>
    <p className="dialog-status" role="status">{pwa.updateMessage}</p>
  </>
}
