import type { ScheduleRecord } from "@/lib/api/schedules"
import type { TeamRecord } from "@/lib/api/teams"
import { scheduleDurationToMinutes, type ScheduleDurationType } from "@/lib/schedule-duration"

type AvailabilityFormData = {
  teamIds: string[]
  employeeIds: string[]
  date: string
  time: string
  durationType: ScheduleDurationType
  duration: number
}

type AvailabilityResult = {
  available: boolean
  requested: {
    date: string
    time: string
    durationMinutes: number
  }
  suggested?: {
    date: string
    time: string
  }
}

const DAY_START_MINUTES = 0
const DAY_END_MINUTES = 24 * 60
const LUNCH_START_MINUTES = 12 * 60
const LUNCH_END_MINUTES = 13 * 60
const MAX_SINGLE_SIDE_LUNCH_DURATION = 5 * 60
const SLOT_STEP_MINUTES = 30

export function checkScheduleAvailability(params: {
  schedules: ScheduleRecord[]
  teams: TeamRecord[]
  formData: AvailabilityFormData
  ignoreScheduleId?: string
}): AvailabilityResult {
  const requested = {
    date: params.formData.date,
    time: params.formData.time,
    durationMinutes: scheduleDurationToMinutes(params.formData.duration, params.formData.durationType),
  }

  if (!requested.date || !requested.time || requested.durationMinutes <= 0) {
    return { available: true, requested }
  }

  const resource = expandResource({
    teamIds: params.formData.teamIds,
    employeeIds: params.formData.employeeIds,
    teams: params.teams,
  })

  const conflicts = params.schedules
    .filter((schedule) => schedule.id !== params.ignoreScheduleId)
    .filter((schedule) => !["cancelled"].includes(schedule.status))
    .map((schedule) => ({
      date: schedule.date,
      startMinutes: minutesFromTime(schedule.time || "08:00"),
      endMinutes: minutesFromTime(schedule.time || "08:00") + Number(schedule.duration || 60),
      resource: expandResource({
        teamIds: schedule.teams.map((team) => team.id),
        employeeIds: schedule.additionalEmployees.map((employee) => employee.id),
        teams: params.teams,
      }),
    }))
    .filter((schedule) => hasResourceConflict(resource, schedule.resource))

  const requestedStart = minutesFromTime(requested.time)
  const requestedEnd = requestedStart + requested.durationMinutes
  const lunchConflict =
    requested.durationMinutes <= MAX_SINGLE_SIDE_LUNCH_DURATION &&
    requestedStart < LUNCH_END_MINUTES &&
    requestedEnd > LUNCH_START_MINUTES
  const hasConflict = conflicts.some((schedule) =>
    schedule.date === requested.date &&
    requestedStart < schedule.endMinutes &&
    requestedEnd > schedule.startMinutes,
  ) || lunchConflict

  if (!hasConflict) {
    return { available: true, requested }
  }

  const suggested = findNextAvailableSlot({
    date: requested.date,
    startMinutes: requestedStart,
    durationMinutes: requested.durationMinutes,
    conflicts,
  })

  return {
    available: false,
    requested,
    suggested,
  }
}

export function formatAvailabilitySlot(date: string, time: string) {
  const [year, month, day] = date.split("-")
  if (!year || !month || !day) return `${date} às ${time}`
  return `${day}/${month}/${year} às ${time}`
}

export function getAvailableRescheduleTimes(params: {
  schedules: ScheduleRecord[]
  teams: TeamRecord[]
  schedule: ScheduleRecord | null | undefined
  date: string
  now?: Date
  startMinutes?: number
  endMinutes?: number
  stepMinutes?: number
}) {
  const { schedule, date } = params
  if (!schedule || !date) return []

  const durationConfig = getScheduleDurationConfig(schedule)
  const durationMinutes = scheduleDurationToMinutes(durationConfig.duration, durationConfig.durationType)
  const stepMinutes = params.stepMinutes ?? SLOT_STEP_MINUTES
  const startMinutes = params.startMinutes ?? 8 * 60
  const endMinutes = params.endMinutes ?? 18 * 60
  const todayKey = dateKeyFromLocalDate(params.now ?? new Date())

  if (date < todayKey || durationMinutes <= 0 || durationMinutes > endMinutes - startMinutes) {
    return []
  }

  const nowMinutes = minutesFromDate(params.now ?? new Date())
  const firstSlot = date === todayKey ? Math.max(startMinutes, roundToNextStep(nowMinutes)) : startMinutes
  const slots: string[] = []
  const baseFormData = {
    teamIds: schedule.teams.map((team) => team.id),
    employeeIds: schedule.additionalEmployees.map((employee) => employee.id),
    date,
    durationType: durationConfig.durationType,
    duration: durationConfig.duration,
  }

  for (let start = firstSlot; start + durationMinutes <= endMinutes; start += stepMinutes) {
    const time = timeFromMinutes(start)
    const availability = checkScheduleAvailability({
      schedules: params.schedules,
      teams: params.teams,
      ignoreScheduleId: schedule.id,
      formData: {
        ...baseFormData,
        time,
      },
    })

    if (availability.available) {
      slots.push(time)
    }
  }

  return slots
}

export function isRescheduleDateAvailable(params: {
  schedules: ScheduleRecord[]
  teams: TeamRecord[]
  schedule: ScheduleRecord | null | undefined
  date: string
  now?: Date
}) {
  return getAvailableRescheduleTimes(params).length > 0
}

function findNextAvailableSlot(params: {
  date: string
  startMinutes: number
  durationMinutes: number
  conflicts: Array<{ date: string; startMinutes: number; endMinutes: number }>
}) {
  let currentDate = params.date
  let startMinutes = roundToNextStep(params.startMinutes)

  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    const lunchBlocks = params.durationMinutes <= MAX_SINGLE_SIDE_LUNCH_DURATION
      ? [{ date: currentDate, startMinutes: LUNCH_START_MINUTES, endMinutes: LUNCH_END_MINUTES }]
      : []
    const dayConflicts = [
      ...lunchBlocks,
      ...params.conflicts.filter((item) => item.date === currentDate),
    ].sort((a, b) => a.startMinutes - b.startMinutes)

    while (startMinutes + params.durationMinutes <= DAY_END_MINUTES) {
      const endMinutes = startMinutes + params.durationMinutes
      const conflict = dayConflicts.find((item) => startMinutes < item.endMinutes && endMinutes > item.startMinutes)

      if (!conflict) {
        return { date: currentDate, time: timeFromMinutes(startMinutes) }
      }

      startMinutes = roundToNextStep(conflict.endMinutes)
    }

    currentDate = addDays(currentDate, 1)
    startMinutes = DAY_START_MINUTES
  }

  return undefined
}

function expandResource(params: { teamIds: string[]; employeeIds: string[]; teams: TeamRecord[] }) {
  const selectedTeams = params.teams.filter((team) => params.teamIds.includes(team.id))
  const teamMemberIds = selectedTeams.flatMap((team) => team.memberIds ?? [])

  return {
    teamIds: unique(params.teamIds),
    employeeIds: unique([...params.employeeIds, ...teamMemberIds]),
  }
}

function hasResourceConflict(
  source: { teamIds: string[]; employeeIds: string[] },
  target: { teamIds: string[]; employeeIds: string[] },
) {
  const sourceHasAssignments = source.teamIds.length > 0 || source.employeeIds.length > 0
  const targetHasAssignments = target.teamIds.length > 0 || target.employeeIds.length > 0
  if (!sourceHasAssignments || !targetHasAssignments) return true

  return hasIntersection(source.teamIds, target.teamIds) || hasIntersection(source.employeeIds, target.employeeIds)
}

function hasIntersection(source: string[], target: string[]) {
  if (source.length === 0 || target.length === 0) return false
  const set = new Set(source)
  return target.some((item) => set.has(item))
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function minutesFromTime(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map((value) => Number(value))
  return hours * 60 + minutes
}

function timeFromMinutes(totalMinutes: number) {
  const normalized = ((totalMinutes % DAY_END_MINUTES) + DAY_END_MINUTES) % DAY_END_MINUTES
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function roundToNextStep(totalMinutes: number) {
  return Math.ceil(totalMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES
}

function getScheduleDurationConfig(schedule: ScheduleRecord) {
  const durationValue = Number(schedule.durationValue)
  if (Number.isFinite(durationValue) && durationValue > 0 && schedule.durationType) {
    return {
      duration: durationValue,
      durationType: schedule.durationType as ScheduleDurationType,
    }
  }

  const durationMinutes = Number(schedule.duration)
  return {
    duration: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes / 60 : 1,
    durationType: "hours" as ScheduleDurationType,
  }
}

function dateKeyFromLocalDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value))
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}
