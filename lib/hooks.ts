'use client'

import { useCallback, useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

export function useQueryParams() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const getParams = useCallback(() => {
    if (typeof window === 'undefined') return new URLSearchParams()
    return new URLSearchParams(window.location.search)
  }, [])

  const setParam = useCallback(
    (key: string, value: string | null) => {
      if (typeof window === 'undefined') return

      const params = new URLSearchParams(window.location.search)
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState({ path: newUrl }, '', newUrl)
    },
    []
  )

  return { isClient, getParams, setParam }
}
