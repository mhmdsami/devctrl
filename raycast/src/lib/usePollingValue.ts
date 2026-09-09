import { useCallback, useEffect, useState } from 'react'

interface PollingOptions {
  intervalMs?: number
}

export interface PollingValue<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  reload: () => void
}

export function usePollingValue<T>(load: () => Promise<T>, { intervalMs }: PollingOptions = {}): PollingValue<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [reloadIndex, setReloadIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const next = await load()
        if (cancelled) return
        setData(next)
        setError(null)
      } catch (cause) {
        if (cancelled) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      }
    }

    void refresh()
    if (!intervalMs) return () => {
      cancelled = true
    }

    const interval = setInterval(() => void refresh(), intervalMs)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [intervalMs, load, reloadIndex])

  return {
    data,
    error,
    isLoading: data === null && error === null,
    reload: useCallback(() => setReloadIndex((index) => index + 1), []),
  }
}
