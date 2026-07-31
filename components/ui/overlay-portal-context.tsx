'use client'

import * as React from 'react'

const OverlayPortalContainerContext = React.createContext<HTMLElement | null>(null)

function OverlayPortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null
  children: React.ReactNode
}) {
  return (
    <OverlayPortalContainerContext.Provider value={container}>
      {children}
    </OverlayPortalContainerContext.Provider>
  )
}

function useOverlayPortalContainer() {
  return React.useContext(OverlayPortalContainerContext)
}

export { OverlayPortalContainerProvider, useOverlayPortalContainer }
