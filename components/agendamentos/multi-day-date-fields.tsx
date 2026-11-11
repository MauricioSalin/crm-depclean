"use client"

import { useEffect, useId, type ComponentProps } from "react"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScheduleDurationInput } from "@/components/agendamentos/schedule-duration-input"
import { addCivilDaysKey, parseCivilDate, toCivilDateKey } from "@/lib/date-utils"
import { scheduleDurationToMinutes } from "@/lib/schedule-duration"

import { multiDayDateValues, multiDayTimeValues, multiDayDurationValues } from "@/lib/schedule-multi-day"
export { multiDayDateValues, multiDayTimeValues, multiDayDurationValues } from "@/lib/schedule-multi-day"

export type VisitDurationType = "hours" | "days"

type VisitDuration = {
  type: VisitDurationType
  minutes: number
  maxDays: number
  readOnly?: boolean
  onChange: (minutes: number, type: VisitDurationType) => void
}

export function ScheduleDayRow({ day, date, time, duration, onDateChange, onTimeChange, disabledDates, disabled }: {
  day: number
  date: string
  time: string
  duration?: VisitDuration
  onDateChange: (date: Date | undefined) => void
  onTimeChange: (time: string) => void
  disabledDates?: ComponentProps<typeof DatePicker>["disabledDates"]
  disabled?: boolean
}) {
  const id = useId()
  const isDisabled = disabled || duration?.readOnly
  return <div className={`grid grid-cols-2 items-end gap-3 ${duration ? "sm:grid-cols-[minmax(8rem,1.2fr)_minmax(6rem,1fr)_minmax(7rem,1fr)_minmax(4rem,0.7fr)]" : ""}`}>
    <span className="col-span-full text-sm font-medium">Dia {day}</span>
    <div className="min-w-0 space-y-2">
      <Label>Data</Label>
      <DatePicker value={parseCivilDate(date)} disabled={isDisabled} ariaLabel={`Dia ${day}`} disabledDates={disabledDates} onChange={onDateChange} />
    </div>
    <div className="min-w-0 space-y-2">
      <Label htmlFor={`${id}-time`}>Horário</Label>
      <Input id={`${id}-time`} type="time" aria-label={`Horário do Dia ${day}`} value={time} disabled={isDisabled} required
        onChange={(event) => onTimeChange(event.target.value)} />
    </div>
    {duration && <>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={`${id}-type`}>Tipo de duração</Label>
        <Select value={duration.type} disabled={isDisabled} onValueChange={(value) => {
          const type = value as VisitDurationType
          const minutesPerDay = scheduleDurationToMinutes(1, "days")
          const minutes = type === "days" ? Math.ceil(duration.minutes / minutesPerDay) * minutesPerDay : duration.minutes
          duration.onChange(minutes, type)
        }}>
          <SelectTrigger id={`${id}-type`} className="w-full" aria-label={`Tipo de duração do Dia ${day}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hours">Horas</SelectItem>
            <SelectItem value="days">Dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${id}-duration`}>Duração</Label>
        <NumericInput id={`${id}-duration`} aria-label={`Duração do Dia ${day}`} disabled={isDisabled}
          value={Number((duration.minutes / scheduleDurationToMinutes(1, duration.type)).toFixed(2))}
          allowDecimal={duration.type === "hours"} min={duration.type === "hours" ? 1 / 60 : 1} max={duration.type === "hours" ? 24 : duration.maxDays}
          onValueChange={(value) => duration.onChange(scheduleDurationToMinutes(value, duration.type), duration.type)} />
      </div>
    </>}
  </div>
}

export function MultiDayDateFields({ firstDate, firstTime, totalDays, dates, times, durations, spans, onChange, onTimesChange, onDurationsChange, visitDuration, disabled, maxDate }: {
  firstDate: string
  firstTime: string
  totalDays: number
  dates?: string[]
  times?: string[]
  durations?: number[]
  spans?: number[]
  onChange: (dates: string[]) => void
  onTimesChange: (times: string[]) => void
  onDurationsChange?: (durations: number[]) => void
  visitDuration?: (index: number, minutes: number) => VisitDuration
  disabled?: boolean
  maxDate?: string
}) {
  const id = useId()
  const values = multiDayDateValues(firstDate, totalDays, dates, spans)
  const timeValues = multiDayTimeValues(firstTime, totalDays, times)
  const durationValues = multiDayDurationValues(totalDays, durations)
  useEffect(() => {
    if (totalDays <= 1 || !firstDate || disabled) return
    if (JSON.stringify(dates) !== JSON.stringify(values)) onChange(values)
    if (JSON.stringify(times) !== JSON.stringify(timeValues)) onTimesChange(timeValues)
    if (onDurationsChange && JSON.stringify(durations) !== JSON.stringify(durationValues)) onDurationsChange(durationValues)
  }, [totalDays, firstDate, disabled, dates, times, durations, values, timeValues, durationValues, onChange, onTimesChange, onDurationsChange])
  if (totalDays <= 1) return null
  const disabledDate = (date: Date, previous: number) => {
    const key = toCivilDateKey(date)
    const end = values[previous] && addCivilDaysKey(values[previous], (spans?.[previous] ?? 1) - 1)
    return key <= end || Boolean(maxDate && key >= maxDate)
  }
  const changeDate = (date: Date | undefined, index: number) => {
    if (!date) return
    onChange(multiDayDateValues(firstDate, totalDays, values.map((current, position) => position === index ? toCivilDateKey(date) : current), spans))
  }
  const changeTime = (time: string, index: number) => {
    if (time) onTimesChange(timeValues.map((current, position) => position === index ? time : current))
  }
  if (visitDuration) return <div className="space-y-6">
    {values.slice(1).map((date, index) => <ScheduleDayRow key={index} day={index + 2} date={date} time={timeValues[index + 1]}
      duration={visitDuration(index + 1, durationValues[index + 1])} disabled={disabled}
      disabledDates={(value) => disabledDate(value, index)} onDateChange={(value) => changeDate(value, index + 1)}
      onTimeChange={(value) => changeTime(value, index + 1)} />)}
  </div>
  return <section aria-label="Dias adicionais do atendimento" className="min-w-0 rounded-xl border border-border p-4">
    <div className="space-y-4">
      {values.slice(1).map((value, index) => <div key={index} className={`grid grid-cols-2 gap-4 ${onDurationsChange ? "sm:grid-cols-3 sm:items-end" : ""}`}>
        <div className="min-w-0 space-y-2">
          <Label>Dia {index + 2}</Label>
          <DatePicker value={parseCivilDate(value)} disabled={disabled} ariaLabel={`Dia ${index + 2}`}
            disabledDates={(date) => disabledDate(date, index)} onChange={(date) => changeDate(date, index + 1)} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${id}-${index}-time`}>Horário</Label>
          <Input id={`${id}-${index}-time`} type="time" aria-label={`Horário do Dia ${index + 2}`} disabled={disabled}
            value={timeValues[index + 1]} onChange={(event) => changeTime(event.target.value, index + 1)} />
        </div>
        {onDurationsChange ? <div className="col-span-2 min-w-0 space-y-2 sm:col-span-1">
          <Label htmlFor={`${id}-duration-${index + 2}`}>Duração do Dia {index + 2}</Label>
          <ScheduleDurationInput id={`${id}-duration-${index + 2}`} unit="horas" allowDecimal min={1 / 60} max={24} value={durationValues[index + 1] / 60} disabled={disabled}
            onValueChange={(hours) => onDurationsChange(durationValues.map((current, position) => position === index + 1 ? Math.max(1, Math.round(hours * 60)) : current))} />
        </div> : null}
      </div>)}
    </div>
  </section>
}
