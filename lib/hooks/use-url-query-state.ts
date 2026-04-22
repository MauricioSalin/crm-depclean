"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function useUrlQueryState(key: string, initialValue = "") {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(() => searchParams.get(key) ?? initialValue)

  useEffect(() => {
    const nextValue = searchParams.get(key) ?? initialValue
    setValue((current) => (current === nextValue ? current : nextValue))
  }, [initialValue, key, searchParams])

  const updateValue = (nextValue: string) => {
    setValue(nextValue)

    const params = new URLSearchParams(searchParams.toString())
    if (nextValue) {
      params.set(key, nextValue)
    } else {
      params.delete(key)
    }

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  return [value, updateValue] as const
}
