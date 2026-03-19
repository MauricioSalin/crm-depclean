"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

export function HeaderFiltersPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el = document.getElementById("header-filters-slot")
    setTarget(el)
  }, [])

  if (!target) return null
  return createPortal(children, target)
}
