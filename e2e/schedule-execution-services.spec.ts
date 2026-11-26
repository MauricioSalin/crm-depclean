import { expect, test } from "@playwright/test"
import path from "node:path"
import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const serviceOptions = [
  { id: "water", name: "Limpeza de caixa d’água" },
  { id: "pests", name: "Controle de pragas" },
]
const partial = {
  ...scheduleFixture, id: "vallais~execution~1", sourceScheduleId: "vallais", isHistoricalExecution: true,
  clientName: "CONDOMINIO RESIDENCIAL VALLAIS", contractId: null, isManual: true,
  date: "2026-11-18", time: "13:50", status: "partially_completed", serviceTypeId: "water",
  serviceTypeIds: ["water", "pests"], serviceTypeName: "Limpeza de caixa d’água, Controle de pragas",
  executionServiceOptions: serviceOptions, duration: 182, durationValue: 182, durationType: "minutes",
  executionDurationMinutes: 182, completionStartDate: "2026-11-18", completionStartTime: "13:50",
  completionEndDate: "2026-11-18", completionEndTime: "16:52", billable: false, value: 0,
  serviceReport: "Foi feita a limpeza de uma caixa; as outras duas serão reagendadas.",
  naAttachments: [{ fileName: "NA de 18-11.pdf", documentUrl: "/api/v1/files/vallais/na-18.pdf" }],
}
const future = { ...scheduleFixture, id: "vallais", clientName: partial.clientName, date: "2026-11-26", status: "rescheduled", serviceTypeId: "water", serviceTypeIds: ["water", "pests"], serviceTypeName: partial.serviceTypeName }

test("corrige somente os serviços da visita parcial e preserva o retorno e seus documentos", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  let current = { ...partial }
  const writes: Array<{ method: string; pathname: string; data: unknown }> = []
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = decodeURIComponent(new URL(request.url()).pathname)
    const send = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (request.method() === "PATCH") {
      writes.push({ method: request.method(), pathname, data: request.postDataJSON() })
      if (pathname === `/api/v1/schedules/${partial.id}/execution-services`) {
        const data = request.postDataJSON()
        current = { ...current, serviceTypeIds: data.serviceTypeIds, serviceTypeName: "Limpeza de caixa d’água" }
        return send(current)
      }
    }
    if (pathname.endsWith("/history") || pathname.endsWith("/schedules")) return send([future, current])
    if (pathname.endsWith(`/${partial.id}`)) return send(current)
    return route.fallback()
  })
  await page.goto("/agenda?date=2026-11-18&view=week")
  await page.locator(`[data-schedule-id="${partial.id}"]`).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Corrigir serviços da visita de 18/11/2026", exact: true }).click()
  await expect(dialog.getByRole("checkbox", { name: "Controle de pragas", exact: true })).toBeChecked()
  await dialog.getByRole("checkbox", { name: "Controle de pragas", exact: true }).uncheck()
  await dialog.getByRole("checkbox", { name: "Limpeza de caixa d’água", exact: true }).uncheck()
  await expect(dialog.getByRole("button", { name: "Salvar correção", exact: true })).toBeDisabled()
  await dialog.getByRole("checkbox", { name: "Limpeza de caixa d’água", exact: true }).check()
  await dialog.getByRole("button", { name: "Salvar correção", exact: true }).click()
  await expect(dialog.locator('[data-schedule-detail-card="service"]')).toContainText("Limpeza de caixa d’água")
  await expect(dialog.locator('[data-schedule-detail-card="service"]')).not.toContainText("Controle de pragas")
  await expect(dialog.getByRole("link", { name: "Visualizar NA de 18-11.pdf", exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "Histórico de agendamentos", exact: true }).click()
  await expect(dialog.getByRole("row").filter({ hasText: "26/11/2026" })).toContainText("Controle de pragas")
  await expect(dialog.getByRole("row").filter({ hasText: "18/11/2026" })).not.toContainText("Controle de pragas")
  expect(writes).toEqual([{ method: "PATCH", pathname: `/api/v1/schedules/${partial.id}/execution-services`, data: { serviceTypeIds: ["water"] } }])
  if (process.env.E2E_SCREENSHOT_DIR) await dialog.screenshot({ path: path.join(process.env.E2E_SCREENSHOT_DIR, "vallais-historico-corrigido.png") })
})

for (const resolved of [false, true]) {
  test(`a agenda mantém a visita parcial ${resolved ? "apagada após a conclusão do retorno" : "amarela enquanto há pendências"}`, async ({ page }) => {
    await installAuthenticatedSession(page)
    await installApiMock(page)
    await page.route("**/api/v1/schedules**", (route) => route.fulfill({ json: { success: true, data: [{ ...partial, isExecutionResolved: resolved }] } }))
    await page.goto("/agenda?date=2026-11-18&view=week")
    const event = page.locator(`[data-schedule-id="${partial.id}"]`)
    await expect(event).toHaveAttribute("data-schedule-status", "partially_completed")
    if (resolved) {
      await expect(event).toHaveAttribute("data-execution-resolved", "true")
      await expect(event).toHaveAttribute("style", /6%/)
    } else {
      await expect(event).not.toHaveAttribute("data-execution-resolved", "true")
      await expect(event).toHaveAttribute("style", /#edd66b|rgb\(237, 214, 107\)/)
    }
  })
}

test("usuário sem permissão para editar concluídos consulta a visita sem a ação de correção", async ({ page }) => {
  await installAuthenticatedSession(page, { ...E2E_USER, permissions: E2E_USER.permissions.filter((permission) => !["settings_manage", "agenda_manage_locked"].includes(permission)) })
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", (route) => route.fulfill({ json: { success: true, data: route.request().url().endsWith(partial.id) ? partial : [partial] } }))
  await page.goto("/agenda?date=2026-11-18&view=week")
  await page.locator(`[data-schedule-id="${partial.id}"]`).click()
  await expect(page.getByRole("dialog").getByRole("button", { name: /Corrigir serviços/ })).toHaveCount(0)
})
