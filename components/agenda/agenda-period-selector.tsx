"use client"

import { useMemo, useState } from "react"
import { ptBR } from "date-fns/locale"
import { CalendarDays } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

const MONTH_LABELS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const

type AgendaPeriodSelectorProps = {
  date: Date
  label: string
  mode: "month" | "day"
  onSelect: (date: Date) => void
  variant?: "heading" | "filter"
  ariaLabel?: string
  triggerClassName?: string
}

export function AgendaPeriodSelector({
  date,
  label,
  mode,
  onSelect,
  variant = "heading",
  ariaLabel,
  triggerClassName,
}: AgendaPeriodSelectorProps) {
  const dateKey = toCivilDateKey(date)
  const displayedYear = Number(dateKey.slice(0, 4))
  const displayedMonth = Number(dateKey.slice(5, 7)) - 1
  const [open, setOpen] = useState(false)
  const [periodMonth, setPeriodMonth] = useState(displayedMonth)
  const [periodYear, setPeriodYear] = useState(displayedYear)
  const periodYearOptions = useMemo(
    () => Array.from({ length: 51 }, (_, index) => displayedYear - 25 + index),
    [displayedYear],
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPeriodMonth(displayedMonth)
      setPeriodYear(displayedYear)
    }
    setOpen(nextOpen)
  }

  const selectMonth = (month: number) => {
    const monthStart = parseCivilDate(`${periodYear}-${String(month + 1).padStart(2, "0")}-01`)
    if (!monthStart) return

    setPeriodMonth(month)
    onSelect(monthStart)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${ariaLabel ?? (mode === "day" ? "Selecionar dia, mês e ano" : "Selecionar mês e ano")}: ${label}`}
          className={cn(
            variant === "filter"
              ? "flex h-9 w-full cursor-pointer items-center rounded-md border border-input bg-background px-3 text-left text-sm font-normal shadow-xs transition-colors hover:bg-muted/50 data-[state=open]:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              : "cursor-pointer rounded-md px-2 py-2 text-base font-semibold capitalize leading-none transition-colors hover:bg-muted/70 data-[state=open]:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            triggerClassName,
          )}
        >
          {variant === "filter" ? <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          <span className="truncate">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "filter" ? "start" : "center"} className={mode === "day" ? "w-auto p-0" : "w-[252px] p-2"}>
        {mode === "day" ? (
          <Calendar
            key={dateKey}
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(selectedDate) => {
              if (!selectedDate) return
              onSelect(selectedDate)
              setOpen(false)
            }}
            showOutsideDays={false}
            captionLayout="dropdown"
            startMonth={parseCivilDate(`${displayedYear - 25}-01-01`) ?? undefined}
            endMonth={parseCivilDate(`${displayedYear + 25}-12-01`) ?? undefined}
            locale={ptBR}
          />
        ) : (
          <>
            <Select value={String(periodYear)} onValueChange={(year) => setPeriodYear(Number(year))}>
              <SelectTrigger aria-label="Ano" className="mb-2 w-full cursor-pointer data-[state=open]:bg-muted/70">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {periodYearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)} className="cursor-pointer">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-1">
              {MONTH_LABELS_SHORT.map((month, index) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => selectMonth(index)}
                  className={`h-8 cursor-pointer rounded-md px-2 text-xs font-medium transition-colors ${
                    periodMonth === index
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
