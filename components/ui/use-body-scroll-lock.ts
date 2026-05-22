'use client'

import * as React from 'react'

let lockCount = 0
let restoreScroll: (() => void) | null = null

export function useBodyScrollLock() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const documentElement = document.documentElement
    const body = document.body

    lockCount += 1

    if (lockCount === 1) {
      const scrollY = window.scrollY
      const scrollbarWidth = window.innerWidth - documentElement.clientWidth
      const previous = {
        htmlOverflow: documentElement.style.overflow,
        bodyOverflow: body.style.overflow,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyLeft: body.style.left,
        bodyRight: body.style.right,
        bodyWidth: body.style.width,
        bodyPaddingRight: body.style.paddingRight,
      }

      documentElement.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
      body.style.position = 'fixed'
      body.style.top = `-${scrollY}px`
      body.style.left = '0'
      body.style.right = '0'
      body.style.width = '100%'

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`
      }

      restoreScroll = () => {
        documentElement.style.overflow = previous.htmlOverflow
        body.style.overflow = previous.bodyOverflow
        body.style.position = previous.bodyPosition
        body.style.top = previous.bodyTop
        body.style.left = previous.bodyLeft
        body.style.right = previous.bodyRight
        body.style.width = previous.bodyWidth
        body.style.paddingRight = previous.bodyPaddingRight
        window.scrollTo(0, scrollY)
      }
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1)

      if (lockCount === 0 && restoreScroll) {
        const restore = restoreScroll
        restoreScroll = null
        restore()
      }
    }
  }, [])
}
