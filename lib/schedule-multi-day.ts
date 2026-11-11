import { addCivilDaysKey, parseCivilDate, toCivilDateKey } from "./date-utils"

const WORK_DAY_MINUTES = 480

export function multiDayDurationValues(totalDays: number, durations?: number[]) {
  return Array.from({ length: Math.max(1, Math.ceil(totalDays)) }, (_, index) => durations?.[index] ?? WORK_DAY_MINUTES)
}

function nextDay(value: string) {
  const date = parseCivilDate(value)
  if (!date) return ""
  date.setDate(date.getDate() + 1)
  return toCivilDateKey(date)
}

export function multiDayDateValues(firstDate: string, totalDays: number, dates?: string[], spans?: number[]) {
  const values = [firstDate]
  for (let index = 1; index < Math.max(1, Math.ceil(totalDays)); index += 1) {
    const previous = values[index - 1]
    const saved = dates?.[index]
    const span = spans?.[index - 1] ?? 1
    const nextDate = span > 1 && previous ? addCivilDaysKey(previous, span) : nextDay(previous)
    const followedOriginal = dates?.[0] !== firstDate && saved === nextDay(dates?.[index - 1] ?? "")
    values.push(saved && parseCivilDate(saved) && saved >= nextDate && !followedOriginal ? saved : nextDate)
  }
  return values
}

export function multiDayEntrySpans(totalDays: number, durations: number[] | undefined, entriesInDays: ReadonlySet<number>) {
  const spans: number[] = []
  let daysLeft = Math.ceil(totalDays)
  while (daysLeft > 0) {
    const minutes = durations?.[spans.length] ?? 0
    const span = entriesInDays.has(spans.length) ? multiDayEntrySpan(minutes) : 1
    spans.push(span)
    daysLeft -= span
  }
  return spans
}

export function multiDayEntrySpan(minutes: number) {
  return minutes > WORK_DAY_MINUTES && minutes % WORK_DAY_MINUTES === 0 ? minutes / WORK_DAY_MINUTES : 1
}

export function expandMultiDayEntries(dates: string[], times: string[], durations: number[], spans: number[]) {
  const entries = dates.flatMap((date, index) => Array.from({ length: spans[index] }, (_, offset) => ({
    date: offset ? addCivilDaysKey(date, offset) : date,
    time: times[index],
    duration: spans[index] > 1 ? WORK_DAY_MINUTES : durations[index],
  })))
  return {
    multiDayDates: entries.map((entry) => entry.date),
    multiDayTimes: entries.map((entry) => entry.time),
    multiDayDurations: entries.map((entry) => entry.duration),
  }
}

export function multiDayTimeValues(firstTime: string, totalDays: number, times?: string[]) {
  const original = /^([01]\d|2[0-3]):[0-5]\d$/.test(firstTime) ? firstTime : "08:00"
  const values = [original]
  for (let index = 1; index < Math.max(1, Math.ceil(totalDays)); index += 1) {
    const saved = times?.[index]
    values.push(times?.[0] !== original && saved === times?.[0] ? original : saved && /^([01]\d|2[0-3]):[0-5]\d$/.test(saved) ? saved : values[index - 1])
  }
  return values
}
