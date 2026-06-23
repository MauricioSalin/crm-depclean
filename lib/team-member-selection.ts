import type { TeamRecord } from "@/lib/api/teams"

export function getSelectedTeamMemberIds(teamIds: string[], teams: TeamRecord[]) {
  const selectedTeamIds = new Set(teamIds)
  return new Set(
    teams
      .filter((team) => selectedTeamIds.has(team.id))
      .flatMap((team) => team.memberIds ?? []),
  )
}

export function isEmployeeCoveredBySelectedTeams(employeeId: string, teamIds: string[], teams: TeamRecord[]) {
  return getSelectedTeamMemberIds(teamIds, teams).has(employeeId)
}

export function removeEmployeesCoveredByTeams(employeeIds: string[], teamIds: string[], teams: TeamRecord[]) {
  const teamMemberIds = getSelectedTeamMemberIds(teamIds, teams)
  return employeeIds.filter((employeeId) => !teamMemberIds.has(employeeId))
}

export function normalizeTeamEmployeeSelection(params: {
  teamIds: string[]
  employeeIds: string[]
  teams: TeamRecord[]
}) {
  return {
    teamIds: Array.from(new Set(params.teamIds)),
    employeeIds: removeEmployeesCoveredByTeams(Array.from(new Set(params.employeeIds)), params.teamIds, params.teams),
  }
}
