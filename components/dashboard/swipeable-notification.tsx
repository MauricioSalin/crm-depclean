"use client"

import { useRef, useState } from "react"
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from "framer-motion"
import { CheckCheck } from "lucide-react"

interface SwipeableNotificationProps {
  children: React.ReactNode
  onMarkRead: () => void
  isRead: boolean
  dismissOnMarkRead?: boolean
}

const SWIPE_THRESHOLD = 70
const DISMISS_THRESHOLD = 140

export function SwipeableNotification({ children, onMarkRead, isRead, dismissOnMarkRead = true }: SwipeableNotificationProps) {
  const [dismissed, setDismissed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const suppressClickRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const pointerMovedRef = useRef(false)
  const x = useMotionValue(0)
  const controls = useAnimation()

  const actionOpacity = useTransform(x, [-DISMISS_THRESHOLD, -SWIPE_THRESHOLD, -20, 0], [1, 1, 0.4, 0])
  const actionScale = useTransform(x, [-DISMISS_THRESHOLD, -SWIPE_THRESHOLD, 0], [1, 0.9, 0.5])

  const suppressNextClick = () => {
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 350)
  }

  const markRead = async () => {
    if (dismissOnMarkRead) {
      await controls.start({ x: -400, opacity: 0, transition: { duration: 0.25 } })
      setDismissed(true)
      onMarkRead()
      return
    }

    onMarkRead()
    setRevealed(false)
    await controls.start({ x: 0, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 30 } })
  }

  const handleDragEnd = async (_: any, info: PanInfo) => {
    const offset = info.offset.x
    if (Math.abs(offset) > 8 || pointerMovedRef.current) {
      suppressNextClick()
    }

    if (offset < -DISMISS_THRESHOLD) {
      await markRead()
    } else if (offset < -SWIPE_THRESHOLD) {
      setRevealed(true)
      controls.start({ x: -70, transition: { type: "spring", stiffness: 300, damping: 30 } })
    } else {
      setRevealed(false)
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } })
    }
  }

  const handleClickAction = async () => {
    await markRead()
  }

  if (dismissed) return null
  if (isRead) return <div className="relative">{children}</div>

  return (
    <div className="relative overflow-hidden">
      {/* Background action button */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end rounded-sm bg-emerald-700"
        style={{ opacity: actionOpacity }}
      >
        <button
          onClick={revealed ? handleClickAction : undefined}
          className="flex flex-col items-center justify-center gap-1 w-[70px] h-full text-white cursor-pointer"
        >
          <motion.div style={{ scale: actionScale }} className="flex flex-col items-center gap-1">
            <CheckCheck className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">Lida</span>
          </motion.div>
        </button>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={0.1}
        onPointerDownCapture={(event) => {
          pointerStartRef.current = { x: event.clientX, y: event.clientY }
          pointerMovedRef.current = false
        }}
        onPointerMoveCapture={(event) => {
          const start = pointerStartRef.current
          if (!start) return

          const deltaX = event.clientX - start.x
          const deltaY = event.clientY - start.y

          if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
            pointerMovedRef.current = true
            suppressClickRef.current = true
          }
        }}
        onPointerUpCapture={() => {
          pointerStartRef.current = null
        }}
        onPointerCancelCapture={() => {
          pointerStartRef.current = null
          pointerMovedRef.current = false
        }}
        onDragEnd={handleDragEnd}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return
          event.preventDefault()
          event.stopPropagation()
          window.setTimeout(() => {
            suppressClickRef.current = false
            pointerMovedRef.current = false
          }, 0)
        }}
        animate={controls}
        style={{ x }}
        className="relative bg-popover cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  )
}
