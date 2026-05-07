"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type TableSkeletonColumn = {
  className?: string
  width?: string
  align?: "left" | "right"
  withIcon?: boolean
}

const DEFAULT_WIDTHS = ["w-36", "w-28", "w-44", "w-24", "w-20", "w-12"]

export function TableSkeletonRows({
  columns,
  rows = 5,
}: {
  columns: number | TableSkeletonColumn[]
  rows?: number
}) {
  const resolvedColumns: TableSkeletonColumn[] =
    typeof columns === "number"
      ? Array.from({ length: columns }, (_, index) => ({ width: DEFAULT_WIDTHS[index % DEFAULT_WIDTHS.length] }))
      : columns

  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {resolvedColumns.map((column, columnIndex) => (
            <TableCell key={`${rowIndex}-${columnIndex}`} className={cn(column.className, column.align === "right" && "text-right")}>
              <div className={cn("flex items-center gap-3", column.align === "right" && "justify-end")}>
                {column.withIcon ? <Skeleton className="h-10 w-10 shrink-0 rounded-xl" /> : null}
                <Skeleton className={cn("h-4", column.width ?? DEFAULT_WIDTHS[columnIndex % DEFAULT_WIDTHS.length])} />
              </div>
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function CardSkeletonGrid({
  cards = 4,
  className,
}: {
  cards?: number
  className?: string
}) {
  return (
    <>
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className={cn("rounded-xl border bg-card p-4", className)}>
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </>
  )
}
