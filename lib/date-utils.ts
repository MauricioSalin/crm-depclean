const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/

export function parseCivilDate(value?: string | Date | null) {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }

  const match = String(value).match(CIVIL_DATE_PATTERN)
  if (match) {
    const [, year, month, day] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function formatCivilDate(value?: string | Date | null, fallback = "-") {
  const date = parseCivilDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat("pt-BR").format(date)
}

export function formatCivilLongDate(value?: string | Date | null, fallback = "") {
  const date = parseCivilDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function toCivilDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-")
}
