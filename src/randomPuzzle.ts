import type { Puzzle } from './puzzles'

const size = 7
const cells = size * size
const neighbors = Array.from({ length: cells }, (_, cell) => {
  const row = Math.floor(cell / size)
  const col = cell % size
  const adjacent: number[] = []
  if (row > 0) adjacent.push(cell - size)
  if (col > 0) adjacent.push(cell - 1)
  if (col < size - 1) adjacent.push(cell + 1)
  if (row < size - 1) adjacent.push(cell + size)
  return adjacent
})

// The seed and this algorithm are part of the v1 share-link format.
function randomSource(seed: number) {
  let state = seed >>> 0
  return (limit: number) => {
    state = (state + 0x6d2b79f5) >>> 0
    let bits = Math.imul(state ^ (state >>> 15), state | 1)
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61)
    return Math.floor(((bits ^ (bits >>> 14)) >>> 0) / 0x100000000 * limit)
  }
}

type Random = ReturnType<typeof randomSource>

function makeRoute(random: Random) {
  let path = Array.from({ length: cells }, (_, cell) =>
    Math.floor(cell / size) % 2 === 0 ? cell : cell + size - 1 - 2 * (cell % size))

  // Connect one endpoint to a neighbor further along the trail. Reversing the
  // intervening prefix opens the resulting loop into another full-grid path.
  for (let turn = 0; turn < 196; turn++) {
    if (random(2)) path.reverse()
    const choices = neighbors[path[0]].filter(cell => cell !== path[1])
    const pivot = path.indexOf(choices[random(choices.length)])
    path = path.slice(0, pivot).reverse().concat(path.slice(pivot))
  }
  return path
}

function hasUniqueSolution(route: number[], checkpoints: number[]) {
  const rank = new Uint8Array(cells)
  checkpoints.forEach((cell, index) => { rank[cell] = index + 1 })
  const last = route[cells - 1]
  const used = new Uint8Array(cells)
  used[route[0]] = 1
  const exits = Uint8Array.from(neighbors, options => options.length)
  let budget = 3500

  function canExcludeAlternatives(head: number, length: number, nextRank: number, diverged: boolean): boolean {
    // If the budget is exhausted, retain the clue rather than accepting an unproven board.
    if (--budget < 0) return false
    if (length === cells) return !diverged

    // Once the path leaves head it cannot return. A nonterminal square with
    // only one remaining exit must be entered now, or it would strand the trail.
    let forced = -1
    let possible = true
    for (const cell of neighbors[head]) {
      exits[cell]--
      if (used[cell] || exits[cell] >= (cell === last ? 1 : 2)) continue
      if (forced >= 0) possible = false
      forced = cell
    }
    let unique = true
    if (possible) {
      for (const cell of neighbors[head]) {
        if (used[cell] || (forced >= 0 && forced !== cell)) continue
        if ((rank[cell] && rank[cell] !== nextRank) || (cell === last && length + 1 !== cells)) continue
        used[cell] = 1
        unique = canExcludeAlternatives(cell, length + 1, nextRank + Number(rank[cell] !== 0), diverged || cell !== route[length])
        used[cell] = 0
        if (!unique) break
      }
    }
    for (const cell of neighbors[head]) exits[cell]++
    return unique
  }

  return canExcludeAlternatives(route[0], 1, 2, false)
}

function makeCheckpoints(route: number[], random: Random) {
  const target = 13 + random(4)
  // Prefer evenly spaced anchors with some jitter so the route has room to unwind.
  const anchors = new Set<number>()
  for (let i = 1; i < target - 1; i++) {
    anchors.add(Math.round(i * (cells - 1) / (target - 1)) + random(3) - 1)
  }
  const candidates = route.slice(1, -1).map((cell, i) => ({
    cell, priority: random(65536) + (anchors.has(i + 1) ? 65536 : 0),
  })).sort((a, b) => a.priority - b.priority)

  let checkpoints = [...route]
  for (const { cell } of candidates) {
    if (checkpoints.length <= target) break
    const trial = checkpoints.filter(clue => clue !== cell)
    if (hasUniqueSolution(route, trial)) checkpoints = trial
  }
  return checkpoints
}

const colors = ['Amber', 'Apricot', 'Copper', 'Golden', 'Indigo', 'Jade', 'Juniper', 'Lilac', 'Lunar', 'Misty', 'Opal', 'Orchid', 'Peach', 'Pearl', 'Ruby', 'Silver']
const places = ['Brook', 'Canopy', 'Canyon', 'Cascade', 'Cove', 'Crossing', 'Glade', 'Glen', 'Grove', 'Hollow', 'Lagoon', 'Meadow', 'Orchard', 'Ridge', 'Springs', 'Summit']

export const generatedId = (seed: number) => 'random-v1-' + (seed >>> 0).toString(16).padStart(8, '0')

export function generatePuzzle(seed: number): Puzzle {
  const random = randomSource(seed)
  const solution = makeRoute(random)
  const checkpoints = makeCheckpoints(solution, random)
  return {
    id: generatedId(seed),
    name: colors[random(colors.length)] + ' ' + places[random(places.length)],
    size, solution, checkpoints,
  }
}
