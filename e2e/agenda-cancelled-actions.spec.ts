import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const cancelledSchedule = {
  ...scheduleFixture,
  status: "cancelled",
  cancellationReason: "Cancelado para validar as ações disponíveis.",
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: [cancelledSchedule],
      }),
    })
  })
})

test("não oferece edição para agendamento cancelado no card nem nos detalhes", async ({ page }) => {
  await page.goto(`/agenda?date=${cancelledSchedule.date}`)
  await page.getByRole("button", { name: "Mostrar detalhes do dia" }).click()

  const reactivateButton = page.getByRole("button", { name: "Reativar", exact: true })
  await expect(reactivateButton).toBeVisible()

  const scheduleCard = reactivateButton.locator("xpath=ancestor::div[@data-slot='card'][1]")
  await expect(scheduleCard.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0)

  await scheduleCard.getByText(cancelledSchedule.clientName, { exact: true }).click()

  await expect(page.getByText("Motivo do cancelamento", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Editar agendamento", exact: true })).toHaveCount(0)
})
