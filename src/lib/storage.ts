function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function readJSON<T>(store: 'local' | 'session', key: string): T | null {
  return safe(() => {
    const s = store === 'local' ? window.localStorage : window.sessionStorage
    const v = s.getItem(key)
    return v == null ? null : (JSON.parse(v) as T)
  }, null)
}

export function writeJSON(store: 'local' | 'session', key: string, value: unknown): void {
  safe(() => {
    const s = store === 'local' ? window.localStorage : window.sessionStorage
    if (value === null || value === undefined) s.removeItem(key)
    else s.setItem(key, JSON.stringify(value))
  }, undefined)
}
