import type { ScheduleRecord } from "@/lib/api/schedules"
import type { TeamRecord } from "@/lib/api/teams"
import { addCivilDaysKey, minutesFromBrasiliaDate, toCivilDateKey } from "@/lib/date-utils"
import { scheduleDurationToMinutes, type ScheduleDurationType } from "@/lib/schedule-duration"

type AvailabilityFormData = {
  teamIds: string[]
  employeeIds: string[]
  date: string
  time: string
  durationType: ScheduleDurationType
  duration: number
  isEmergency?: boolean
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

type AvailabilityMode = "manual" | "automation"

const DAY_END_MINUTES = 24 * 60
const WORKDAY_START_MINUTES = 8 * 60
const WORKDAY_END_MINUTES = 17 * 60
const DAY_DURATION_MINUTES = 8 * 60
const LUNCH_START_MINUTES = 12 * 60
const LUNCH_END_MINUTES = 13 * 60
const MAX_SINGLE_SIDE_LUNCH_DURATION = 4 * 60
const SLOT_STEP_MINUTES = 30

export function isScheduleConflictErrorMessage(message: string) {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return normalized.includes("possui atendimento neste horario")
}

export function checkScheduleAvailability(params: {
  schedules: ScheduleRecord[]
  teams: TeamRecord[]
  formData: AvailabilityFormData
  ignoreScheduleId?: string
  allowWeekends?: boolean
  mode?: AvailabilityMode
}): AvailabilityResult {
  const mode = params.mode ?? "automation"
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
    .filter((schedule) => !["cancelled", "completed"].includes(schedule.status))
    .flatMap((schedule) => {
      const resource = expandResource({
        teamIds: schedule.teams.map((team) => team.id),
        employeeIds: schedule.additionalEmployees.map((employee) => employee.id),
        teams: params.teams,
      })
      return buildScheduleBlocks({
        date: schedule.date,
        time: schedule.time || "08:00",
        durationMinutes: getScheduleDurationMinutes(schedule),
        durationType: schedule.durationType,
        mode: "manual",
      }).map((block) => ({ ...block, resource }))
    })
    .filter((schedule) => hasResourceConflict(resource, schedule.resource))

  const requestedStart = minutesFromTime(requested.time)
  const requestedEnd = requestedStart + requested.durationMinutes
  const requestedBlocks = buildScheduleBlocks({
    date: requested.date,
    time: requested.time,
    durationMinutes: requested.durationMinutes,
    durationType: params.formData.durationType,
    allowWeekends: params.allowWeekends,
    mode,
  })
  const isFullDay = isFullDaySchedule(requested.durationMinutes, params.formData.durationType)
  const respectsBusinessHours = mode === "automation" && params.formData.isEmergency !== true
  const outsideWorkday = respectsBusinessHours &&
    !isFullDay &&
    (requestedStart < WORKDAY_START_MINUTES || requestedEnd > WORKDAY_END_MINUTES)
  const lunchConflict =
    respectsBusinessHours &&
    !isFullDay &&
    requested.durationMinutes <= MAX_SINGLE_SIDE_LUNCH_DURATION &&
    requestedStart < LUNCH_END_MINUTES &&
    requestedEnd > LUNCH_START_MINUTES
  const fullDayBadStart = respectsBusinessHours && isFullDay && requestedStart !== WORKDAY_START_MINUTES
  const hasConflict = conflicts.some((schedule) =>
    requestedBlocks.some((block) =>
      schedule.date === block.date &&
      block.startMinutes < schedule.endMinutes &&
      block.endMinutes > schedule.startMinutes,
    ),
  ) || lunchConflict || outsideWorkday || fullDayBadStart

  if (!hasConflict) {
    return { available: true, requested }
  }

  const suggested = findNextAvailableSlot({
    date: requested.date,
    startMinutes: requestedStart,
    durationMinutes: requested.durationMinutes,
    durationType: params.formData.durationType,
    conflicts,
    isEmergency: params.formData.isEmergency === true,
    allowWeekends: params.allowWeekends,
    mode,
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
  allowWeekends?: boolean
  mode?: AvailabilityMode
}) {
  const { schedule, date } = params
  if (!schedule || !date) return []

  const durationConfig = getScheduleDurationConfig(schedule)
  const durationMinutes = scheduleDurationToMinutes(durationConfig.duration, durationConfig.durationType)
  const stepMinutes = params.stepMinutes ?? SLOT_STEP_MINUTES
  const mode = params.mode ?? "automation"
  const startMinutes = params.startMinutes ?? (mode === "manual" ? 0 : WORKDAY_START_MINUTES)
  const endMinutes = params.endMinutes ?? (mode === "manual" ? DAY_END_MINUTES : WORKDAY_END_MINUTES)
  const todayKey = toCivilDateKey(params.now ?? new Date())
  const isFullDay = isFullDaySchedule(durationMinutes, durationConfig.durationType)

  if (
    date < todayKey ||
    durationMinutes <= 0 ||
    (mode === "automation" && !isFullDay && durationMinutes > endMinutes - startMinutes)
  ) {
    return []
  }

  const nowMinutes = minutesFromBrasiliaDate(params.now ?? new Date())
  const firstSlot = date === todayKey ? Math.max(startMinutes, roundToNextStep(nowMinutes)) : startMinutes
  const slots: string[] = []
  const baseFormData = {
    teamIds: schedule.teams.map((team) => team.id),
    employeeIds: schedule.additionalEmployees.map((employee) => employee.id),
    date,
    durationType: durationConfig.durationType,
    duration: durationConfig.duration,
  }

  if (isFullDay && mode === "automation") {
    const availability = checkScheduleAvailability({
      schedules: params.schedules,
      teams: params.teams,
      ignoreScheduleId: schedule.id,
      allowWeekends: params.allowWeekends,
      mode,
      formData: {
        ...baseFormData,
        time: "08:00",
      },
    })

    return availability.available ? ["08:00"] : []
  }

  for (
    let start = firstSlot;
    mode === "manual" ? start < endMinutes : start + durationMinutes <= endMinutes;
    start += stepMinutes
  ) {
    const time = timeFromMinutes(start)
    const availability = checkScheduleAvailability({
      schedules: params.schedules,
      teams: params.teams,
      ignoreScheduleId: schedule.id,
      allowWeekends: params.allowWeekends,
      mode,
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
  durationType?: ScheduleDurationType
  conflicts: Array<{ date: string; startMinutes: number; endMinutes: number }>
  isEmergency?: boolean
  allowWeekends?: boolean
  mode: AvailabilityMode
}) {
  if (params.mode === "manual") {
    let currentDate = params.date
    let firstStart = Math.max(0, Math.min(DAY_END_MINUTES - 1, roundToNextStep(params.startMinutes)))

    for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
      for (let startMinutes = firstStart; startMinutes < DAY_END_MINUTES; startMinutes += SLOT_STEP_MINUTES) {
        const blocks = buildScheduleBlocks({
          date: currentDate,
          time: timeFromMinutes(startMinutes),
          durationMinutes: params.durationMinutes,
          durationType: params.durationType,
          mode: "manual",
        })
        const hasConflict = blocks.some((block) =>
          params.conflicts.some((item) =>
            item.date === block.date &&
            block.startMinutes < item.endMinutes &&
            block.endMinutes > item.startMinutes,
          ),
        )

        if (!hasConflict) return { date: currentDate, time: timeFromMinutes(startMinutes) }
      }

      currentDate = addCivilDaysKey(currentDate, 1)
      firstStart = 0
    }

    return undefined
  }

  if (!params.isEmergency && isFullDaySchedule(params.durationMinutes, params.durationType)) {
    return findNextAvailableFullDaySlot(params)
  }

  const dayStartMinutes = params.isEmergency ? 0 : WORKDAY_START_MINUTES
  const dayEndMinutes = params.isEmergency ? DAY_END_MINUTES : WORKDAY_END_MINUTES
  let currentDate = params.date
  let startMinutes = Math.max(dayStartMinutes, roundToNextStep(params.startMinutes))

  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    const lunchBlocks = !params.isEmergency && params.durationMinutes <= MAX_SINGLE_SIDE_LUNCH_DURATION
      ? [{ date: currentDate, startMinutes: LUNCH_START_MINUTES, endMinutes: LUNCH_END_MINUTES }]
      : []
    const dayConflicts = [
      ...lunchBlocks,
      ...params.conflicts.filter((item) => item.date === currentDate),
    ].sort((a, b) => a.startMinutes - b.startMinutes)

    while (startMinutes + params.durationMinutes <= dayEndMinutes) {
      const endMinutes = startMinutes + params.durationMinutes
      const conflict = dayConflicts.find((item) => startMinutes < item.endMinutes && endMinutes > item.startMinutes)

      if (!conflict) {
        return { date: currentDate, time: timeFromMinutes(startMinutes) }
      }

      startMinutes = roundToNextStep(conflict.endMinutes)
    }

    currentDate = addCivilDaysKey(currentDate, 1)
    startMinutes = dayStartMinutes
  }

  return undefined
}

function findNextAvailableFullDaySlot(params: {
  date: string
  durationMinutes: number
  durationType?: ScheduleDurationType
  conflicts: Array<{ date: string; startMinutes: number; endMinutes: number }>
  allowWeekends?: boolean
}) {
  let currentDate = params.allowWeekends ? params.date : toBusinessDateKey(params.date)

  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    const blocks = buildScheduleBlocks({
      date: currentDate,
      time: "08:00",
      durationMinutes: params.durationMinutes,
      durationType: "days",
      allowWeekends: params.allowWeekends,
      mode: "automation",
    })
    const hasConflict = blocks.some((block) =>
      params.conflicts.some((item) =>
        item.date === block.date &&
        block.startMinutes < item.endMinutes &&
        block.endMinutes > item.startMinutes,
      ),
    )

    if (!hasConflict) return { date: currentDate, time: "08:00" }
    currentDate = params.allowWeekends
      ? addCivilDaysKey(currentDate, 1)
      : nextBusinessDateKey(currentDate)
  }

  return undefined
}

function buildScheduleBlocks(params: {
  date: string
  time: string
  durationMinutes: number
  durationType?: ScheduleDurationType
  allowWeekends?: boolean
  mode?: AvailabilityMode
}) {
  const durationMinutes = Math.max(1, Number(params.durationMinutes || 60))
  const mode = params.mode ?? "automation"

  if (isFullDaySchedule(durationMinutes, params.durationType)) {
    const blocks: Array<{ date: string; startMinutes: number; endMinutes: number }> = []
    let currentDate = mode === "manual" || params.allowWeekends ? params.date : toBusinessDateKey(params.date)
    const days = scheduleDaySpan(durationMinutes, params.durationType)
    const startMinutes = mode === "manual"
      ? minutesFromTime(params.time || "08:00")
      : WORKDAY_START_MINUTES
    const endMinutes = startMinutes + DAY_DURATION_MINUTES

    for (let index = 0; index < days; index += 1) {
      blocks.push(...splitBlockAcrossDates(currentDate, startMinutes, endMinutes))
      currentDate = mode === "manual" || params.allowWeekends
        ? addCivilDaysKey(currentDate, 1)
        : nextBusinessDateKey(currentDate)
    }

    return blocks
  }

  const startMinutes = minutesFromTime(params.time || "08:00")
  return splitBlockAcrossDates(params.date, startMinutes, startMinutes + durationMinutes)
}

function splitBlockAcrossDates(date: string, startMinutes: number, endMinutes: number) {
  const blocks: Array<{ date: string; startMinutes: number; endMinutes: number }> = []
  let currentDate = date
  let currentStart = startMinutes
  let remaining = Math.max(1, endMinutes - startMinutes)

  while (remaining > 0) {
    const availableToday = Math.max(1, DAY_END_MINUTES - currentStart)
    const currentDuration = Math.min(remaining, availableToday)
    blocks.push({
      date: currentDate,
      startMinutes: currentStart,
      endMinutes: currentStart + currentDuration,
    })
    remaining -= currentDuration
    currentDate = addCivilDaysKey(currentDate, 1)
    currentStart = 0
  }

  return blocks
}

function isFullDaySchedule(durationMinutes: number, durationType?: ScheduleDurationType) {
  const parsed = Number(durationMinutes || 0)
  return durationType === "days" || (!durationType && parsed > DAY_DURATION_MINUTES)
}

function scheduleDaySpan(durationMinutes: number, durationType?: ScheduleDurationType) {
  if (!isFullDaySchedule(durationMinutes, durationType)) return 1
  return Math.max(1, Math.ceil(Number(durationMinutes || DAY_DURATION_MINUTES) / DAY_DURATION_MINUTES))
}

function toBusinessDateKey(date: string) {
  let current = date
  while (isWeekendDateKey(current)) {
    current = addCivilDaysKey(current, 1)
  }
  return current
}

function nextBusinessDateKey(date: string) {
  let current = addCivilDaysKey(date, 1)
  while (isWeekendDateKey(current)) {
    current = addCivilDaysKey(current, 1)
  }
  return current
}

export function isWeekendDateKey(date: string) {
  const [year, month, day] = date.split("-").map((value) => Number(value))
  const weekday = new Date(Date.UTC(year || 0, (month || 1) - 1, day || 1)).getUTCDay()
  return weekday === 0 || weekday === 6
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

function getScheduleDurationMinutes(schedule: ScheduleRecord) {
  const config = getScheduleDurationConfig(schedule)
  return scheduleDurationToMinutes(config.duration, config.durationType)
}
