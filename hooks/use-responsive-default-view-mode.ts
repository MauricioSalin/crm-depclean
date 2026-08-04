import * as React from "react"

const MOBILE_VIEW_MODE_QUERY = "(max-width: 767px)"

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export function useResponsiveDefaultViewMode<TDesktop extends string, TMobile extends string>(
  desktopMode: TDesktop,
  mobileMode: TMobile,
) {
  const [viewMode, setViewModeState] = React.useState<TDesktop | TMobile>(() => {
    if (typeof window === "undefined") return desktopMode
    return window.matchMedia(MOBILE_VIEW_MODE_QUERY).matches ? mobileMode : desktopMode
  })
  const userSelectedRef = React.useRef(false)

  useIsomorphicLayoutEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_VIEW_MODE_QUERY)
    const applyResponsiveDefault = () => {
      if (userSelectedRef.current) return
      setViewModeState(mediaQuery.matches ? mobileMode : desktopMode)
    }

    applyResponsiveDefault()
    mediaQuery.addEventListener("change", applyResponsiveDefault)

    return () => mediaQuery.removeEventListener("change", applyResponsiveDefault)
  }, [desktopMode, mobileMode])

  const setViewMode = React.useCallback((mode: TDesktop | TMobile) => {
    userSelectedRef.current = true
    setViewModeState(mode)
  }, [])

  return [viewMode, setViewMode] as const
}
