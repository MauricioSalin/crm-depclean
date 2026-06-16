const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/
export const BRASILIA_TIME_ZONE = "America/Sao_Paulo"

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRASILIA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BRASILIA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function parseCivilDate(value?: string | Date | null) {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return parseCivilDate(toCivilDateKey(value))
  }

  const match = String(value).match(CIVIL_DATE_PATTERN)
  if (match) {
    const [, year, month, day] = match
    return new Date(`${year}-${month}-${day}T00:00:00-03:00`)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function formatCivilDate(value?: string | Date | null, fallback = "-") {
  const date = parseCivilDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat("pt-BR", { timeZone: BRASILIA_TIME_ZONE }).format(date)
}

export function formatCivilLongDate(value?: string | Date | null, fallback = "") {
  const date = parseCivilDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRASILIA_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function toCivilDateKey(value: Date) {
  return dateKeyFormatter.format(value)
}

export function toBrasiliaTimeKey(value: Date) {
  return timeFormatter.format(value)
}

export function minutesFromBrasiliaDate(value: Date) {
  const [hours = 0, minutes = 0] = toBrasiliaTimeKey(value).split(":").map((part) => Number(part))
  return hours * 60 + minutes
}

export function addCivilDaysKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value))
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1))
  date.setUTCDate(date.getUTCDate() + days)
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

export function addCivilMonthsKey(dateKey: string, months: number) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value))
  const date = new Date(Date.UTC(year, (month || 1) - 1 + months, day || 1))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-")
}
