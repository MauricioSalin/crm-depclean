import * as React from "react"

const MOBILE_VIEW_MODE_QUERY = "(max-width: 767px)"

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export function useResponsiveDefaultViewMode<TDesktop extends string, TMobile extends string>(
  desktopMode: TDesktop,
  mobileMode: TMobile,
) {
  const [viewMode, setViewMode] = React.useState<TDesktop | TMobile>(desktopMode)
  const defaultAppliedRef = React.useRef(false)

  useIsomorphicLayoutEffect(() => {
    if (defaultAppliedRef.current) return

    defaultAppliedRef.current = true
    setViewMode(window.matchMedia(MOBILE_VIEW_MODE_QUERY).matches ? mobileMode : desktopMode)
  }, [desktopMode, mobileMode])

  return [viewMode, setViewMode] as const
}
