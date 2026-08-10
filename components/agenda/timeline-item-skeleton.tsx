import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

export function TimelineItemSkeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative block overflow-hidden rounded-md bg-muted/70", className)}
      style={style}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-background/85 to-transparent motion-reduce:animate-none" />
    </span>
  )
}
