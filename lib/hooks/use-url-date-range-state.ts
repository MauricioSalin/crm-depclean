"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { DateRange } from "react-day-picker"

import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"

type UseUrlDateRangeStateOptions = {
  fromKey?: string
  toKey?: string
  initialRange?: DateRange
  emptyRangeKey?: string
  emptyRangeValue?: string
}

function rangesMatch(left?: DateRange, right?: DateRange) {
  return (
    (left?.from ? toCivilDateKey(left.from) : "") === (right?.from ? toCivilDateKey(right.from) : "")
    && (left?.to ? toCivilDateKey(left.to) : "") === (right?.to ? toCivilDateKey(right.to) : "")
  )
}

export function useUrlDateRangeState({
  fromKey = "dateFrom",
  toKey = "dateTo",
  initialRange,
  emptyRangeKey,
  emptyRangeValue = "all",
}: UseUrlDateRangeStateOptions = {}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const latestPathnameRef = useRef(pathname)

  const readRange = useCallback((): DateRange | undefined => {
    if (emptyRangeKey && searchParams.get(emptyRangeKey) === emptyRangeValue) return undefined

    const hasUrlRange = searchParams.has(fromKey) || searchParams.has(toKey)
    if (!hasUrlRange) return initialRange

    const from = parseCivilDate(searchParams.get(fromKey)) ?? undefined
    const to = parseCivilDate(searchParams.get(toKey)) ?? undefined
    return from || to ? { from, to } : undefined
  }, [emptyRangeKey, emptyRangeValue, fromKey, initialRange, searchParams, toKey])

  const [range, setRange] = useState<DateRange | undefined>(readRange)

  useEffect(() => {
    latestPathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    const nextRange = readRange()
    setRange((current) => (rangesMatch(current, nextRange) ? current : nextRange))
  }, [readRange])

  const updateRange = useCallback(
    (nextRange: DateRange | undefined) => {
      setRange(nextRange)

      const params = new URLSearchParams(window.location.search)
      const from = nextRange?.from ? toCivilDateKey(nextRange.from) : ""
      const to = nextRange?.to ? toCivilDateKey(nextRange.to) : ""
      const isEmpty = !from && !to

      if (from) params.set(fromKey, from)
      else params.delete(fromKey)

      if (to) params.set(toKey, to)
      else params.delete(toKey)

      if (emptyRangeKey) {
        if (isEmpty) params.set(emptyRangeKey, emptyRangeValue)
        else params.delete(emptyRangeKey)
      }

      const queryString = params.toString()
      const currentPathname = latestPathnameRef.current
      const href = queryString ? `${currentPathname}?${queryString}` : currentPathname
      window.history.replaceState(window.history.state, "", href)
    },
    [emptyRangeKey, emptyRangeValue, fromKey, toKey],
  )

  return [range, updateRange] as const
}
