import { ALL_CATEGORY_IDS } from './categories'
import { readJSON, writeJSON } from './storage'

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12
/** Two impostors are only allowed from this many players. */
export const TWO_IMPOSTORS_MIN = 5

export interface LocalSettings {
  playerCount: number
  impostorCount: 1 | 2
  /** Always MAX_PLAYERS long; empty string means "use the default name". */
  names: string[]
  categoryIds: string[]
}

const KEY = 'impostor.settings.v1'
/** Categories that existed before saved settings started tracking which ones the player has seen. */
const LEGACY_CATEGORY_IDS = ['objects', 'people', 'mythical', 'professions', 'places', 'food', 'fiction', 'nature', 'feelings', 'sports']

export function defaultName(i: number): string {
  return `Играч ${i + 1}`
}

export function loadSettings(): LocalSettings {
  const s = readJSON<Partial<LocalSettings> & { knownCategoryIds?: string[] }>('local', KEY) ?? {}
  const playerCount = clamp(Number(s.playerCount) || 5, MIN_PLAYERS, MAX_PLAYERS)
  const names = Array.from({ length: MAX_PLAYERS }, (_, i) =>
    typeof s.names?.[i] === 'string' ? s.names[i].slice(0, 20) : '',
  )
  // Categories added since the settings were saved start switched on.
  const known = Array.isArray(s.knownCategoryIds) ? s.knownCategoryIds : LEGACY_CATEGORY_IDS
  const categoryIds = Array.isArray(s.categoryIds)
    ? ALL_CATEGORY_IDS.filter((id) => s.categoryIds!.includes(id) || !known.includes(id))
    : [...ALL_CATEGORY_IDS]
  let impostorCount: 1 | 2 = s.impostorCount === 2 ? 2 : 1
  if (playerCount < TWO_IMPOSTORS_MIN) impostorCount = 1
  return { playerCount, impostorCount, names, categoryIds }
}

export function saveSettings(s: LocalSettings): void {
  writeJSON('local', KEY, { ...s, knownCategoryIds: ALL_CATEGORY_IDS })
}

export function playerNames(s: LocalSettings): string[] {
  return Array.from({ length: s.playerCount }, (_, i) => s.names[i].trim() || defaultName(i))
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

const ONLINE_NAME_KEY = 'impostor.onlineName'
export function loadOnlineName(): string {
  return readJSON<string>('local', ONLINE_NAME_KEY) ?? ''
}
export function saveOnlineName(name: string): void {
  writeJSON('local', ONLINE_NAME_KEY, name)
}
