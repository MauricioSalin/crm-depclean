import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

test("visualizar e abrir por link usam NAs quando o atendimento já iniciou", async ({ page }) => {
  const restrictedUser = {
    ...E2E_USER,
    id: "user-schedule-in-progress",
    permissions: ["agenda_own_view"],
  }
  const inProgressSchedule = {
    ...scheduleFixture,
    id: "schedule-in-progress-consistency",
    status: "in_progress" as const,
    canAttachNa: true,
  }

  await installAuthenticatedSession(page, restrictedUser)
  await installApiMock(page, restrictedUser)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [inProgressSchedule] }),
      })
      return
    }

    if (request.method() === "GET" && pathname === `/api/v1/schedules/${inProgressSchedule.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: inProgressSchedule }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/agendamentos")
  await page.getByRole("button", { name: `Abrir ações do agendamento de ${inProgressSchedule.clientName}` }).click()
  await page.getByRole("menuitem", { name: "Visualizar", exact: true }).click()
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ver informações", exact: true }).click()
  await expect(page.getByRole("dialog", { name: new RegExp(inProgressSchedule.clientName) })).toBeVisible()
  await page.getByRole("button", { name: "Voltar para NAs do atendimento" }).click()
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()

  await page.keyboard.press("Escape")
  await page.goto(`/agendamentos/${inProgressSchedule.id}`)
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/\/agendamentos$/)
})

test("editor pode editar atendimento em andamento e usa a ação Concluir", async ({ page }) => {
  const editorUser = {
    ...E2E_USER,
    id: "user-schedule-in-progress-editor",
    permissions: ["agenda_view", "agenda_manage"],
  }
  const inProgressSchedule = {
    ...scheduleFixture,
    id: "schedule-in-progress-editable",
    contractId: null,
    contractServiceId: null,
    contractServiceIds: [],
    isManual: true,
    status: "in_progress" as const,
    canAttachNa: true,
  }

  await installAuthenticatedSession(page, editorUser)
  await installApiMock(page, editorUser)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    if (request.method() === "GET" && new URL(request.url()).pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [inProgressSchedule] }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/agendamentos")
  await page.getByRole("button", { name: `Abrir ações do agendamento de ${inProgressSchedule.clientName}` }).click()

  const editAction = page.getByRole("menuitem", { name: "Editar", exact: true })
  await expect(editAction).toBeEnabled()
  await expect(page.getByRole("menuitem", { name: "Concluir", exact: true })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "NAs e conclusão", exact: true })).toHaveCount(0)

  await editAction.click()
  await expect(page.getByRole("heading", { name: "Editar atendimento avulso", exact: true })).toBeVisible()
})
