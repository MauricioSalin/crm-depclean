import { parseCivilDate, toCivilDateKey } from "./date-utils"

function nextDay(value: string) {
  const date = parseCivilDate(value)
  if (!date) return ""
  date.setDate(date.getDate() + 1)
  return toCivilDateKey(date)
}

export function multiDayDateValues(firstDate: string, totalDays: number, dates?: string[]) {
  const values = [firstDate]
  for (let index = 1; index < Math.max(1, Math.ceil(totalDays)); index += 1) {
    const previous = values[index - 1]
    const saved = dates?.[index]
    const followedOriginal = dates?.[0] !== firstDate && saved === nextDay(dates?.[index - 1] ?? "")
    values.push(saved && parseCivilDate(saved) && saved > previous && !followedOriginal ? saved : nextDay(previous))
  }
  return values
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
