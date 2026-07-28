"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { DayButton, type Matcher } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type DatePickerProps = {
  value?: Date | null
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
  disabledDates?: Matcher | Matcher[]
  dateTooltip?: (date: Date) => string | undefined
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecionar data",
  ariaLabel,
  className,
  disabled = false,
  disabledDates,
  dateTooltip,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate text-base md:text-sm">
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          defaultMonth={value ?? undefined}
          onSelect={(date) => {
            onChange?.(date)
            if (date) setOpen(false)
          }}
          disabled={disabledDates}
          showOutsideDays={false}
          locale={ptBR}
          components={dateTooltip ? {
            DayButton: (props) => (
              <DatePickerDayButton
                {...props}
                tooltip={dateTooltip(props.day.date)}
              />
            ),
          } : undefined}
        />
      </PopoverContent>
    </Popover>
  )
}

function DatePickerDayButton({
  tooltip,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  tooltip?: string
}) {
  const button = <CalendarDayButton {...props} />
  if (!tooltip) return button

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span className="block size-full">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
