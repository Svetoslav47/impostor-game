import { readJSON, writeJSON } from './storage'

/** How many times each word has come up on this device, across sessions (key: the word). */
export type SeenCounts = Record<string, number>

const KEY = 'impostor.seen.v1'

export function loadSeen(): SeenCounts {
  const s = readJSON<SeenCounts>('local', KEY)
  return s && typeof s === 'object' ? s : {}
}

export function markSeen(word: string): void {
  const s = loadSeen()
  s[word] = (s[word] ?? 0) + 1
  writeJSON('local', KEY, s)
}

/** Pick weight: a never-seen word is 4× as likely as one seen once, 9× as one seen twice, and so on. */
export function seenWeight(count: number | undefined): number {
  return 1 / (1 + (count ?? 0)) ** 2
}
