import { CATEGORIES, type Category } from './categories'

export interface LocalRound {
  players: string[]
  impostors: number[]
  category: Category
  word: string
  hint: string
  starter: number
}

export function randomInt(n: number): number {
  if (n <= 0) return 0
  try {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return a[0] % n
  } catch {
    return Math.floor(Math.random() * n)
  }
}

/** Words dealt this session (key: "categoryId:word"), so they don't repeat until a pool runs out. */
const used = new Set<string>()

export function dealRound(players: string[], impostorCount: number, categoryIds: string[]): LocalRound {
  const cats = CATEGORIES.filter((c) => categoryIds.includes(c.id))
  const pool = cats.length ? cats : CATEGORIES
  let candidates = pool.flatMap((c) => c.words.map((w) => ({ c, w })))
  let fresh = candidates.filter(({ c, w }) => !used.has(`${c.id}:${w.word}`))
  if (fresh.length === 0) {
    // Pool exhausted: forget the words of these categories and start over.
    for (const { c, w } of candidates) used.delete(`${c.id}:${w.word}`)
    fresh = candidates
  }
  candidates = fresh
  const pick = candidates[randomInt(candidates.length)]
  used.add(`${pick.c.id}:${pick.w.word}`)

  const order = players.map((_, i) => i)
  shuffle(order)
  const impostors = order.slice(0, Math.min(impostorCount, players.length - 1)).sort((a, b) => a - b)

  return {
    players,
    impostors,
    category: pick.c,
    word: pick.w.word,
    hint: pick.w.hint,
    starter: randomInt(players.length),
  }
}

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Joins names Bulgarian-style: "А", "А и Б", "А, Б и В". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`
}

export function pluralPlayers(n: number): string {
  return n === 1 ? '1 играч' : `${n} играчи`
}
export function pluralImpostors(n: number): string {
  return n === 1 ? '1 импостор' : `${n} импостора`
}
export function pluralCategories(n: number): string {
  return n === 1 ? '1 категория' : `${n} категории`
}
