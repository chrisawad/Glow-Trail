import { useLayoutEffect, useRef, type PointerEvent } from 'react'
import type { Puzzle } from './puzzles'

type Props = {
  puzzle: Puzzle
  path: number[]
  won: boolean
  onMove: (cell: number) => boolean
}
type Point = { x: number; y: number }

function pathColor(index: number, totalCells: number) {
  const progress = index / (totalCells - 1)
  const stops = ['var(--trail-start, #FFAF64)', 'var(--trail-middle, #FC7290)', 'var(--trail-end, #8A62DD)']
  const half = progress < .5 ? 0 : 1
  const amount = Math.round((progress * 2 - half) * 100)
  return 'color-mix(in srgb, ' + stops[half] + ' ' + (100 - amount) + '%, ' + stops[half + 1] + ')'
}

export default function Board({ puzzle, path, onMove, won }: Props) {
  const { size, checkpoints } = puzzle
  const bounds = size * 100
  const head = path[path.length - 1]
  const tip = useRef(head)
  const lastSample = useRef<Point | null>(null)
  const nextLabel = checkpoints.findIndex(cell => !path.includes(cell))
  const x = (cell: number) => (cell % size + .5) * 100
  const y = (cell: number) => (Math.floor(cell / size) + .5) * 100
  const location = (cell: number) => 'row ' + (Math.floor(cell / size) + 1) + ', column ' + (cell % size + 1)

  useLayoutEffect(() => { tip.current = head }, [head])
  function visit(cell: number) {
    if (cell === tip.current) return true
    if (!onMove(cell)) return false
    tip.current = cell
    return true
  }
  function cellAt(point: Point) {
    if (point.x < 0 || point.y < 0 || point.x >= size || point.y >= size) return -1
    return Math.floor(point.y) * size + Math.floor(point.x)
  }
  function position(clientX: number, clientY: number, rect: DOMRect): Point {
    return { x: (clientX - rect.left) * size / rect.width, y: (clientY - rect.top) * size / rect.height }
  }
  function drawSample(point: Point) {
    const previous = lastSample.current
    lastSample.current = point
    if (!previous || cellAt(previous) !== tip.current) return
    // Sample the space between browser events so a fast swipe still visits every crossed cell.
    const dx = point.x - previous.x
    const dy = point.y - previous.y
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 4)
    for (let i = 1; i <= steps; i++) {
      const cell = cellAt({ x: previous.x + dx * i / steps, y: previous.y + dy * i / steps })
      if (cell < 0 || !visit(cell)) break
    }
  }
  function draw(event: PointerEvent<SVGSVGElement>) {
    if (won || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const samples = event.nativeEvent.getCoalescedEvents?.() || []
    for (const sample of samples) drawSample(position(sample.clientX, sample.clientY, rect))
    drawSample(position(event.clientX, event.clientY, rect))
  }
  function start(event: PointerEvent<SVGSVGElement>) {
    if (won || !event.isPrimary || event.button !== 0) return
    event.currentTarget.focus({ preventScroll: true })
    const point = position(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
    const cell = cellAt(point)
    if (cell < 0 || !visit(cell)) return
    lastSample.current = point
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function end(event: PointerEvent<SVGSVGElement>) {
    draw(event)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const segments = path.slice(1).map((to, index) => ({ from: path[index], to, index }))

  return <>
    <svg className="trail-board" role="application" tabIndex={0}
      aria-label={puzzle.name + ', ' + size + ' by ' + size + ' puzzle board'}
      aria-describedby="board-position" viewBox={'0 0 ' + bounds + ' ' + bounds}
      onPointerDown={start} onPointerMove={draw} onPointerUp={end}
      onLostPointerCapture={() => { lastSample.current = null }}
      onPointerCancel={() => { lastSample.current = null }}
      onKeyDown={event => {
        const directions: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }
        if (won || !(event.key in directions)) return
        event.preventDefault()
        visit(tip.current + directions[event.key])
      }}>
      <defs>
        <pattern id="cell-grid" patternUnits="userSpaceOnUse" width="100" height="100">
          <path d="M100 0H0V100" fill="none" stroke="#d6c7b4" strokeWidth="2"/>
          <circle cx="50" cy="50" r="2.3" fill="#dccbb5"/>
        </pattern>
        {segments.map(({from,to,index}) =>
          <linearGradient key={index} id={'ribbon-' + index} gradientUnits="userSpaceOnUse" x1={x(from)} y1={y(from)} x2={x(to)} y2={y(to)}>
            <stop stopColor={pathColor(index, size ** 2)}/><stop offset="1" stopColor={pathColor(index + 1, size ** 2)}/>
          </linearGradient>
        )}
      </defs>
      <rect width={bounds} height={bounds} fill="#fff8e6"/>
      <rect className="board-grid" width={bounds} height={bounds} fill="url(#cell-grid)" opacity={won ? 0 : 1}/>
      {segments.map(({from,to,index}) =>
        <line key={index} x1={x(from)} y1={y(from)} x2={x(to)} y2={y(to)}
          stroke={'url(#ribbon-' + index + ')'} strokeWidth="60" strokeLinecap="round"/>
      )}
      {!won && !checkpoints.includes(head) && <circle cx={x(head)} cy={y(head)} r="8" fill="#fff8e6" stroke="#534352" strokeWidth="2"/>}
      {checkpoints.map((cell,index) => {
        const startDot = index === 0 && path.length === 1
        return <g key={cell} aria-hidden="true">
          {startDot && <circle cx={x(cell)} cy={y(cell)} r="37" fill="none" stroke="#e7ad8e" strokeWidth="2.5" strokeDasharray="4 5"/>}
          <circle cx={x(cell)} cy={y(cell)} r={startDot ? 30 : 29} fill={startDot ? '#f59384' : '#302741'}/>
          <text x={x(cell)} y={y(cell)+1} fontSize="30" fontWeight="560" textAnchor="middle"
            dominantBaseline="central" fontFamily="Fredoka,sans-serif" fill={startDot ? '#302741' : '#fff8ef'}>{index+1}</text>
        </g>
      })}
    </svg>
    <span id="board-position" className="visually-hidden" aria-live="polite">
      {won ? 'Trail complete.' : 'Use the arrow keys. Trail ends at ' + location(head) + '. Next is dot ' + (nextLabel + 1) + ' at ' + location(checkpoints[nextLabel]) + '.'}
    </span>
  </>
}
