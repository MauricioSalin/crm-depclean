"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function TimeInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div className="relative">
      <Clock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...props}
        type="time"
        className={cn(
          "pl-10 [&::-webkit-calendar-picker-indicator]:opacity-0",
          className,
        )}
      />
    </div>
  )
}
