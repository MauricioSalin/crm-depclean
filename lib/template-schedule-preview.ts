import type { ScheduleRecord } from "./api/schedules"
import type { TemplateKind } from "./api/templates"

export function buildTemplateSchedulePreviewOptions(schedules: ScheduleRecord[], kind: TemplateKind, formatDate: (date: string) => string) {
  const groups = new Map<string, ScheduleRecord[]>()
  if (kind === "contract") return []
  for (const schedule of schedules) {
    if (kind === "informative"
      ? !["draft", "scheduled", "rescheduled", "in_progress"].includes(schedule.status)
      : schedule.status === "cancelled") continue
    const key = schedule.multiDayGroupId ? `group:${schedule.unitId}:${schedule.multiDayGroupId}` : `schedule:${schedule.id}`
    const visits = groups.get(key) ?? []
    visits.push(schedule)
    groups.set(key, visits)
  }
  return [...groups.values()].map((visits) => {
    visits.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    const first = visits[0]!
    const dates = visits.length === 1 && first.multiDayDates?.length && !first.multiDayGroupId
      ? first.multiDayDates.map((date, index) => ({ date, time: first.multiDayTimes?.[index] || first.time }))
      : visits.map(({ date, time }) => ({ date, time }))
    const formatter = new Intl.ListFormat("pt-BR")
    const timeValues = dates.map(({ time }) => (time || "08:00").replace(":00", "h"))
    return {
      value: first.id,
      label: `${dates.map(({ date }) => formatDate(date)).join(" e ")} - ${first.serviceTypeName} - ${first.unitName}`,
      dateText: formatter.format([...new Set(dates.map(({ date }) => formatDate(date)))]),
      timeText: new Set(timeValues).size === 1 ? timeValues[0] : formatter.format(dates.map(({ date }, index) => `${timeValues[index]} em ${formatDate(date)}`)),
      datesText: kind === "certificate"
        ? formatter.format(dates.map(({ date }) => formatDate(date)))
        : dates.map(({ date, time }) => `${formatDate(date)} - ${time || "08:00"}`).join("\n"),
    }
  })
}

function tokenRegex(token: string) {
  return new RegExp(token.split("").map(character => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(?:<[^>]+>)*"), "g")
}

export function prepareSchedulePreviewContext(variables: Record<string, string>, xmlFiles: string[]) {
  const usesDetailedDates = xmlFiles.some(xml => /\{\{\s*schedule\.datesText\s*\}\}/.test(xml.replace(/<[^>]+>/g, "")))
  const useLegacyDates = Boolean(variables["schedule.legacyDateText"]) && !usesDetailedDates
  return {
    variables: useLegacyDates ? {
      ...variables,
      "schedule.date": variables["schedule.legacyDateText"],
      "schedule.time": variables["schedule.legacyTimeText"] || variables["schedule.time"],
    } : variables,
    pluralize: useLegacyDates && variables["schedule.legacyDateText"] !== variables["schedule.date"],
  }
}

export function renderSchedulePreviewXml(sourceXml: string, context: ReturnType<typeof prepareSchedulePreviewContext>) {
  let xml = sourceXml
  if (context.pluralize) {
    xml = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) =>
      /\{\{\s*schedule\.date\s*\}\}/.test(paragraph.replace(/<[^>]+>/g, ""))
        ? paragraph.replace(tokenRegex("no dia"), "nos dias")
        : paragraph)
  }
  for (const field of ["schedule.date", "schedule.time", "schedule.datesText"]) {
    const value = context.variables[field]
    if (!value) continue
    const replacement = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/\r?\n/g, "</w:t><w:br/><w:t>")
    for (const token of [`{{${field}}}`, `{{ ${field} }}`]) xml = xml.replace(tokenRegex(token), replacement)
  }
  return xml
}
