import { expect, test } from "@playwright/test"
import { contractFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`edita somente dados de agendamentos e exige confirmação (${viewport.width}px)`, async ({ page }, testInfo) => {
    const pageErrors: string[] = []
    page.on("pageerror", (error) => pageErrors.push(error.message))
    await page.setViewportSize(viewport)
    await installAuthenticatedSession(page)
    await installApiMock(page)
    const contract = {
      ...contractFixture, status: "closed", signedAt: "2026-07-28",
      automationCreateSchedules: true, isAwaitingSchedules: true,
      services: [{ ...contractFixture.services[0], recurrence: "weekly", isRecurrenceService: false }],
    }
    await page.route("**/api/v1/contracts/contract-e2e", (route) => route.fulfill({ json: { success: true, data: contract } }))
    let saved: any = null
    let documentRequests = 0
    page.on("request", (request) => {
      if (request.method() !== "GET" && /contracts\/contract-e2e(?:\/document|\/preview)?$/.test(new URL(request.url()).pathname)) documentRequests++
    })
    await page.route("**/api/v1/contracts/contract-e2e/schedule-settings", async (route) => {
      saved = route.request().postDataJSON()
      await route.fulfill({ json: { success: true, data: { ...contract, services: saved.services } } })
    })
    await page.goto("/contratos/contract-e2e")
    await page.getByRole("button", { name: "Editar Contrato", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Selecionar cliente" })).toBeDisabled()
    await expect(page.getByRole("combobox", { name: "Selecionar template do contrato" })).toBeDisabled()
    await expect(page.locator("#contract-installments-count")).toBeDisabled()
    await expect(page.locator("#contract-total-value")).toBeDisabled()
    await expect(page.getByRole("button", { name: "Adicionar regra" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Adicionar Serviço", exact: true })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Editar cláusulas do serviço" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Editar documento", exact: true })).toHaveCount(0)
    const card = page.locator("[data-slot='card']").filter({ has: page.getByRole("heading", { name: "Serviços do Contrato" }) })
    const row = card.locator("tbody tr").first()
    await expect(row.getByRole("combobox", { name: "Selecione o serviço" })).toBeDisabled()
    await expect(row.getByRole("button", { name: "Adicionar equipes e funcionários" })).toBeEnabled()
    const recurrence = row.locator("td").nth(4).getByRole("combobox")
    await recurrence.click()
    await page.getByRole("option", { name: "Semestral", exact: true }).click()
    await page.getByRole("button", { name: "Salvar", exact: true }).first().click()
    const confirmation = page.getByRole("dialog", { name: "Recriar agendamentos?" })
    await expect(confirmation).toContainText("serão perdidas")
    await page.screenshot({ path: testInfo.outputPath("confirmation.png") })
    expect(saved).toBeNull()
    await confirmation.getByRole("button", { name: "Continuar editando" }).click()
    expect(saved).toBeNull()
    await page.getByRole("button", { name: "Salvar", exact: true }).first().click()
    await page.getByRole("button", { name: "Salvar e recriar agendamentos" }).click()
    await expect.poll(() => saved?.services[0]?.recurrence).toBe("semiannual")
    expect(saved.confirmed).toBe(true)
    expect(Object.keys(saved.services[0]).sort()).toEqual(["additionalEmployeeIds", "duration", "durationType", "id", "recurrence", "teamIds"].sort())
    expect(documentRequests).toBe(0)
    expect(pageErrors).toEqual([])
    await expect(page).toHaveURL(/\/contratos\/contract-e2e(?:\?|$)/)
  })
}

test("mantém edição bloqueada após enviar agendamentos à agenda", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/contracts/contract-e2e", (route) => route.fulfill({ json: {
    success: true, data: { ...contractFixture, status: "closed", isAwaitingSchedules: false, automationSchedulePlanPublishedAt: "2026-07-29T12:00:00Z" },
  } }))
  await page.goto("/contratos/contract-e2e")
  await expect(page.getByRole("button", { name: "Editar Contrato", exact: true })).toHaveCount(0)
  await page.goto("/contratos/contract-e2e/editar")
  await expect(page.getByText("Contratos assinados não podem ser editados.")).toBeVisible()
})
