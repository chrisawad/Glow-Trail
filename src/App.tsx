import { useEffect, useRef, useState } from 'react'
import Board from './Board'
import { Icon, Mark } from './Icons'
import type { Puzzle } from './puzzles'
import { nextPuzzle, puzzleById } from './puzzleBook'
import { formatTime, useGame } from './useGame'
import { useCelebration } from './useCelebration'
import { usePwa } from './usePwa'
import { embeddedLaunch } from './launchContext'
import { Install, Settings, Share, Update, trailColors, type BoardSide, type TrailColor, type Panel } from './GameDialogs'

function NightSky() {
  return <svg className="sky" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
    <defs><pattern id="sky-dust" width="113" height="105" patternUnits="userSpaceOnUse">
      <circle cx="27" cy="29" r="1" fill="#c3a7dc" opacity=".3"/><circle cx="88" cy="76" r=".8" fill="#d7c5e3" opacity=".22"/>
    </pattern></defs>
    <rect width="1440" height="900" fill="url(#sky-dust)"/>
    <g fill="none" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" opacity=".48">
      <path stroke="#72588b" d="M-35 244h91q26 0 26 26v106q0 26 24 26h34"/>
      <path stroke="#836588" d="M1460 100h-111q-30 0-30 30v77q0 30-30 30h-38"/>
      <path stroke="#705a85" d="M-24 766h116q22 0 22-22v-67q0-22 22-22h34"/>
      <path stroke="#80618e" d="M1472 697h-114q-24 0-24-24v-70q0-24-24-24h-27"/>
    </g>
    <g fill="#977eac" opacity=".5"><circle cx="140" cy="402" r="4"/><circle cx="1250" cy="237" r="4"/><circle cx="170" cy="655" r="3.5"/><circle cx="1283" cy="579" r="3.5"/></g>
    <g fill="#cfab92" opacity=".6"><path d="m175 171 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="m1265 398 1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/></g>
  </svg>
}

function LessonArt({ fill = false }: {fill?: boolean}) {
  return <svg className={'lesson-art ' + (fill ? 'mint-art' : 'peach-art')} viewBox="0 0 90 62" aria-hidden="true">
    {fill ? <>
      <rect x="23" y="9" width="44" height="44" rx="5" fill="#E2F1CE" stroke="#6D9B86" strokeWidth="2"/>
      <path d="M38 10v42m14-42v42M24 24h42M24 38h42" fill="none" stroke="#9EBBA0"/>
      <path d="M31 17h28v14H31v14h28" fill="none" stroke="#286F62" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="31" cy="17" r="2.1" fill="#F4F8DD"/><circle cx="59" cy="45" r="2.1" fill="#F4F8DD"/>
    </> : <>
      <path d="M15 40h19q5 0 5-5v-9q0-5 5-5h30" fill="none" stroke="#D26D74" strokeWidth="7" strokeLinecap="round"/>
      {[[15,40],[43,22],[74,21]].map(([x,y],i) => <g key={x}><circle cx={x} cy={y} r="9.2" fill="#47344A"/><text x={x} y={y+.4} textAnchor="middle" dominantBaseline="central" fill="#FFF8EF" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="12">{i+1}</text></g>)}
    </>}
  </svg>
}

function Instructions() {
  return <>
    <div className="lesson"><LessonArt/><div><h3>Connect in order</h3><p>Start at 1 and visit each numbered dot in sequence.</p></div></div>
    <div className="lesson"><LessonArt fill/><div><h3>Fill every cell</h3><p>Go up, down, left or right. Use each cell exactly once.</p></div></div>
    <p className="guide-tip">Drag to draw, tap a neighboring cell, or use the arrow keys.</p>
  </>
}

function Progress({ label, shortLabel, value, total, variant }: {label: string; shortLabel: string; value: number; total: number; variant: string}) {
  return <div className={'progress-line ' + variant}>
    <div className="progress-info"><span className="progress-label">{label}</span><span className="progress-short">{shortLabel}</span><span className="fraction"><strong>{value}</strong><span> / {total}</span></span></div>
    <progress value={value} max={total} aria-label={label}/>
  </div>
}

function Miniature({ puzzle }: {puzzle: Puzzle}) {
  return <svg className="miniature" viewBox={'0 0 ' + puzzle.size + ' ' + puzzle.size} aria-hidden="true">
    {puzzle.checkpoints.map((cell, index) => <circle key={cell} cx={cell % puzzle.size + .5} cy={Math.floor(cell / puzzle.size) + .5} r={index === 0 ? .47 : .28} fill={index === 0 ? '#F05C86' : '#534461'}/>)}
  </svg>
}

const pageSize = 16

export default function App() {
  const [modal, setModal] = useState<Panel>(null)
  const [bookPage, setBookPage] = useState(0)
  const [message, setMessage] = useState('')
  const [color, setTrailColor] = useState<TrailColor>(() => {
    try { return trailColors.find(name => name === localStorage.getItem('glow-trail.color')) ?? 'Sunset' }
    catch { return 'Sunset' }
  })
  const [boardSide, setBoardSide] = useState<BoardSide>(() => {
    try { return localStorage.getItem('glow-trail.board-side') === 'left' ? 'left' : 'right' }
    catch { return 'right' }
  })
  const dialog = useRef<HTMLDialogElement>(null)
  const celebration = useCelebration()
  const pwa = usePwa()
  const offeredUpdateVisit = useRef<number | null>(null)
  const offeredInstallVisit = useRef<number | null>(null)
  const automaticInstall = useRef(false)
  const game = useGame(modal !== null, celebration.play)
  const { puzzle, run, won } = game
  const index = game.book.indexOf(puzzle.id)
  const number = String(index + 1).padStart(2, '0')
  const visited = puzzle.checkpoints.filter(cell => run.path.includes(cell)).length
  const last = visited === puzzle.checkpoints.length
  useEffect(() => {
    const panel = dialog.current
    if (!modal || !panel) return
    if (!panel.open) panel.showModal()
    panel.scrollTop = 0
  }, [modal])
  useEffect(() => {
    if (document.hidden) return
    if (modal !== 'install') automaticInstall.current = false
    if (modal === 'update') {
      offeredUpdateVisit.current = pwa.visit
      if (!embeddedLaunch) offeredInstallVisit.current = pwa.visit
      return
    }
    if (modal === 'install') {
      if (automaticInstall.current && pwa.installed) {
        dialog.current?.close()
        setModal(null)
        return
      }
      offeredInstallVisit.current = pwa.visit
    }
    if (modal && !(modal === 'install' && automaticInstall.current && !pwa.busy && !embeddedLaunch)) return
    const offerHelp = !modal && pwa.offerInstall && offeredInstallVisit.current !== pwa.visit
    if (offerHelp && (embeddedLaunch || (pwa.checkedForUpdate && !pwa.update))) {
      automaticInstall.current = true
      setModal('install')
    } else if (pwa.update && offeredUpdateVisit.current !== pwa.visit) {
      // For embedded players, let their installation check finish (or time out) first.
      if (!embeddedLaunch || pwa.offerInstall || pwa.installed) setModal('update')
    }
  }, [pwa.update, pwa.checkedForUpdate, pwa.offerInstall, pwa.installed, pwa.busy, pwa.visit, modal])
  const close = () => {
    dialog.current?.close()
    setModal(null)
  }
  function chooseColor(next: TrailColor) {
    setTrailColor(next)
    try { localStorage.setItem('glow-trail.color', next) } catch { /* Storage is optional. */ }
  }
  function chooseBoardSide(next: BoardSide) {
    setBoardSide(next)
    try { localStorage.setItem('glow-trail.board-side', next) } catch { /* Storage is optional. */ }
  }
  function select(p: Puzzle) {
    celebration.stop()
    game.choose(p)
    setMessage('')
    close()
  }
  function playNext() {
    select(nextPuzzle(game.book, index))
  }
  function openBook() {
    setBookPage(Math.floor(index / pageSize))
    setModal('book')
  }
  function hint() {
    const divergent = run.path.some((cell, i) => cell !== puzzle.solution[i])
    if (game.takeHint()) setMessage(divergent ? 'Hint retraced one step toward the solution.' : 'Hint added one step to your trail.')
  }
  return <>
    <NightSky/>
    <header className="topbar">
      <div className="nav-inner">
        <div className="brand"><Mark/><span>Glow <b>Trail</b></span></div>
        <nav className="nav-tools" aria-label="Game controls">
          <button className="book-button" aria-label="Puzzle book" title="Puzzle book" onClick={openBook}><span className="landscape-book-mark"><Mark/></span><Icon name="book"/><span>Puzzle book</span></button>
          <button className="nav-icon landscape-help" aria-label="How to play" title="How to play" onClick={() => setModal('help')}><Icon name="help"/></button>
          {pwa.offerInstall && <button className="nav-icon nav-install" aria-label="Install Glow Trail" title="Install Glow Trail" onClick={() => setModal('install')}><Icon name="install"/></button>}
          <button className="nav-icon" aria-label="Share puzzle" title="Share puzzle" onClick={() => setModal('share')}><Icon name="share"/></button>
          <button className={'nav-icon' + (pwa.update ? ' has-update' : '')} aria-label="Settings" title="Settings" onClick={() => setModal('settings')}><Icon name="settings"/></button>
        </nav>
      </div>
    </header>
    <main className="game-page" data-board-side={boardSide}>
      <div className="game-heading">
        <div>
          <div className="puzzle-meta"><span className="puzzle-id"><span className="little-dash"/>Puzzle {number}</span><span className="size-tag"><Icon name="grid" size={13}/>{puzzle.size} × {puzzle.size}</span></div>
          <h1>{puzzle.name}</h1>
        </div>
        <div className="timer"><span className="timer-icon"><Icon name="clock" size={24}/></span><div><span className="timer-label">Time</span><strong aria-label={'Elapsed time ' + formatTime(game.elapsed)}>{formatTime(game.elapsed)}</strong></div></div>
      </div>
      <div className="workspace">
        <section className="play-area" aria-label="Play puzzle">
          <div className={'board-frame' + (won ? ' is-won' : '')} data-trail={color}>
            <Board key={puzzle.id} puzzle={puzzle} path={run.path} won={won} onMove={cell => {
              const feedback = game.step(cell)
              setMessage(feedback)
              return feedback === ''
            }}/>
          </div>
          <div className="actions">
            {won ? <>
              <button className="action" onClick={() => setModal('reset')}><Icon name="reset"/>Replay</button>
              <button className="action main-action next" onClick={playNext}><Icon name="flag"/>Next puzzle</button>
            </> : <>
              <button className="action" disabled={run.path.length < 2} onClick={() => { game.undo(); setMessage('Last step undone.') }}><Icon name="undo"/>Undo</button>
              <button className="action main-action" onClick={hint}><Icon name="hint"/>Hint</button>
              <button className="action" disabled={!run.started} onClick={() => setModal('reset')}><Icon name="reset"/>Reset</button>
            </>}
          </div>
          <p className="action-feedback" role="status">
            <span className="landscape-tip-icon"><Icon name={won ? 'flag' : 'hint'}/></span>
            {message && !won ? <span>{message}</span> : <span className="landscape-tip-default">
              {won ? 'Trail complete. Play again or try the next puzzle.' : visited + 1 === puzzle.checkpoints.length
                ? 'Fill every remaining cell before reaching the last dot.' : 'Connect the dots in order and fill every cell.'}
            </span>}
          </p>
        </section>
        <aside className="sidebar" aria-label="Puzzle information">
          <section className={'panel tracker' + (won ? ' success' : '')}>
            <div className="panel-title"><span className="panel-icon tracker-icon"><Icon name={won ? 'flag' : 'route'} size={22}/></span><h2>{won ? 'Trail complete!' : 'Trail tracker'}</h2></div>
            <Progress label="Dots connected" shortLabel="Dots" value={visited} total={puzzle.checkpoints.length} variant="coral"/>
            <Progress label="Cells filled" shortLabel="Cells" value={run.path.length} total={puzzle.size ** 2} variant="mint"/>
            <div className="next-dot" aria-live="polite" aria-atomic="true">{last ? <><span className="next-marker"><Icon name="check" size={16}/></span><span>Finished in <strong>{formatTime(run.elapsed)}</strong></span></> : <><span className="next-marker">{visited + 1}</span><span>Next dot <strong>{visited + 1}</strong></span></>}</div>
          </section>
          <section className="panel guide">
            <div className="panel-title"><span className="panel-icon guide-icon"><Icon name="book" size={21}/></span><h2>How to play</h2></div>
            <Instructions/>
          </section>
        </aside>
      </div>
    </main>
    <canvas ref={celebration.canvas} className="win-confetti" aria-hidden="true"/>
    <dialog ref={dialog} className={modal ? modal + '-dialog' : undefined} aria-labelledby="dialog-title"
      aria-describedby={modal === 'reset' ? 'reset-description' : modal === 'install' ? 'install-description' : undefined}
      onCancel={event => { event.preventDefault(); if (!pwa.applying) close() }}>
      {modal === 'help' && <>
        <div className="dialog-head"><h1 id="dialog-title">How to play</h1><button className="close-button" aria-label="Close How to play" onClick={close} autoFocus><Icon name="close"/></button></div>
        <div className="help-instructions"><Instructions/></div>
      </>}
      {modal === 'share' && <Share puzzle={puzzle} close={close}/>}
      {modal === 'settings' && <Settings pwa={pwa} muted={celebration.muted} toggle={celebration.toggleSound}
        color={color} setColor={chooseColor} boardSide={boardSide} setBoardSide={chooseBoardSide} open={setModal} close={close}/>}
      {modal === 'update' && <Update pwa={pwa} playing={run.started && !won} close={close}/>}
      {modal === 'install' && <Install pwa={{...pwa, install: () => {
        automaticInstall.current = false
        return pwa.install()
      }}} close={close}/>}
      {modal === 'book' && <>
        <div className="dialog-head"><h1 id="dialog-title">Puzzle book</h1><button aria-label="Close puzzle book" className="close-button" onClick={close} autoFocus><Icon name="close"/></button></div>
        {game.book.length > pageSize && <nav className="book-pages" aria-label="Puzzle book pages">
          <button className="action" disabled={bookPage === 0} onClick={() => setBookPage(bookPage - 1)}>Previous</button>
          <span aria-live="polite">Page {bookPage + 1} of {Math.ceil(game.book.length / pageSize)}</span>
          <button className="action" disabled={(bookPage + 1) * pageSize >= game.book.length} onClick={() => setBookPage(bookPage + 1)}>Next</button>
        </nav>}
        <div className="puzzle-list">{game.book.slice(bookPage * pageSize, (bookPage + 1) * pageSize).map((id,i) => {
          const p = puzzleById(id)
          const record = game.recordFor(id)
          const state = record.best !== null ? 'Best ' + formatTime(record.best) : record.started ? 'In progress' : 'Ready to play'
          return <button key={p.id} className={'puzzle-choice' + (p.id === puzzle.id ? ' chosen' : '')} onClick={() => select(p)}>
            <Miniature puzzle={p}/><span><small>Puzzle {String(bookPage * pageSize + i + 1).padStart(2,'0')}</small><strong>{p.name}</strong><span>{state}</span></span>
            {p.id === puzzle.id && <span className="current-tag">Current</span>}
          </button>
        })}</div>
      </>}
      {modal === 'reset' && <div className="reset-card">
        <div className="dialog-head">
          <span className="reset-symbol"><Icon name="reset" size={23}/></span>
          <h1 id="dialog-title">{won ? 'Play again?' : 'Reset this trail?'}</h1>
        </div>
        <p className="reset-copy" id="reset-description">
          {won ? <>Start <strong>{puzzle.name}</strong> again at dot 1. Your best time is saved.</>
            : <>Resetting <strong>{puzzle.name}</strong> clears your trail and restarts the timer at 0:00.</>}
        </p>
        <div className="reset-actions">
          <button className={'action' + (won ? '' : ' main-action')} autoFocus onClick={close}>{won ? 'Keep result' : 'Keep playing'}</button>
          <button className={'action ' + (won ? 'main-action' : 'reset-confirm')} onClick={() => { celebration.stop(); game.reset(); setMessage(''); close() }}>{won ? 'Play again' : 'Reset trail'}</button>
        </div>
      </div>}
    </dialog>
  </>
}
