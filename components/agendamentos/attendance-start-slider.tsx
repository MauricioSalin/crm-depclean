"use client"

import { useEffect, useRef, useState } from "react"
import { animate, motion, useMotionValue, useTransform } from "framer-motion"
import { Loader2, Play, Square } from "lucide-react"

import { cn } from "@/lib/utils"

interface AttendanceStartSliderProps {
  action?: "start" | "finish"
  compact?: boolean
  disabled?: boolean
  isSubmitting?: boolean
  onComplete: () => Promise<void> | void
  className?: string
}

const HANDLE_WIDTH = 56
const SLIDER_HORIZONTAL_PADDING = 16
const DEFAULT_COMPLETE_OFFSET = 320 - HANDLE_WIDTH - 12

export function AttendanceStartSlider({
  action = "start",
  compact = false,
  disabled = false,
  isSubmitting: externalSubmitting = false,
  onComplete,
  className,
}: AttendanceStartSliderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [completeOffset, setCompleteOffset] = useState(DEFAULT_COMPLETE_OFFSET)
  const containerRef = useRef<HTMLDivElement>(null)
  const submitting = externalSubmitting || isSubmitting
  const idleLabel = action === "finish" ? "Encerrar atendimento" : "Iniciar atendimento"
  const submittingLabel = action === "finish" ? "Encerrando atendimento..." : "Iniciando atendimento..."
  const handleWidth = compact ? 36 : HANDLE_WIDTH
  const horizontalPadding = compact ? 12 : SLIDER_HORIZONTAL_PADDING
  const x = useMotionValue(0)
  const fillWidth = useTransform(x, (value) => `${Math.max(handleWidth + 16 + value, handleWidth + 16)}px`)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateOffset = () => {
      const width = element.getBoundingClientRect().width
      setCompleteOffset(Math.max(0, width - handleWidth - horizontalPadding))
    }

    updateOffset()
    const observer = new ResizeObserver(updateOffset)
    observer.observe(element)

    return () => observer.disconnect()
  }, [handleWidth, horizontalPadding])

  return (
    <div
      ref={containerRef}
      data-attendance-slider={action}
      className={cn(
        "relative w-full overflow-hidden rounded-full border bg-white shadow-sm",
        compact ? "h-12 px-1.5" : "h-16 px-2",
        disabled
          ? "border-border opacity-60"
          : "border-primary/20",
        className,
      )}
    >
      <motion.div
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          disabled ? "bg-primary/5" : "bg-gradient-to-r from-primary/20 via-primary/12 to-primary/5",
        )}
        style={{ width: disabled ? `${handleWidth + 16}px` : fillWidth }}
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center text-center font-medium text-foreground/85",
          compact ? "justify-end pl-14 pr-2 text-xs" : "justify-center px-20 text-sm",
        )}
      >
        <span className="leading-5">
          {submitting ? submittingLabel : idleLabel}
        </span>
      </div>

      <motion.button
        type="button"
        drag={disabled || submitting || isCompleted ? false : "x"}
        dragConstraints={{ left: 0, right: completeOffset }}
        dragElastic={0.05}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        style={{ touchAction: "pan-y", x }}
        onDragEnd={(_event, info) => {
          if (disabled || submitting || isCompleted) return

          if (info.offset.x < completeOffset - 20) {
            animate(x, 0, { type: "spring", stiffness: 420, damping: 32 })
            return
          }

          setIsCompleted(true)
          animate(x, completeOffset, { type: "spring", stiffness: 500, damping: 36 })

          let completion: Promise<void> | void
          try {
            completion = onComplete()
          } catch {
            setIsCompleted(false)
            animate(x, 0, { type: "spring", stiffness: 420, damping: 32 })
            setIsSubmitting(false)
            return
          }

          const loadingTimer = window.setTimeout(() => setIsSubmitting(true), 120)
          Promise.resolve(completion)
            .catch(() => {
              setIsCompleted(false)
              animate(x, 0, { type: "spring", stiffness: 420, damping: 32 })
            })
            .finally(() => {
              window.clearTimeout(loadingTimer)
              setIsSubmitting(false)
            })
        }}
        className={cn(
          "absolute z-20 flex items-center justify-center rounded-full text-white",
          compact ? "left-1.5 top-1.5 h-9 w-9" : "left-2 top-2 h-12 w-12",
          disabled ? "bg-muted-foreground/40" : "bg-primary shadow-md shadow-primary/25",
        )}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : action === "finish" ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </motion.button>
    </div>
  )
}
