import { expect, test } from "@playwright/test"

import { clientFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

test("ao trocar o cliente de atendimento avulso envia a unidade do novo cliente", async ({ page }) => {
  const originalClient = {
    ...clientFixture,
    id: "client-porto-garibaldi",
    companyName: "CONDOMÍNIO PORTO GARIBALDI",
    units: [{
      ...clientFixture.units[0],
      id: "unit-porto-garibaldi",
      clientId: "client-porto-garibaldi",
    }],
  }
  const replacementClient = {
    ...clientFixture,
    id: "client-porto-gravatai",
    companyName: "CONDOMÍNIO RESIDENCIAL PORTO GRAVATAÍ",
    units: [{
      ...clientFixture.units[0],
      id: "unit-porto-gravatai",
      clientId: "client-porto-gravatai",
    }],
  }
  const schedule = {
    ...scheduleFixture,
    id: "schedule-client-change",
    contractId: "",
    contractServiceId: "",
    contractServiceIds: [],
    isManual: true,
    status: "completed" as const,
    clientId: originalClient.id,
    clientName: originalClient.companyName,
    unitId: originalClient.units[0].id,
    unitName: originalClient.units[0].name,
    billable: false,
    value: 0,
    billingDueDate: "",
  }
  let savedPayload: Record<string, unknown> | null = null

  await installAuthenticatedSession(page, E2E_USER)
  await installApiMock(page, E2E_USER)
  await page.route("**/api/v1/clients**", async (route) => {
    const request = route.request()
    if (request.method() === "GET" && new URL(request.url()).pathname === "/api/v1/clients") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [originalClient, replacementClient] }),
      })
      return
    }
    await route.fallback()
  })
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [schedule] }),
      })
      return
    }
    if (request.method() === "PATCH" && pathname === `/api/v1/schedules/${schedule.id}`) {
      savedPayload = request.postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          success: true,
          data: {
            ...schedule,
            clientId: replacementClient.id,
            clientName: replacementClient.companyName,
            unitId: replacementClient.units[0].id,
          },
        }),
      })
      return
    }
    await route.fallback()
  })

  await page.goto("/agendamentos")
  await page.getByRole("button", { name: `Abrir ações do agendamento de ${originalClient.companyName}` }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Editar atendimento avulso" })
  await dialog.getByRole("combobox").filter({ hasText: originalClient.companyName }).click()
  await page.getByRole("option", { name: replacementClient.companyName }).click()
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload).toMatchObject({
    clientId: replacementClient.id,
    unitId: replacementClient.units[0].id,
  })
  expect(savedPayload).not.toMatchObject({ unitId: originalClient.units[0].id })

  savedPayload = null
  await page.goto(`/agenda?date=${schedule.date}&view=week`)
  await page.locator(`[data-schedule-id="${schedule.id}"]`).click()
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()

  const agendaDialog = page.getByRole("dialog", { name: "Editar atendimento avulso" })
  await agendaDialog.getByRole("combobox").filter({ hasText: originalClient.companyName }).click()
  await page.getByRole("option", { name: replacementClient.companyName }).click()
  await agendaDialog.getByRole("button", { name: "Salvar", exact: true }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload).toMatchObject({
    clientId: replacementClient.id,
    unitId: replacementClient.units[0].id,
  })
  expect(savedPayload).not.toMatchObject({ unitId: originalClient.units[0].id })
})
