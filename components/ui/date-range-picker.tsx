"use client"

import * as React from "react"
import { format, isBefore, isValid, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"
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

function setRangeField(
  range: DateRange | undefined,
  field: ActiveField,
  date: Date | undefined,
): DateRange | undefined {
  const from = field === "from" ? date : range?.from
  const to = field === "to" ? date : range?.to

  return from || to ? { from, to } : undefined
}

function getCalendarRange(range: DateRange | undefined): DateRange | undefined {
  const from = range?.from
  const to = range?.to

  if (!from && to) return { from: to, to }
  if (from && to && isBefore(to, from)) return { from: to, to: from }
  return range
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
  const activeFieldRef = React.useRef<ActiveField>("from")
  const fromInputRef = React.useRef<HTMLInputElement>(null)
  const toInputRef = React.useRef<HTMLInputElement>(null)
  const isOpen = open ?? internalOpen
  const visibleRange = isOpen ? draftRange : value
  const calendarRange = getCalendarRange(visibleRange)

  React.useEffect(() => {
    setDraftRange(value)
    setFromText(formatDateInput(value?.from))
    setToText(formatDateInput(value?.to))
  }, [value])

  const syncInputText = (range?: DateRange) => {
    setFromText(formatDateInput(range?.from))
    setToText(formatDateInput(range?.to))
  }

  const setActiveDateField = (field: ActiveField) => {
    activeFieldRef.current = field
  }

  const focusDateInput = (field = activeFieldRef.current) => {
    window.requestAnimationFrame(() => {
      const input = field === "from" ? fromInputRef.current : toInputRef.current
      input?.focus({ preventScroll: true })
    })
  }

  const setPopoverOpen = (nextOpen: boolean) => {
    if (nextOpen && !isOpen) {
      setDraftRange(value)
      syncInputText(value)
    }
    setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
    if (nextOpen) focusDateInput()
  }

  const closePopover = () => {
    setInternalOpen(false)
    onOpenChange?.(false)
  }

  const commitRange = (range: DateRange | undefined) => {
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
    setActiveDateField(field)
    setInternalOpen(true)
    onOpenChange?.(true)
  }

  const handleInputClick = (field: ActiveField) => {
    setActiveDateField(field)
    setInternalOpen(true)
    onOpenChange?.(true)
    focusDateInput(field)
  }

  const handleInputChange = (field: ActiveField, rawValue: string) => {
    const nextText = maskDateInput(rawValue)
    const currentRange = isOpen ? draftRange : value

    if (field === "from") setFromText(nextText)
    else setToText(nextText)

    if (nextText.length === 0) {
      const nextRange = setRangeField(currentRange, field, undefined)
      updateDraftRange(nextRange)
      onChange?.(nextRange)
      return
    }

    const parsedDate = parseDateInput(nextText)
    if (!parsedDate) return

    const nextRange = setRangeField(currentRange, field, parsedDate)

    updateDraftRange(nextRange)
    onChange?.(nextRange)

    if (field === "from") setActiveDateField("to")
  }

  const clearDateField = (field: ActiveField) => {
    const currentRange = isOpen ? draftRange : value
    setActiveDateField(field)

    const nextRange = setRangeField(currentRange, field, undefined)
    updateDraftRange(nextRange)
    onChange?.(nextRange)
  }

  const handleSelectDay = (_range: DateRange | undefined, selectedDay: Date) => {
    const field = activeFieldRef.current
    const nextRange = setRangeField(draftRange, field, selectedDay)

    if (field === "from" && !nextRange?.to) {
      setActiveDateField("to")
      updateDraftRange(nextRange)
      onChange?.(nextRange)
      return
    }

    if (field === "to" && !nextRange?.from) {
      setActiveDateField("from")
      updateDraftRange(nextRange)
      onChange?.(nextRange)
      return
    }

    commitRange(nextRange)
  }

  return (
    <div className={cn("-m-1 overflow-visible p-1", className)}>
      <Popover open={isOpen} onOpenChange={setPopoverOpen}>
        <PopoverAnchor asChild>
          <div className="grid w-full min-w-[320px] grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="relative focus-within:z-[70]">
              <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={fromInputRef}
                value={fromText}
                onChange={(event) => handleInputChange("from", event.target.value)}
                onFocus={() => handleInputFocus("from")}
                onClick={() => handleInputClick("from")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") closePopover()
                }}
                placeholder={fromPlaceholder}
                inputMode="numeric"
                className="pl-9 pr-9 text-sm"
                aria-label={fromPlaceholder}
              />
              {fromText ? (
                <button
                type="button"
                aria-label="Limpar data inicial"
                className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation()
                  clearDateField("from")
                }}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="relative focus-within:z-[70]">
              <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={toInputRef}
                value={toText}
                onChange={(event) => handleInputChange("to", event.target.value)}
                onFocus={() => handleInputFocus("to")}
                onClick={() => handleInputClick("to")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") closePopover()
                }}
                placeholder={toPlaceholder}
                inputMode="numeric"
                className="pl-9 pr-9 text-sm"
                aria-label={toPlaceholder}
              />
              {toText ? (
                <button
                type="button"
                aria-label="Limpar data final"
                className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation()
                  clearDateField("to")
                }}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            focusDateInput()
          }}
        >
          <Calendar
            mode="range"
            defaultMonth={calendarRange?.from ?? calendarRange?.to}
            selected={calendarRange}
            onSelect={handleSelectDay}
            numberOfMonths={isMobile ? 1 : 2}
            showOutsideDays={false}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
