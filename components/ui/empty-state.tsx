"use client"

import { Inbox, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { TableCell, TableRow } from "@/components/ui/table"

type EmptyStateProps = {
  icon?: LucideIcon
  title?: string
  description?: string
  className?: string
  compact?: boolean
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Nenhum registro encontrado.",
  description,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center text-center text-muted-foreground",
        compact ? "min-h-[180px] py-8" : "min-h-[220px] py-10",
        className,
      )}
    >
      <Icon className="mb-3 h-8 w-8 opacity-55" strokeWidth={1.8} />
      <p className="text-sm">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs leading-5">{description}</p> : null}
    </div>
  )
}

export function TableEmptyState({
  colSpan,
  icon,
  title,
  description,
  compact,
}: EmptyStateProps & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <EmptyState icon={icon} title={title} description={description} compact={compact} />
      </TableCell>
    </TableRow>
  )
}
