"use client"

import * as React from "react"
import { format, isBefore, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  open,
  onOpenChange,
  placeholder = "Selecionar período",
  className,
}: DateRangePickerProps) {
  const isMobile = useIsMobile()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(value)
  const isOpen = open ?? internalOpen
  const visibleRange = isOpen ? draftRange : value

  React.useEffect(() => {
    if (isOpen) setDraftRange(value)
  }, [isOpen, value])

  const setPopoverOpen = (nextOpen: boolean) => {
    if (!nextOpen) setDraftRange(value)
    setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const formatDateRange = (range?: DateRange) => {
    if (!range?.from) return placeholder
    if (!range.to) return format(range.from, "dd/MM/yyyy", { locale: ptBR })
    return `${format(range.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}`
  }

  const commitRange = (range: DateRange) => {
    setDraftRange(range)
    onChange?.(range)
    setPopoverOpen(false)
  }

  const handleSelectDay = (_range: DateRange | undefined, selectedDay: Date) => {
    if (!draftRange?.from || draftRange.to) {
      setDraftRange({ from: selectedDay, to: undefined })
      return
    }

    const from = draftRange.from
    if (isSameDay(selectedDay, from)) {
      commitRange({ from, to: from })
      return
    }

    commitRange(isBefore(selectedDay, from) ? { from: selectedDay, to: from } : { from, to: selectedDay })
  }

  return (
    <Popover open={isOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 justify-start text-left font-normal",
            !visibleRange?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{formatDateRange(visibleRange)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={visibleRange?.from}
          selected={visibleRange}
          onSelect={handleSelectDay}
          numberOfMonths={isMobile ? 1 : 2}
          showOutsideDays={false}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  )
}
