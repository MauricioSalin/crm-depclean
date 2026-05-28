"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type UseUrlQueryStateOptions = {
  debounceMs?: number
}

export function useUrlQueryState(key: string, initialValue = "", options: UseUrlQueryStateOptions = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounceMs = options.debounceMs ?? 250
  const replaceTimeoutRef = useRef<number | null>(null)
  const latestPathnameRef = useRef(pathname)
  const [value, setValue] = useState(() => searchParams.get(key) ?? initialValue)

  useEffect(() => {
    latestPathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    const nextValue = searchParams.get(key) ?? initialValue
    setValue((current) => (current === nextValue ? current : nextValue))
  }, [initialValue, key, searchParams])

  useEffect(() => {
    return () => {
      if (replaceTimeoutRef.current) {
        window.clearTimeout(replaceTimeoutRef.current)
      }
    }
  }, [])

  const replaceUrl = useCallback(
    (nextValue: string) => {
      const params = new URLSearchParams(window.location.search)
      if (nextValue) {
        params.set(key, nextValue)
      } else {
        params.delete(key)
      }

      const queryString = params.toString()
      const currentPathname = latestPathnameRef.current
      router.replace(queryString ? `${currentPathname}?${queryString}` : currentPathname, { scroll: false })
    },
    [key, router],
  )

  const updateValue = useCallback(
    (nextValue: string) => {
      setValue(nextValue)

      if (replaceTimeoutRef.current) {
        window.clearTimeout(replaceTimeoutRef.current)
        replaceTimeoutRef.current = null
      }

      if (debounceMs <= 0) {
        replaceUrl(nextValue)
        return
      }

      replaceTimeoutRef.current = window.setTimeout(() => {
        replaceTimeoutRef.current = null
        replaceUrl(nextValue)
      }, debounceMs)
    },
    [debounceMs, replaceUrl],
  )

  return [value, updateValue] as const
}
