import type { ScheduleRecord } from "@/lib/api/schedules"
import type { TeamRecord } from "@/lib/api/teams"
import type { AuthenticatedUser } from "@/lib/auth/types"

type SchedulePermissionUser = Pick<AuthenticatedUser, "employeeId" | "permissions"> | null | undefined

function canManageScheduleStatus(user: SchedulePermissionUser) {
  const permissions = user?.permissions ?? []
  return permissions.includes("agenda_manage_status") || permissions.includes("settings_manage")
}

export function isScheduleResponsible(
  schedule: Pick<ScheduleRecord, "teams" | "additionalEmployees">,
  user: SchedulePermissionUser,
  teams: TeamRecord[],
) {
  const employeeId = user?.employeeId?.trim()
  if (!employeeId) return false

  if (schedule.additionalEmployees.some((employee) => employee.id === employeeId)) return true

  const scheduleTeamIds = new Set(schedule.teams.map((team) => team.id))
  return teams.some((team) => scheduleTeamIds.has(team.id) && (team.memberIds ?? []).includes(employeeId))
}

export function canStartSchedule(
  schedule: Pick<ScheduleRecord, "status" | "teams" | "additionalEmployees" | "canStartAttendance">,
  user: SchedulePermissionUser,
  teams: TeamRecord[],
) {
  if (["scheduled", "rescheduled"].includes(schedule.status) && canManageScheduleStatus(user)) return true
  if (schedule.canStartAttendance !== undefined) return schedule.canStartAttendance

  return ["scheduled", "rescheduled"].includes(schedule.status) && isScheduleResponsible(schedule, user, teams)
}
