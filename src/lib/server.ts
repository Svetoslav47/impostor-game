import { useEffect, useState } from 'react'

export function serverUrl(): string {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined
  if (env) return env.replace(/\/+$/, '')
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8787'
  return 'https://impostor-bg-server.onrender.com'
}

export function socketUrl(): string {
  return `${serverUrl().replace(/^http/, 'ws')}/ws`
}

export type Health = 'checking' | 'up' | 'down'

const PROBE_TIMEOUT_MS = 4000
const RETRY_MS = 10000

async function probe(): Promise<boolean> {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(`${serverUrl()}/health`, { signal: ctrl.signal, cache: 'no-store' })
    return res.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(t)
  }
}

/** Probes GET /health; on failure keeps retrying every 10s in the background. */
export function useServerHealth(): Health {
  const [health, setHealth] = useState<Health>('checking')
  useEffect(() => {
    let cancelled = false
    let timer = 0
    const run = async () => {
      const ok = await probe()
      if (cancelled) return
      if (ok) {
        setHealth('up')
      } else {
        setHealth('down')
        timer = window.setTimeout(run, RETRY_MS)
      }
    }
    void run()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])
  return health
}
