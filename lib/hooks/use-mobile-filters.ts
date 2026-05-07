"use client"

import { useEffect, useState } from "react"

export const MOBILE_FILTERS_EVENT = "depclean:mobile-filters"

export function setMobileFiltersOpen(open: boolean) {
  if (typeof window === "undefined") return
  ;(window as Window & { __depcleanMobileFiltersOpen?: boolean }).__depcleanMobileFiltersOpen = open
  window.dispatchEvent(new CustomEvent(MOBILE_FILTERS_EVENT, { detail: { open } }))
}

export function useMobileFiltersOpen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(Boolean((window as Window & { __depcleanMobileFiltersOpen?: boolean }).__depcleanMobileFiltersOpen))

    const handleFiltersToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>
      setOpen(Boolean(customEvent.detail?.open))
    }

    window.addEventListener(MOBILE_FILTERS_EVENT, handleFiltersToggle)
    return () => window.removeEventListener(MOBILE_FILTERS_EVENT, handleFiltersToggle)
  }, [])

  return open
}
