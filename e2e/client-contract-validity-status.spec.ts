import { expect, test } from "@playwright/test"
import { clientFixture, contractFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test("perfil e lista exibem vencido e preservam prioridade de renovado", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  const contracts = [
    { ...contractFixture, id: "expired-contract", contractNumber: "LEG-000143", status: "closed", endDate: "2020-08-01", renewalStatus: undefined },
    { ...contractFixture, id: "renewed-contract", contractNumber: "LEG-RENEWED", status: "closed", endDate: "2020-08-01", renewalStatus: "renewed" },
    { ...contractFixture, id: "active-contract", contractNumber: "DEP-2026-021", status: "closed", endDate: "2099-09-24", renewalStatus: undefined },
  ]
  await page.route("**/api/v1/contracts**", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/v1/contracts") return route.fallback()
    await route.fulfill({ json: { success: true, data: contracts, message: "OK" } })
  })
  await page.goto(`/clientes/${clientFixture.id}`)
  await page.getByRole("tab", { name: /Contratos/ }).click()
  for (const [number, status] of [["LEG-000143", "Vencido"], ["LEG-RENEWED", "Renovado"], ["DEP-2026-021", "Assinado"]]) {
    await expect(page.getByRole("row").filter({ hasText: number }).getByText(status, { exact: true })).toBeVisible()
  }
  await page.goto("/contratos")
  for (const [number, status] of [["LEG-000143", "Vencido"], ["LEG-RENEWED", "Renovado"], ["DEP-2026-021", "Assinado"]]) {
    await expect(page.getByRole("link", { name: `Abrir contrato ${number}`, exact: true }).getByText(status, { exact: true })).toBeVisible()
  }
})
