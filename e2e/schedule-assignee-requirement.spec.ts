import { expect, test } from "@playwright/test"

import { shouldRequireScheduleAssignee } from "../lib/schedule-assignee-requirement"

test("permite editar um agendamento já sem responsável sem liberar remoção de atribuições", () => {
  expect(shouldRequireScheduleAssignee({
    isEditing: true,
    previouslyHadAssignee: false,
    teamIds: [],
    employeeIds: [],
  })).toBe(false)

  expect(shouldRequireScheduleAssignee({
    isEditing: true,
    previouslyHadAssignee: true,
    teamIds: [],
    employeeIds: [],
  })).toBe(true)

  expect(shouldRequireScheduleAssignee({
    isEditing: false,
    previouslyHadAssignee: false,
    teamIds: [],
    employeeIds: [],
  })).toBe(true)
})
