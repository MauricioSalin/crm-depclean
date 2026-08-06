import type { ServiceRecord } from "@/lib/api/services"

export type ScheduleDurationType = ServiceRecord["durationType"]

export const SCHEDULE_DURATION_TYPE_OPTIONS: Array<{ value: ScheduleDurationType; label: string }> = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "shift", label: "Turno" },
  { value: "days", label: "Dias" },
]

const DURATION_TYPE_MINUTES: Record<ScheduleDurationType, number> = {
  minutes: 1,
  hours: 60,
  shift: 4 * 60,
  days: 8 * 60,
}

export function scheduleDurationToMinutes(duration: number, durationType: ScheduleDurationType) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  return Math.max(1, Math.round(safeDuration * DURATION_TYPE_MINUTES[durationType]))
}

export function normalizeScheduleDurationForIntegerInput(
  duration: number,
  durationType: ScheduleDurationType,
) {
  const durationMinutes = scheduleDurationToMinutes(duration, durationType)
  if (Number.isInteger(duration) && duration >= 1) {
    return { durationValue: duration, durationType, durationMinutes }
  }

  return {
    durationValue: durationMinutes,
    durationType: "minutes" as const,
    durationMinutes,
  }
}

export function normalizeAutomatedScheduleDuration(durationMinutes: number) {
  const exactMinutes = Math.max(1, Math.round(Number(durationMinutes) || 1))
  if (exactMinutes >= DURATION_TYPE_MINUTES.days) {
    const durationValue = Math.ceil(exactMinutes / DURATION_TYPE_MINUTES.days)
    return {
      durationValue,
      durationType: "days" as const,
      durationMinutes: durationValue * DURATION_TYPE_MINUTES.days,
    }
  }
  if (exactMinutes % DURATION_TYPE_MINUTES.hours === 0) {
    return {
      durationValue: exactMinutes / DURATION_TYPE_MINUTES.hours,
      durationType: "hours" as const,
      durationMinutes: exactMinutes,
    }
  }
  return {
    durationValue: exactMinutes,
    durationType: "minutes" as const,
    durationMinutes: exactMinutes,
  }
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

export function scheduleDurationForEditing(schedule: {
  duration: number
  durationValue?: number
  durationType?: ScheduleDurationType
}, service?: Pick<ServiceRecord, "durationType" | "defaultDuration">) {
  const configuredDuration = Number(schedule.durationValue)
  const configuredType = schedule.durationType

  if (configuredType && Number.isFinite(configuredDuration) && configuredDuration > 0) {
    const normalized = normalizeScheduleDurationForIntegerInput(configuredDuration, configuredType)
    return {
      durationType: normalized.durationType,
      duration: normalized.durationValue,
    }
  }

  return minutesToScheduleDuration(schedule.duration, service)
}

function formatDurationAmount(value: number) {
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(2))).replace(".", ",")
}

function formatHoursAndMinutes(value: number) {
  const totalMinutes = Math.max(0, Math.round(value * DURATION_TYPE_MINUTES.hours))
  const hours = Math.floor(totalMinutes / DURATION_TYPE_MINUTES.hours)
  const minutes = totalMinutes % DURATION_TYPE_MINUTES.hours
  const parts: string[] = []

  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`)
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`)

  return parts.join(" e ") || "0 minutos"
}

export function formatExactScheduleDuration(durationMinutes: number) {
  const normalizedMinutes = Math.max(0, Math.round(Number(durationMinutes) || 0))
  return formatHoursAndMinutes(normalizedMinutes / DURATION_TYPE_MINUTES.hours)
}

export function formatBusinessScheduleDuration(durationMinutes: number) {
  const totalMinutes = Math.max(0, Math.round(Number(durationMinutes) || 0))
  const days = Math.floor(totalMinutes / DURATION_TYPE_MINUTES.days)
  const remainingMinutes = totalMinutes % DURATION_TYPE_MINUTES.days
  const hours = Math.floor(remainingMinutes / DURATION_TYPE_MINUTES.hours)
  const minutes = remainingMinutes % DURATION_TYPE_MINUTES.hours
  const parts: string[] = []

  if (days > 0) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`)
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`)
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`)

  return parts.join(" e ") || "0 minutos"
}

function formatScheduleDurationValueByType(value: number, type: ScheduleDurationType) {
  if (type === "hours") return formatHoursAndMinutes(value)

  const amount = formatDurationAmount(value)
  if (type === "minutes") return `${amount} ${value === 1 ? "minuto" : "minutos"}`
  if (type === "days") return `${amount} ${value === 1 ? "dia" : "dias"}`
  if (type === "shift") return `${amount} ${value === 1 ? "turno" : "turnos"}`
  return `${amount} horas`
}

export function formatScheduleDurationValue(value: number, type: ScheduleDurationType) {
  const totalMinutes = Math.max(0, Math.round(value * DURATION_TYPE_MINUTES[type]))
  if (totalMinutes >= DURATION_TYPE_MINUTES.days) return formatBusinessScheduleDuration(totalMinutes)
  return formatScheduleDurationValueByType(value, type)
}

function inferDurationTypeFromMinutes(minutes: number): ScheduleDurationType {
  if (!Number.isFinite(minutes) || minutes <= 0) return "hours"
  if (minutes % DURATION_TYPE_MINUTES.days === 0) return "days"
  if (minutes % DURATION_TYPE_MINUTES.shift === 0) return "shift"
  if (minutes % DURATION_TYPE_MINUTES.hours === 0) return "hours"
  return "minutes"
}

export function formatConfiguredScheduleDuration(schedule: {
  duration: number
  durationValue?: number
  durationType?: ScheduleDurationType
}, preserveConfiguredType = false) {
  const value = Number(schedule.durationValue)
  const type = schedule.durationType

  if (Number.isFinite(value) && value >= 1 && type) {
    if (type === "minutes" && value >= DURATION_TYPE_MINUTES.hours && value % DURATION_TYPE_MINUTES.hours !== 0) {
      return formatHoursAndMinutes(value / DURATION_TYPE_MINUTES.hours)
    }
    if (preserveConfiguredType) return formatScheduleDurationValueByType(value, type)
    return formatScheduleDurationValue(value, type)
  }

  const minutes = Number(schedule.duration ?? 0)
  if (Number.isFinite(minutes) && minutes > 0) {
    const fallbackType = inferDurationTypeFromMinutes(minutes)
    return formatScheduleDurationValue(minutes / DURATION_TYPE_MINUTES[fallbackType], fallbackType)
  }

  return "0 min"
}
