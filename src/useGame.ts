import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { launchPuzzle, replaceGameUrl } from './launchContext'
import { PUZZLES, hint, move, type Puzzle } from './puzzles'
import { fixedIds, isGeneratedId, puzzleById } from './puzzleBook'

type Run = { path: number[]; elapsed: number; started: boolean; best: number | null }
type Shelf = { active: string; book: string[]; runs: Record<string, Run> }
const key = 'glow-trail.games.v1'
const bookKey = key + '.book'
const runKey = (id: string) => key + '.' + id

function fresh(puzzle: Puzzle, best: number | null = null): Run {
  return { path: [puzzle.checkpoints[0]], elapsed: 0, started: false, best }
}

const duration = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const finished = (puzzle: Puzzle, path: number[]) => path.length === puzzle.size ** 2 && path.at(-1) === puzzle.checkpoints.at(-1)

function read(key: string) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage is optional. */ }
}

function restore(puzzle: Puzzle, saved: Partial<Run> | null | undefined): Run {
  const run = fresh(puzzle, duration(saved?.best) ? saved.best : null)
  if (!Array.isArray(saved?.path) || saved.path[0] !== run.path[0] || saved.path.length > puzzle.size ** 2) return run
  let path = run.path
  for (const cell of saved.path.slice(1)) {
    const next = move(puzzle, path, cell)
    if (next.length !== path.length + 1) return run
    path = next
  }
  return { ...run, path, elapsed: duration(saved.elapsed) ? saved.elapsed : 0, started: path.length > 1 || saved.started === true }
}

function storedIds(): string[] {
  const ids = read(bookKey)
  return Array.isArray(ids) ? ids.filter(isGeneratedId) : []
}

function loadShelf(): Shelf {
  const data = read(key)
  const book = [...new Set([...fixedIds, ...storedIds()])]
  const shared = launchPuzzle
  if (isGeneratedId(shared) && !book.includes(shared)) book.push(shared)
  const lastActive = typeof data?.active === 'string' && book.includes(data.active) ? data.active : book[0]
  const active = shared && book.includes(shared) ? shared : lastActive
  const runs = Object.fromEntries(PUZZLES.map(p => [p.id, restore(p, data?.runs?.[p.id])]))
  if (isGeneratedId(active)) runs[active] = restore(puzzleById(active), read(runKey(active)))
  return { active, book, runs }
}

function save(shelf: Shelf, previous?: Shelf) {
  const { active, book, runs } = shelf
  if (isGeneratedId(active)) {
    if (!previous || previous.book !== book) {
      write(bookKey, [...new Set([...storedIds(), ...book.filter(isGeneratedId)])])
    }
    if (previous?.runs[active] !== runs[active]) write(runKey(active), runs[active])
  }
  if (previous?.active !== active || !isGeneratedId(active)) {
    // Another tab may have progressed on a different fixed puzzle.
    const saved = read(key)?.runs ?? {}
    const fixedRuns = Object.fromEntries(fixedIds.map(id => [id, id === active ? runs[id] : saved[id] ?? runs[id]]))
    write(key, { active, runs: fixedRuns })
  }
}

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}

export function useGame(paused: boolean, onWin: () => void) {
  const [shelf, setShelf] = useState(loadShelf)
  const live = useRef(shelf)
  const since = useRef<number | null>(null)
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const puzzle = puzzleById(shelf.active)
  const run = shelf.runs[puzzle.id]
  const won = finished(puzzle, run.path)

  const commit = useCallback((next: Shelf) => {
    save(next, live.current)
    live.current = next
    setShelf(next)
  }, [])

  // Opening a shared puzzle adds it to the book even before the first move.
  useEffect(() => {
    if (launchPuzzle === live.current.active) save(live.current)
  }, [])

  const stopClock = useCallback(() => {
    if (since.current === null) return
    const current = live.current
    const active = current.runs[current.active]
    const elapsed = active.elapsed + performance.now() - since.current
    since.current = null
    commit({ ...current, runs: { ...current.runs, [current.active]: { ...active, elapsed } } })
  }, [commit])

  useEffect(() => {
    const sync = () => {
      if (paused || document.hidden || !run.started || won) stopClock()
      else if (since.current === null) since.current = performance.now()
    }
    sync()
    const interval = window.setInterval(() => { if (since.current !== null) tick() }, 250)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pagehide', stopClock)
    window.addEventListener('pageshow', sync)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pagehide', stopClock)
      window.removeEventListener('pageshow', sync)
    }
  }, [puzzle.id, run.started, won, paused, stopClock])

  function changePath(transform: (path: number[]) => number[]) {
    const current = live.current
    const active = current.runs[puzzle.id]
    if (paused || current.active !== puzzle.id || finished(puzzle, active.path)) return false
    const path = transform(active.path)
    if (path === active.path) return false
    const now = performance.now()
    const elapsed = active.elapsed + (since.current === null ? 0 : now - since.current)
    const done = finished(puzzle, path)
    since.current = done || document.hidden ? null : now
    const best = done ? Math.min(active.best ?? Infinity, elapsed) : active.best
    commit({ ...current, runs: { ...current.runs, [puzzle.id]: { path, elapsed, best, started: true } } })
    if (done) onWin()
    return true
  }

  function choose(next: Puzzle) {
    stopClock()
    const url = new URL(location.href)
    if (url.searchParams.has('puzzle')) {
      url.searchParams.set('puzzle', next.id)
      replaceGameUrl(url)
    }
    const current = live.current
    const book = current.book.includes(next.id) ? current.book : [...current.book, next.id]
    const runs = current.runs[next.id] ? current.runs : { ...current.runs, [next.id]: restore(next, read(runKey(next.id))) }
    commit({ active: next.id, book, runs })
  }

  function reset() {
    const current = live.current
    since.current = null
    commit({ ...current, runs: { ...current.runs, [puzzle.id]: fresh(puzzle, current.runs[puzzle.id].best) } })
  }

  function step(cell: number) {
    if (changePath(path => move(puzzle, path, cell))) return ''
    const path = live.current.runs[puzzle.id].path
    const tail = path[path.length - 1]
    if (cell === tail || finished(puzzle, path)) return ''
    if (cell < 0 || cell >= puzzle.size ** 2) return 'You’re at the edge of the board.'
    const distance = Math.abs(cell % puzzle.size - tail % puzzle.size)
      + Math.abs(Math.floor(cell / puzzle.size) - Math.floor(tail / puzzle.size))
    if (distance !== 1) return 'Move one cell up, down, left, or right.'
    if (path.includes(cell)) return 'Retrace from the end to change your path.'
    const remaining = puzzle.checkpoints.findIndex(dot => !path.includes(dot))
    if (cell === puzzle.checkpoints.at(-1) && remaining === puzzle.checkpoints.length - 1)
      return 'Fill the remaining cells before the last dot.'
    if (puzzle.checkpoints.includes(cell)) return 'Connect dot ' + (remaining + 1) + ' next.'
    return ''
  }

  return {
    puzzle, run, book: shelf.book, won, choose, reset,
    recordFor: (id: string): Pick<Run, 'started' | 'best'> => {
      const record = shelf.runs[id] ?? read(runKey(id))
      return { started: record?.started === true, best: duration(record?.best) ? record.best : null }
    },
    elapsed: run.elapsed + (since.current === null ? 0 : performance.now() - since.current),
    step,
    undo: () => changePath(path => path.length > 1 ? path.slice(0, -1) : path),
    takeHint: () => changePath(path => hint(puzzle, path)),
  }
}
