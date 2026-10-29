"use client"

import { useEffect, useId } from "react"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseCivilDate, toCivilDateKey } from "@/lib/date-utils"

import { multiDayDateValues, multiDayTimeValues } from "@/lib/schedule-multi-day"
export { multiDayDateValues, multiDayTimeValues } from "@/lib/schedule-multi-day"

export function MultiDayDateFields({ firstDate, firstTime, totalDays, dates, times, onChange, onTimesChange, disabled, maxDate }: {
  firstDate: string
  firstTime: string
  totalDays: number
  dates?: string[]
  times?: string[]
  onChange: (dates: string[]) => void
  onTimesChange: (times: string[]) => void
  disabled?: boolean
  maxDate?: string
}) {
  const id = useId()
  const values = multiDayDateValues(firstDate, totalDays, dates)
  const timeValues = multiDayTimeValues(firstTime, totalDays, times)
  useEffect(() => {
    if (totalDays <= 1 || !firstDate || disabled) return
    if (JSON.stringify(dates) !== JSON.stringify(values)) onChange(values)
    if (JSON.stringify(times) !== JSON.stringify(timeValues)) onTimesChange(timeValues)
  }, [totalDays, firstDate, disabled, dates, times, values, timeValues, onChange, onTimesChange])
  if (totalDays <= 1) return null
  return <section aria-label="Dias adicionais do atendimento" className="min-w-0 rounded-xl border border-border p-4">
    <div className="space-y-4">
      {values.slice(1).map((value, index) => <div key={index} className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-2">
          <Label>Dia {index + 2}</Label>
          <DatePicker value={parseCivilDate(value)} disabled={disabled} ariaLabel={`Dia ${index + 2}`}
            disabledDates={(date) => { const key = toCivilDateKey(date); return key <= values[index] || Boolean(maxDate && key >= maxDate) }}
            onChange={(date) => { if (date) onChange(multiDayDateValues(firstDate, totalDays, values.map((current, position) => position === index + 1 ? toCivilDateKey(date) : current))) }} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${id}-${index}-time`}>Horário</Label>
          <Input id={`${id}-${index}-time`} type="time" aria-label={`Horário do Dia ${index + 2}`} disabled={disabled}
            value={timeValues[index + 1]} onChange={(event) => { if (event.target.value) onTimesChange(timeValues.map((current, position) => position === index + 1 ? event.target.value : current)) }} />
        </div>
      </div>)}
    </div>
  </section>
}
