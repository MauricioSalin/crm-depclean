"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

const STORAGE_KEY = "depclean.sidebarCollapsed"

type SidebarCollapseContextValue = {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null)

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)

  useEffect(() => {
    const storedValue = window.localStorage.getItem(STORAGE_KEY)
    if (storedValue === "true") {
      setCollapsedState(true)
      document.documentElement.dataset.depcleanSidebar = "collapsed"
      return
    }

    document.documentElement.dataset.depcleanSidebar = "expanded"
  }, [])

  const setCollapsed = useCallback((nextCollapsed: boolean) => {
    setCollapsedState(nextCollapsed)
    window.localStorage.setItem(STORAGE_KEY, String(nextCollapsed))
    document.documentElement.dataset.depcleanSidebar = nextCollapsed ? "collapsed" : "expanded"
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((currentCollapsed) => {
      const nextCollapsed = !currentCollapsed
      window.localStorage.setItem(STORAGE_KEY, String(nextCollapsed))
      document.documentElement.dataset.depcleanSidebar = nextCollapsed ? "collapsed" : "expanded"
      return nextCollapsed
    })
  }, [])

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
    }),
    [collapsed, setCollapsed, toggleCollapsed],
  )

  return <SidebarCollapseContext.Provider value={value}>{children}</SidebarCollapseContext.Provider>
}

export function useSidebarCollapse() {
  const context = useContext(SidebarCollapseContext)
  if (!context) {
    throw new Error("useSidebarCollapse must be used inside SidebarCollapseProvider")
  }

  return context
}
