'use client'

import * as React from 'react'

const OverlayPortalModalContext = React.createContext(false)

function OverlayPortalModalProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OverlayPortalModalContext.Provider value>
      {children}
    </OverlayPortalModalContext.Provider>
  )
}

function useOverlayPortalModal() {
  return React.useContext(OverlayPortalModalContext)
}

export { OverlayPortalModalProvider, useOverlayPortalModal }
