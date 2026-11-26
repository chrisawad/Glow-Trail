export interface Puzzle {
  id: string
  name: string
  size: number
  checkpoints: number[]
  solution: number[]
}

export const PUZZLES: Puzzle[] = [{
  id: 'first-light', name: 'First Light', size: 7,
  checkpoints: [34,31,24,17,29,39,41,47,14,7,1,19,26,9,22],
  solution: [34,33,32,31,24,17,16,23,30,29,36,37,38,39,40,41,48,47,46,45,44,43,42,35,28,21,14,7,0,1,2,3,4,5,6,13,12,19,20,27,26,25,18,11,10,9,8,15,22],
},
  {
    id: 'clover-bend', name: 'Clover Bend', size: 7,
    checkpoints: [10, 19, 33, 46, 41, 20, 5, 15, 0, 22, 42, 30, 18],
    solution: [10, 11, 12, 19, 26, 25, 32, 33, 40, 39, 46, 47, 48, 41, 34, 27, 20, 13, 6, 5, 4, 3, 2, 9, 16, 15, 8, 1, 0, 7, 14, 21, 22, 29, 28, 35, 42, 43, 36, 37, 44, 45, 38, 31, 30, 23, 24, 17, 18],
  },
  {
    id: 'firefly-run', name: 'Firefly Run', size: 7,
    checkpoints: [18, 24, 39, 12, 9, 0, 3, 5, 20, 34, 22, 21, 38],
    solution: [18, 17, 24, 25, 32, 39, 40, 33, 26, 19, 12, 11, 10, 9, 8, 7, 0, 1, 2, 3, 4, 5, 6, 13, 20, 27, 34, 41, 48, 47, 46, 45, 44, 37, 36, 43, 42, 35, 28, 29, 22, 21, 14, 15, 16, 23, 30, 31, 38],
  },
  {
    id: 'violet-vale', name: 'Violet Vale', size: 7,
    checkpoints: [8, 10, 25, 27, 11, 6, 16, 29, 36, 31, 47, 40, 38],
    solution: [8, 9, 10, 17, 24, 25, 26, 27, 20, 19, 18, 11, 12, 13, 6, 5, 4, 3, 2, 1, 0, 7, 14, 15, 16, 23, 22, 21, 28, 29, 36, 35, 42, 43, 44, 37, 30, 31, 32, 33, 34, 41, 48, 47, 40, 39, 46, 45, 38],
  },
  {
    id: 'honeycomb', name: 'Honeycomb', size: 7,
    checkpoints: [36, 43, 37, 40, 48, 26, 13, 19, 32, 30, 8, 17, 6],
    solution: [36, 35, 42, 43, 44, 37, 38, 45, 46, 39, 40, 47, 48, 41, 34, 33, 26, 27, 20, 13, 12, 19, 18, 25, 32, 31, 30, 29, 28, 21, 14, 7, 0, 1, 8, 15, 22, 23, 24, 17, 16, 9, 2, 3, 10, 11, 4, 5, 6],
  },
  {
    id: 'starlight-steps', name: 'Starlight Steps', size: 7,
    checkpoints: [4, 9, 17, 12, 20, 41, 46, 35, 37, 19, 32, 1, 30],
    solution: [4, 3, 2, 9, 16, 17, 10, 11, 12, 5, 6, 13, 20, 27, 34, 41, 48, 47, 46, 45, 44, 43, 42, 35, 36, 37, 38, 39, 40, 33, 26, 19, 18, 25, 32, 31, 24, 23, 22, 15, 8, 1, 0, 7, 14, 21, 28, 29, 30],
  },
  {
    id: 'moonlit-switchback', name: 'Moonlit Switchback', size: 7,
    checkpoints: [18, 27, 25, 10, 6, 4, 2, 16, 33, 40, 38, 1, 48],
    solution: [18, 19, 20, 27, 26, 25, 24, 17, 10, 11, 12, 13, 6, 5, 4, 3, 2, 9, 16, 23, 30, 31, 32, 33, 34, 41, 40, 39, 38, 37, 36, 29, 22, 15, 8, 1, 0, 7, 14, 21, 28, 35, 42, 43, 44, 45, 46, 47, 48],
  },
  {
    id: 'midnight-loop', name: 'Midnight Loop', size: 7,
    checkpoints: [14, 0, 4, 12, 27, 41, 40, 19, 15, 21, 25, 36, 44],
    solution: [14, 7, 0, 1, 2, 3, 4, 11, 12, 5, 6, 13, 20, 27, 34, 41, 48, 47, 40, 33, 26, 19, 18, 17, 10, 9, 8, 15, 16, 23, 22, 21, 28, 29, 30, 31, 24, 25, 32, 39, 46, 45, 38, 37, 36, 35, 42, 43, 44],
  }
]

export function move(p: Puzzle, path: number[], target: number): number[] {
  const tip = path.at(-1)
  if (tip === undefined || !Number.isInteger(target) || target < 0 || target >= p.size ** 2) return path
  const d = Math.abs(tip % p.size - target % p.size) + Math.abs(Math.floor(tip / p.size) - Math.floor(target / p.size))
  if (d !== 1) return path
  if (path.at(-2) === target) return path.slice(0, -1)
  if (path.includes(target)) return path
  const next = p.checkpoints.find(cell => !path.includes(cell))
  if (p.checkpoints.includes(target) && target !== next) return path
  if (target === p.checkpoints.at(-1) && path.length !== p.size ** 2 - 1) return path
  return [...path, target]
}

export function hint(p: Puzzle, path: number[]): number[] {
  if (path.some((cell, i) => cell !== p.solution[i])) return path.slice(0, -1)
  return path.length === p.solution.length ? path : move(p, path, p.solution[path.length])
}
