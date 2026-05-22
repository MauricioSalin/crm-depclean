"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface DataPaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export function DataPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 20, 50],
  className,
}: DataPaginationProps) {
  const normalizedPageSizeOptions = Array.from(
    new Set(pageSizeOptions.filter((option) => Number.isFinite(option) && option > 0)),
  ).sort((a, b) => a - b)
  const firstPageSizeOption = normalizedPageSizeOptions[0] ?? 10
  const safePageSize = normalizedPageSizeOptions.includes(pageSize) ? pageSize : firstPageSizeOption
  const safeTotalPages = Math.max(1, totalPages || 1)
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * safePageSize + 1
  const endItem = Math.min(currentPage * safePageSize, totalItems)

  useEffect(() => {
    if (pageSize !== safePageSize) {
      onPageSizeChange(safePageSize)
    }
  }, [onPageSizeChange, pageSize, safePageSize])

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center gap-3 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:flex-row sm:justify-between md:sticky md:bottom-0 md:z-30 md:mt-auto",
        className,
      )}
    >
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Exibindo</span>
        <Select
          value={safePageSize.toString()}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {normalizedPageSizeOptions.map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          de {totalItems} {totalItems === 1 ? "item" : "itens"}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">
          {startItem}-{endItem} de {totalItems}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2">
            {currentPage} / {safeTotalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= safeTotalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(safeTotalPages)}
            disabled={currentPage >= safeTotalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
