export function shouldRequireScheduleAssignee(params: {
  isEditing: boolean
  previouslyHadAssignee: boolean
  teamIds: string[]
  employeeIds: string[]
}) {
  const hasNextAssignee = params.teamIds.length > 0 || params.employeeIds.length > 0
  if (hasNextAssignee) return false

  return !params.isEditing || params.previouslyHadAssignee
}
