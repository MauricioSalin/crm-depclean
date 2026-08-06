import type { ScheduleRecord } from "@/lib/api/schedules"
import { addCivilDaysKey } from "@/lib/date-utils"
import { formatConfiguredScheduleDuration, formatExactScheduleDuration } from "@/lib/schedule-duration"

type ScheduleDisplaySource = Pick<
  ScheduleRecord,
  | "status"
  | "date"
  | "time"
  | "duration"
  | "durationValue"
  | "durationType"
  | "completionStartDate"
  | "completionStartTime"
  | "completionEndDate"
  | "completionEndTime"
>

export type ScheduleDisplayPeriod = {
  date: string
  time: string
  endDate: string
  endTime: string
  durationMinutes: number
  usesExecutionPeriod: boolean
}

export type ScheduleDisplaySegment = {
  date: string
  time: string
  durationMinutes: number
}

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function civilDateTimeToMinutes(date: string, time: string) {
  if (!CIVIL_DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) return null

  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const timestamp = Date.UTC(year, month - 1, day, hour, minute)

  if (!Number.isFinite(timestamp)) return null
  return Math.round(timestamp / 60_000)
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

export function resolveScheduleDisplayPeriod(schedule: ScheduleDisplaySource): ScheduleDisplayPeriod {
  const plannedDuration = Math.max(0, Math.round(Number(schedule.duration) || 0))
  const plannedTime = TIME_PATTERN.test(schedule.time || "") ? schedule.time : "08:00"

  if (schedule.status === "completed") {
    const startDate = schedule.completionStartDate || ""
    const startTime = schedule.completionStartTime || ""
    const endDate = schedule.completionEndDate || ""
    const endTime = schedule.completionEndTime || ""
    const startMinutes = civilDateTimeToMinutes(startDate, startTime)
    const endMinutes = civilDateTimeToMinutes(endDate, endTime)

    if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
      return {
        date: startDate,
        time: startTime,
        endDate,
        endTime,
        durationMinutes: endMinutes - startMinutes,
        usesExecutionPeriod: true,
      }
    }
  }

  return {
    date: schedule.date,
    time: plannedTime,
    endDate: schedule.date,
    endTime: plannedTime,
    durationMinutes: plannedDuration,
    usesExecutionPeriod: false,
  }
}

export function getScheduleDisplaySegments(schedule: ScheduleDisplaySource): ScheduleDisplaySegment[] {
  const period = resolveScheduleDisplayPeriod(schedule)
  if (!period.usesExecutionPeriod) {
    return [{ date: period.date, time: period.time, durationMinutes: period.durationMinutes }]
  }

  const segments: ScheduleDisplaySegment[] = []
  let currentDate = period.date

  while (currentDate <= period.endDate) {
    const startMinute = currentDate === period.date ? timeToMinutes(period.time) : 0
    const endMinute = currentDate === period.endDate ? timeToMinutes(period.endTime) : 24 * 60
    const durationMinutes = endMinute - startMinute

    if (durationMinutes > 0) {
      segments.push({
        date: currentDate,
        time: currentDate === period.date ? period.time : "00:00",
        durationMinutes,
      })
    }

    currentDate = addCivilDaysKey(currentDate, 1)
  }

  return segments
}

export function formatScheduleDisplayDuration(schedule: ScheduleDisplaySource, preserveConfiguredType = true) {
  const period = resolveScheduleDisplayPeriod(schedule)
  if (period.usesExecutionPeriod) return formatExactScheduleDuration(period.durationMinutes)
  return formatConfiguredScheduleDuration(schedule, preserveConfiguredType)
}
