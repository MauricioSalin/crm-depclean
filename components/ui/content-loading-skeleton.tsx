"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function ContentLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full sm:w-80" />
        <Skeleton className="h-10 w-full sm:w-40" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
