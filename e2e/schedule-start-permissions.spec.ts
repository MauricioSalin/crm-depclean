import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const scheduleEditor = {
  ...E2E_USER,
  id: "user-e2e-schedule-editor",
  employeeId: "employee-editor",
  permissionProfileId: "profile-e2e-schedule-editor",
  permissionProfileName: "Edição de agendamentos",
  permissions: ["agenda_view", "agenda_manage"],
  isSystemUser: false,
}

function futureCivilDate() {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString().slice(0, 10)
}

test("editor inicia atendimento futuro de outro responsável", async ({ page }) => {
  const date = futureCivilDate()
  let futureSchedule = {
    ...scheduleFixture,
    date,
    status: scheduleFixture.status as "scheduled" | "in_progress",
    canStartAttendance: false,
  }

  await installAuthenticatedSession(page, scheduleEditor)
  await installApiMock(page, scheduleEditor)
  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() === "PATCH" &&
      url.pathname === `/api/v1/schedules/${futureSchedule.id}/start`
    ) {
      futureSchedule = { ...futureSchedule, status: "in_progress" as const, canAttachNa: true }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: futureSchedule }),
      })
      return
    }

    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [futureSchedule] }),
    })
  })

  await page.goto(`/agenda?date=${date}&scheduleId=${futureSchedule.id}`)

  await expect(page.getByRole("button", { name: "Iniciar atendimento", exact: true })).toBeEnabled()
  await expect(page.getByText("Atendimento indisponível nesta data", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Iniciar atendimento", exact: true }).click()

  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Anexos do atendimento", exact: true })).toHaveCount(0)

  await page.getByRole("button", { name: new RegExp(futureSchedule.clientName) }).click()
  await expect(page.getByRole("heading", { name: "Anexos do atendimento", exact: true })).toBeVisible()
})
