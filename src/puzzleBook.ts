import { PUZZLES, type Puzzle } from './puzzles'
import { generatePuzzle, generatedId } from './randomPuzzle'

const cache = new Map(PUZZLES.map(puzzle => [puzzle.id, puzzle]))
export const fixedIds = PUZZLES.map(puzzle => puzzle.id)
export const isGeneratedId = (id: unknown): id is string =>
  typeof id === 'string' && /^random-v1-[0-9a-f]{8}$/.test(id)

export function puzzleById(id: string): Puzzle {
  const cached = cache.get(id)
  if (cached) return cached
  if (!isGeneratedId(id)) throw new Error('Unknown puzzle')
  const puzzle = generatePuzzle(parseInt(id.slice(-8), 16))
  cache.set(id, puzzle)
  return puzzle
}

export function nextPuzzle(book: string[], index: number): Puzzle {
  if (index + 1 < book.length) return puzzleById(book[index + 1])
  let seed = crypto.getRandomValues(new Uint32Array(1))[0]
  const used = new Set(book)
  while (used.has(generatedId(seed))) seed = (seed + 1) >>> 0
  return puzzleById(generatedId(seed))
}
