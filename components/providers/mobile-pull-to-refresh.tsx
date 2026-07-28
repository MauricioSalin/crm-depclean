"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

const MOBILE_MEDIA_QUERY = "(max-width: 767px) and (pointer: coarse)"
const REFRESH_THRESHOLD = 56
const MAX_PULL_DISTANCE = 88
const INDICATOR_TRAVEL = 56
const MINIMUM_SPINNER_TIME = 450
const PUBLIC_PATHS = ["/login", "/resetar-senha", "/assinatura/"]
const BLOCKED_TARGETS = [
  "[role='dialog']",
  "[data-slot='sheet-content']",
  "[data-pull-to-refresh='disabled']",
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
].join(",")

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path))
}

function canStartPull(target: EventTarget | null) {
  if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return false
  if (document.body.hasAttribute("data-scroll-locked")) return false
  if (!(target instanceof Element) || target.closest(BLOCKED_TARGETS)) return false

  let element: Element | null = target

  while (element && element !== document.body) {
    const style = window.getComputedStyle(element)
    const canScrollVertically =
      /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1

    if (canScrollVertically && element.scrollTop > 0) return false
    element = element.parentElement
  }

  return true
}

export function MobilePullToRefresh() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const pullDistanceRef = useRef(0)
  const refreshingRef = useRef(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (isPublicPath(pathname)) return

    const mobileQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    if (!mobileQuery.matches) return

    let startX = 0
    let startY = 0
    let tracking = false

    const updatePullDistance = (distance: number) => {
      pullDistanceRef.current = distance
      setPullDistance(distance)
    }

    const resetPull = () => {
      tracking = false
      updatePullDistance(0)
    }

    const refresh = async () => {
      if (refreshingRef.current) return

      refreshingRef.current = true
      setIsRefreshing(true)
      updatePullDistance(INDICATOR_TRAVEL)
      router.refresh()

      await Promise.allSettled([
        queryClient.refetchQueries({ type: "active" }),
        new Promise((resolve) => window.setTimeout(resolve, MINIMUM_SPINNER_TIME)),
      ])

      refreshingRef.current = false
      setIsRefreshing(false)
      updatePullDistance(0)
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current || event.touches.length !== 1 || !canStartPull(event.target)) return

      const touch = event.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      tracking = true
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return

      const touch = event.touches[0]
      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      if (deltaY <= 0 || Math.abs(deltaX) > deltaY) {
        resetPull()
        return
      }

      if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
        resetPull()
        return
      }

      event.preventDefault()
      updatePullDistance(Math.min(deltaY * 0.55, MAX_PULL_DISTANCE))
    }

    const handleTouchEnd = () => {
      if (!tracking) return

      tracking = false
      if (pullDistanceRef.current >= REFRESH_THRESHOLD) {
        void refresh()
        return
      }

      updatePullDistance(0)
    }

    const handleTouchCancel = () => {
      resetPull()
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd, { passive: true })
    document.addEventListener("touchcancel", handleTouchCancel, { passive: true })

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.removeEventListener("touchcancel", handleTouchCancel)
    }
  }, [pathname, queryClient, router])

  if (isPublicPath(pathname)) return null

  const isVisible = isRefreshing || pullDistance > 0
  if (!isVisible) return null

  const progress = Math.min(pullDistance / REFRESH_THRESHOLD, 1)
  const translateY = isRefreshing ? 0 : Math.min(pullDistance, INDICATOR_TRAVEL) - INDICATOR_TRAVEL

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="mobile-pull-to-refresh"
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[190] flex size-10 items-center justify-center rounded-full border bg-background text-primary shadow-md transition-[opacity,transform] duration-150"
      style={{
        opacity: isRefreshing ? 1 : progress,
        transform: `translate3d(-50%, ${translateY}px, 0)`,
      }}
    >
      <LoaderCircle
        aria-hidden="true"
        className={isRefreshing ? "size-5 animate-spin" : "size-5"}
        style={isRefreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
      />
      <span className="sr-only">{isRefreshing ? "Atualizando dados" : "Puxe para atualizar"}</span>
    </div>
  )
}
