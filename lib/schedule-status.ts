import type { ScheduleRecord } from "@/lib/api/schedules"

export type ScheduleStatus = ScheduleRecord["status"]
export type ScheduleStatusFilter = ScheduleStatus | "all"

export const SCHEDULE_STATUS_FILTER_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
  { value: "rescheduled", label: "Reagendado" },
] satisfies Array<{ value: ScheduleStatus; label: string }>

const SCHEDULE_STATUS_FILTER_VALUES = new Set<string>([
  "all",
  ...SCHEDULE_STATUS_FILTER_OPTIONS.map((option) => option.value),
])

export function normalizeScheduleStatusFilter(value: string): ScheduleStatusFilter {
  return SCHEDULE_STATUS_FILTER_VALUES.has(value) ? value as ScheduleStatusFilter : "all"
}
