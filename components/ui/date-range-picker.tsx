"use client"

import * as React from "react"
import { format, isBefore, isSameDay, isValid, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  fromPlaceholder?: string
  toPlaceholder?: string
  className?: string
}

type ActiveField = "from" | "to"

const DATE_INPUT_LENGTH = 10

function formatDateInput(date?: Date) {
  return date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : ""
}

function maskDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function parseDateInput(value: string) {
  if (value.length !== DATE_INPUT_LENGTH) return undefined
  const parsed = parse(value, "dd/MM/yyyy", new Date())
  if (!isValid(parsed)) return undefined
  return formatDateInput(parsed) === value ? parsed : undefined
}

export function DateRangePicker({
  value,
  onChange,
  open,
  onOpenChange,
  fromPlaceholder = "Data inicial",
  toPlaceholder = "Data final",
  className,
}: DateRangePickerProps) {
  const isMobile = useIsMobile()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(value)
  const [fromText, setFromText] = React.useState(() => formatDateInput(value?.from))
  const [toText, setToText] = React.useState(() => formatDateInput(value?.to))
  const [activeField, setActiveField] = React.useState<ActiveField>("from")
  const isOpen = open ?? internalOpen
  const visibleRange = isOpen ? draftRange : value

  React.useEffect(() => {
    setDraftRange(value)
    setFromText(formatDateInput(value?.from))
    setToText(formatDateInput(value?.to))
  }, [value])

  const syncInputText = (range?: DateRange) => {
    setFromText(formatDateInput(range?.from))
    setToText(formatDateInput(range?.to))
  }

  const setPopoverOpen = (nextOpen: boolean) => {
    setDraftRange(value)
    syncInputText(value)
    setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const closePopover = () => {
    setInternalOpen(false)
    onOpenChange?.(false)
  }

  const commitRange = (range: DateRange) => {
    setDraftRange(range)
    syncInputText(range)
    onChange?.(range)
    closePopover()
  }

  const updateDraftRange = (range: DateRange | undefined) => {
    setDraftRange(range)
    syncInputText(range)
  }

  const handleInputFocus = (field: ActiveField) => {
    setActiveField(field)
    setInternalOpen(true)
    onOpenChange?.(true)
  }

  const handleInputChange = (field: ActiveField, rawValue: string) => {
    const nextText = maskDateInput(rawValue)
    const currentRange = isOpen ? draftRange : value

    if (field === "from") setFromText(nextText)
    else setToText(nextText)

    if (nextText.length === 0) {
      if (field === "from") {
        updateDraftRange(undefined)
        onChange?.(undefined)
        return
      }

      const nextRange = currentRange?.from ? { from: currentRange.from, to: undefined } : undefined
      updateDraftRange(nextRange)
      onChange?.(nextRange)
      return
    }

    const parsedDate = parseDateInput(nextText)
    if (!parsedDate) return

    if (field === "from") {
      const existingTo = currentRange?.to
      const nextRange = existingTo && !isBefore(existingTo, parsedDate)
        ? { from: parsedDate, to: existingTo }
        : { from: parsedDate, to: undefined }

      setActiveField("to")
      updateDraftRange(nextRange)
      onChange?.(nextRange)
      return
    }

    const existingFrom = currentRange?.from
    const nextRange = existingFrom
      ? isBefore(parsedDate, existingFrom)
        ? { from: parsedDate, to: existingFrom }
        : { from: existingFrom, to: parsedDate }
      : { from: parsedDate, to: undefined }

    updateDraftRange(nextRange)
    onChange?.(nextRange)
  }

  const handleSelectDay = (_range: DateRange | undefined, selectedDay: Date) => {
    if (activeField === "from") {
      const existingTo = draftRange?.to
      const nextRange = existingTo && !isBefore(existingTo, selectedDay)
        ? { from: selectedDay, to: existingTo }
        : { from: selectedDay, to: undefined }

      if (nextRange.to) {
        commitRange(nextRange)
        return
      }

      setActiveField("to")
      updateDraftRange(nextRange)
      return
    }

    if (!draftRange?.from) {
      setActiveField("to")
      updateDraftRange({ from: selectedDay, to: undefined })
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
      <PopoverAnchor asChild>
        <div className={cn("grid w-full min-w-[280px] grid-cols-1 gap-2 sm:grid-cols-2", className)}>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={fromText}
              onChange={(event) => handleInputChange("from", event.target.value)}
              onFocus={() => handleInputFocus("from")}
              onClick={() => handleInputFocus("from")}
              onKeyDown={(event) => {
                if (event.key === "Enter") closePopover()
              }}
              placeholder={fromPlaceholder}
              inputMode="numeric"
              className="pl-9 text-sm"
              aria-label={fromPlaceholder}
            />
          </div>

          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={toText}
              onChange={(event) => handleInputChange("to", event.target.value)}
              onFocus={() => handleInputFocus("to")}
              onClick={() => handleInputFocus("to")}
              onKeyDown={(event) => {
                if (event.key === "Enter") closePopover()
              }}
              placeholder={toPlaceholder}
              inputMode="numeric"
              className="pl-9 text-sm"
              aria-label={toPlaceholder}
            />
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={visibleRange?.from ?? visibleRange?.to}
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
