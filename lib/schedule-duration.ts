import type { ServiceRecord } from "@/lib/api/services"

export type ScheduleDurationType = ServiceRecord["durationType"]

export const SCHEDULE_DURATION_TYPE_OPTIONS: Array<{ value: ScheduleDurationType; label: string }> = [
  { value: "hours", label: "Horas" },
  { value: "shift", label: "Turno" },
  { value: "days", label: "Dias" },
]

const DURATION_TYPE_MINUTES: Record<ScheduleDurationType, number> = {
  hours: 60,
  shift: 4 * 60,
  days: 8 * 60,
}

export function scheduleDurationToMinutes(duration: number, durationType: ScheduleDurationType) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  return Math.max(1, Math.round(safeDuration * DURATION_TYPE_MINUTES[durationType]))
}

export function minutesToScheduleDuration(minutes: number, service?: Pick<ServiceRecord, "durationType" | "defaultDuration">) {
  const safeMinutes = Number(minutes)
  const serviceDurationType = service?.durationType ?? "hours"
  const serviceDuration = Number(service?.defaultDuration)
  const durationType = Number.isFinite(serviceDuration) &&
    serviceDuration >= 1 &&
    Math.round(scheduleDurationToMinutes(serviceDuration, serviceDurationType)) === Math.round(safeMinutes)
    ? serviceDurationType
    : inferDurationTypeFromMinutes(safeMinutes)
  const divisor = DURATION_TYPE_MINUTES[durationType]
  const duration = safeMinutes > 0
    ? Number((safeMinutes / divisor).toFixed(2))
    : service?.defaultDuration ?? 1

  return {
    durationType,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 1,
  }
}

function formatDurationAmount(value: number) {
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(2))).replace(".", ",")
}

function formatDurationByType(value: number, type: ScheduleDurationType) {
  const amount = formatDurationAmount(value)
  if (type === "days") return `${amount} ${value === 1 ? "dia" : "dias"}`
  if (type === "shift") return `${amount} ${value === 1 ? "turno" : "turnos"}`
  return `${amount} ${value === 1 ? "hora" : "horas"}`
}

function inferDurationTypeFromMinutes(minutes: number): ScheduleDurationType {
  if (!Number.isFinite(minutes) || minutes <= 0) return "hours"
  if (minutes % DURATION_TYPE_MINUTES.days === 0) return "days"
  if (minutes % DURATION_TYPE_MINUTES.shift === 0) return "shift"
  return "hours"
}

export function formatConfiguredScheduleDuration(schedule: {
  duration: number
  durationValue?: number
  durationType?: ScheduleDurationType
}) {
  const value = Number(schedule.durationValue)
  const type = schedule.durationType

  if (Number.isFinite(value) && value >= 1 && type) {
    return formatDurationByType(value, type)
  }

  const minutes = Number(schedule.duration ?? 0)
  if (Number.isFinite(minutes) && minutes > 0) {
    const fallbackType = inferDurationTypeFromMinutes(minutes)
    return formatDurationByType(minutes / DURATION_TYPE_MINUTES[fallbackType], fallbackType)
  }

  return "0 min"
}
