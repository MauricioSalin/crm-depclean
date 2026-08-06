import type { ScheduleRecord } from "@/lib/api/schedules"
import type { TeamRecord } from "@/lib/api/teams"
import { addCivilDaysKey, minutesFromBrasiliaDate, toCivilDateKey } from "@/lib/date-utils"
import { scheduleDurationToMinutes, type ScheduleDurationType } from "@/lib/schedule-duration"
import { resolveDailyScheduleLimitHours } from "@/lib/service-daily-capacity"

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
  conflict?: {
    reason: "resource" | "lunch" | "outside_workday" | "full_day_start"
    teamIds: string[]
    employeeIds: string[]
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
  suggestAlternative?: boolean
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
  const isFullDay = isFullDaySchedule(requested.durationMinutes, params.formData.durationType, mode)
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
  const overlappingConflicts = conflicts.filter((schedule) =>
    requestedBlocks.some((block) =>
      schedule.date === block.date &&
      block.startMinutes < schedule.endMinutes &&
      block.endMinutes > schedule.startMinutes,
    ),
  )
  const hasResourceOverlap = overlappingConflicts.length > 0
  const hasConflict = hasResourceOverlap || lunchConflict || outsideWorkday || fullDayBadStart

  if (!hasConflict) {
    return { available: true, requested }
  }

  const suggested = params.suggestAlternative === false
    ? undefined
    : findNextAvailableSlot({
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
    conflict: {
      reason: hasResourceOverlap
        ? "resource"
        : lunchConflict
          ? "lunch"
          : outsideWorkday
            ? "outside_workday"
            : "full_day_start",
      teamIds: hasResourceOverlap
        ? unique(overlappingConflicts.flatMap((item) => intersection(resource.teamIds, item.resource.teamIds)))
        : [],
      employeeIds: hasResourceOverlap
        ? unique(overlappingConflicts.flatMap((item) => intersection(resource.employeeIds, item.resource.employeeIds)))
        : [],
    },
  }
}

export function getScheduleConflictResourceNames(
  conflict: AvailabilityResult["conflict"],
  catalogs: {
    teams: Array<{ id: string; name: string }>
    employees: Array<{ id: string; name: string }>
  },
) {
  if (!conflict || conflict.reason !== "resource") return []

  const teamNames = conflict.teamIds
    .map((id) => catalogs.teams.find((team) => team.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  const employeeNames = conflict.employeeIds
    .map((id) => catalogs.employees.find((employee) => employee.id === id)?.name)
    .filter((name): name is string => Boolean(name))

  return unique([...employeeNames, ...teamNames])
}

export function formatScheduleConflictConfirmation(resources: string[]) {
  if (resources.length === 0) {
    return "O técnico ou a equipe selecionada terá um conflito de horário. Deseja continuar?"
  }

  const formatted = resources.length === 1
    ? resources[0]
    : `${resources.slice(0, -1).join(", ")} e ${resources[resources.length - 1]}`

  return resources.length === 1
    ? `${formatted} terá um conflito de horário. Deseja continuar?`
    : `${formatted} terão conflito de horário. Deseja continuar?`
}

export function hasScheduleDailyServiceCapacity(params: {
  schedules: ScheduleRecord[]
  schedule: ScheduleRecord
  serviceTypes: Array<{ id: string; dailyScheduleLimitHours?: number | null; dailyScheduleLimit?: number | null }>
  date: string
  time?: string
}) {
  return getScheduleDailyServiceCapacityViolation(params) === null
}

export function getScheduleDailyServiceCapacityViolation(params: {
  schedules: ScheduleRecord[]
  schedule: ScheduleRecord
  serviceTypes: Array<{ id: string; dailyScheduleLimitHours?: number | null; dailyScheduleLimit?: number | null }>
  date: string
  time?: string
}) {
  return getDailyServiceCapacityViolation({
    schedules: params.schedules,
    ignoreScheduleId: params.schedule.id,
    serviceTypeIds: params.schedule.serviceTypeIds?.length
      ? params.schedule.serviceTypeIds
      : [params.schedule.serviceTypeId],
    serviceTypes: params.serviceTypes,
    date: params.date,
    time: params.time || params.schedule.time || "08:00",
    durationMinutes: getScheduleDurationMinutes(params.schedule),
    durationType: params.schedule.durationType,
    serviceItems: params.schedule.serviceItems,
  })
}

export function hasDailyServiceCapacity(params: {
  schedules: ScheduleRecord[]
  ignoreScheduleId?: string
  serviceTypeIds: string[]
  serviceTypes: Array<{ id: string; dailyScheduleLimitHours?: number | null; dailyScheduleLimit?: number | null }>
  date: string
  time: string
  durationMinutes: number
  durationType?: ScheduleDurationType
  serviceItems?: ScheduleRecord["serviceItems"]
  mode?: AvailabilityMode
}) {
  return getDailyServiceCapacityViolation(params) === null
}

export type DailyServiceCapacityViolation = {
  serviceTypeId: string
  date: string
  limitHours: number
  usedMinutes: number
  requestedMinutes: number
}

export function getDailyServiceCapacityViolation(params: {
  schedules: ScheduleRecord[]
  ignoreScheduleId?: string
  serviceTypeIds: string[]
  serviceTypes: Array<{ id: string; dailyScheduleLimitHours?: number | null; dailyScheduleLimit?: number | null }>
  date: string
  time: string
  durationMinutes: number
  durationType?: ScheduleDurationType
  serviceItems?: ScheduleRecord["serviceItems"]
  mode?: AvailabilityMode
}): DailyServiceCapacityViolation | null {
  const serviceTypeIds = unique(params.serviceTypeIds)
  if (serviceTypeIds.length === 0) return null

  for (const serviceTypeId of serviceTypeIds) {
    const requestedServiceItem = params.serviceItems?.find((item) => item.serviceTypeId === serviceTypeId)
    const requestedMinutesByDate = dailyMinutesByDate(buildScheduleBlocks({
      date: params.date,
      time: params.time || "08:00",
      durationMinutes: requestedServiceItem?.durationMinutes ?? params.durationMinutes,
      durationType: requestedServiceItem?.durationType ?? params.durationType,
      mode: params.mode ?? "manual",
    }))
    const configuredService = params.serviceTypes.find((service) => service.id === serviceTypeId)
    const limitHours = resolveDailyScheduleLimitHours(
      configuredService?.dailyScheduleLimitHours,
      configuredService?.dailyScheduleLimit,
    )
    if (limitHours === null) continue
    const usedMinutesByDate = new Map<string, number>()

    for (const schedule of params.schedules) {
      if (schedule.id === params.ignoreScheduleId || ["cancelled", "completed"].includes(schedule.status)) continue
      const scheduleServiceIds = schedule.serviceTypeIds?.length
        ? schedule.serviceTypeIds
        : [schedule.serviceTypeId]
      if (!scheduleServiceIds.includes(serviceTypeId)) continue

      const scheduleServiceItem = schedule.serviceItems?.find((item) => item.serviceTypeId === serviceTypeId)
      for (const [date, minutes] of dailyMinutesByDate(buildScheduleBlocks({
        date: schedule.date,
        time: schedule.time || "08:00",
        durationMinutes: scheduleServiceItem?.durationMinutes ?? getScheduleDurationMinutes(schedule),
        durationType: scheduleServiceItem?.durationType ?? schedule.durationType,
        mode: params.mode ?? "manual",
      }))) {
        usedMinutesByDate.set(date, (usedMinutesByDate.get(date) ?? 0) + minutes)
      }
    }

    for (const [date, requestedMinutes] of requestedMinutesByDate) {
      const usedMinutes = usedMinutesByDate.get(date) ?? 0
      if (usedMinutes + requestedMinutes > limitHours * 60) {
        return { serviceTypeId, date, limitHours, usedMinutes, requestedMinutes }
      }
    }
  }

  return null
}

export function formatDailyServiceCapacityViolation(
  violation: DailyServiceCapacityViolation,
  serviceTypes: Array<{ id: string; name?: string }>,
) {
  const [year, month, day] = violation.date.split("-")
  const formattedDate = year && month && day ? `${day}/${month}/${year}` : violation.date
  const serviceName = serviceTypes.find((service) => service.id === violation.serviceTypeId)?.name
  const serviceLabel = serviceName ? ` do serviço ${serviceName}` : " deste serviço"
  return `O limite de ${violation.limitHours} horas${serviceLabel} seria ultrapassado em ${formattedDate}.`
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
  const isFullDay = isFullDaySchedule(durationMinutes, durationConfig.durationType, mode)

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
      suggestAlternative: false,
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
      suggestAlternative: false,
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

  if (!params.isEmergency && isFullDaySchedule(params.durationMinutes, params.durationType, params.mode)) {
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

  if (isFullDaySchedule(durationMinutes, params.durationType, mode)) {
    const blocks: Array<{ date: string; startMinutes: number; endMinutes: number }> = []
    let currentDate = mode === "manual" || params.allowWeekends ? params.date : toBusinessDateKey(params.date)
    const days = scheduleDaySpan(durationMinutes, params.durationType, mode)
    const startMinutes = mode === "manual"
      ? minutesFromTime(params.time || "08:00")
      : WORKDAY_START_MINUTES
    let remainingMinutes = durationMinutes

    for (let index = 0; index < days; index += 1) {
      const blockDuration = Math.min(DAY_DURATION_MINUTES, remainingMinutes)
      blocks.push(...splitBlockAcrossDates(currentDate, startMinutes, startMinutes + blockDuration))
      remainingMinutes -= blockDuration
      currentDate = nextBusinessDateKey(currentDate)
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

function dailyMinutesByDate(blocks: Array<{ date: string; startMinutes: number; endMinutes: number }>) {
  const minutesByDate = new Map<string, number>()
  for (const block of blocks) {
    const minutes = Math.max(0, block.endMinutes - block.startMinutes)
    minutesByDate.set(block.date, (minutesByDate.get(block.date) ?? 0) + minutes)
  }
  return minutesByDate
}

function isFullDaySchedule(
  durationMinutes: number,
  durationType?: ScheduleDurationType,
  mode: AvailabilityMode = "automation",
) {
  const parsed = Number(durationMinutes || 0)
  return durationType === "days" || (mode === "automation" && parsed > DAY_DURATION_MINUTES)
}

function scheduleDaySpan(
  durationMinutes: number,
  durationType?: ScheduleDurationType,
  mode: AvailabilityMode = "automation",
) {
  if (!isFullDaySchedule(durationMinutes, durationType, mode)) return 1
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
  if (!sourceHasAssignments || !targetHasAssignments) return false

  return hasIntersection(source.teamIds, target.teamIds) || hasIntersection(source.employeeIds, target.employeeIds)
}

function hasIntersection(source: string[], target: string[]) {
  if (source.length === 0 || target.length === 0) return false
  const set = new Set(source)
  return target.some((item) => set.has(item))
}

function intersection(source: string[], target: string[]) {
  if (source.length === 0 || target.length === 0) return []
  const targetSet = new Set(target)
  return source.filter((item) => targetSet.has(item))
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
