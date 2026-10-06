import raw from '../../shared/categories.json'

export interface WordEntry {
  word: string
  hint: string
}

export interface Category {
  id: string
  name: string
  description: string
  color: string
  icon: string
  words: WordEntry[]
}

export const CATEGORIES: Category[] = raw as Category[]
export const ALL_CATEGORY_IDS: string[] = CATEGORIES.map((c) => c.id)

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}
