"use client"

import { useState } from "react"
import { animate, motion, useMotionValue, useTransform } from "framer-motion"
import { Play } from "lucide-react"

import { cn } from "@/lib/utils"

interface AttendanceStartSliderProps {
  disabled?: boolean
  onComplete: () => Promise<void> | void
  className?: string
}

const SLIDER_WIDTH = 320
const HANDLE_WIDTH = 56
const COMPLETE_OFFSET = SLIDER_WIDTH - HANDLE_WIDTH - 12

export function AttendanceStartSlider({
  disabled = false,
  onComplete,
  className,
}: AttendanceStartSliderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const x = useMotionValue(0)
  const fillWidth = useTransform(x, (value) => `${Math.max(HANDLE_WIDTH + 16 + value, HANDLE_WIDTH + 16)}px`)

  return (
    <div
      className={cn(
        "relative h-16 w-full overflow-hidden rounded-full border bg-white px-2 shadow-sm",
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
        style={{ width: disabled ? `${HANDLE_WIDTH + 16}px` : fillWidth }}
      />

      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-center px-20 text-center text-sm font-medium text-foreground/85">
        <span className="leading-5">
          {disabled ? "Aguardando assinatura do contrato" : "Iniciar atendimento"}
        </span>
      </div>

      <motion.button
        type="button"
        drag={disabled || isSubmitting ? false : "x"}
        dragConstraints={{ left: 0, right: COMPLETE_OFFSET }}
        dragElastic={0.05}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        style={{ touchAction: "pan-y", x }}
        onDragEnd={async (_event, info) => {
          if (disabled || isSubmitting) return

          if (info.offset.x < COMPLETE_OFFSET - 20) {
            animate(x, 0, { type: "spring", stiffness: 420, damping: 32 })
            return
          }

          try {
            setIsSubmitting(true)
            animate(x, COMPLETE_OFFSET, { type: "spring", stiffness: 500, damping: 36 })
            await onComplete()
          } finally {
            setIsSubmitting(false)
          }
        }}
        className={cn(
          "absolute left-2 top-2 z-20 flex h-12 w-12 items-center justify-center rounded-full text-white",
          disabled ? "bg-muted-foreground/40" : "bg-primary shadow-md shadow-primary/25",
        )}
      >
        <Play className="h-4 w-4" />
      </motion.button>
    </div>
  )
}
