import { expect, test } from "@playwright/test"
import { contractFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

for (const width of [1440, 390]) {
  test(`limite fica abaixo do vencimento e checkbox desabilita sem perder valor (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    await installAuthenticatedSession(page)
    await installApiMock(page)
    await page.goto("/contratos/novo")
    const limit = page.locator("#contract-emergency-limit-create")
    const dueDay = page.getByLabel("Dia de vencimento *", { exact: true })
    const unlimited = page.getByRole("checkbox", { name: "Sem limite de agendamentos emergenciais", exact: true })
    await expect(limit).toHaveValue("15")
    const limitBox = await limit.boundingBox(), dueBox = await dueDay.boundingBox()
    expect(limitBox!.y).toBeGreaterThan(dueBox!.y + dueBox!.height)
    expect(Math.abs(limitBox!.width - dueBox!.width)).toBeLessThan(1)
    expect(Math.abs(limitBox!.x - dueBox!.x)).toBeLessThan(1)
    await limit.fill("8")
    await unlimited.check()
    await expect(limit).toBeDisabled()
    await expect(limit).not.toHaveAttribute("required", "")
    await expect(limit).toHaveValue("8")
    await unlimited.uncheck()
    await expect(limit).toBeEnabled()
    await expect(limit).toHaveValue("8")
    await limit.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath("limite-emergencias.png") })
  })
}

test("salva e reabre sem limite no contrato assinado e não mostra alerta esgotado", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  let unlimited = false
  const contract = () => ({ ...contractFixture, status: "closed", emergencyLimit: 15, emergencyUnlimited: unlimited, isAwaitingSchedules: false })
  await page.route(`**/api/v1/contracts/${contractFixture.id}`, route => route.fulfill({ json: { success: true, data: contract() } }))
  await page.route("**/api/v1/emergencies**", route => route.fulfill({ json: { success: true, data: [{ contractId: contractFixture.id, clientId: contractFixture.clientId, limit: 15, used: 20, unlimited, remaining: unlimited ? null : 0, exhausted: !unlimited }] } }))
  await page.route(`**/api/v1/contracts/${contractFixture.id}/emergency-limit`, async route => {
    expect(route.request().postDataJSON()).toEqual({ emergencyLimit: 15, emergencyUnlimited: true })
    unlimited = true
    await route.fulfill({ json: { success: true, data: contract() } })
  })
  await page.goto(`/contratos/${contractFixture.id}/editar`)
  await page.getByRole("checkbox", { name: "Sem limite de agendamentos emergenciais", exact: true }).check()
  await expect(page.locator("#contract-emergency-limit-create")).toBeDisabled()
  await page.getByRole("button", { name: "Salvar", exact: true }).first().click()
  await page.waitForURL(url => url.pathname === `/contratos/${contractFixture.id}`)
  await expect(page.getByText("Sem limite", { exact: true })).toBeVisible()
  await expect(page.getByText("20 emergências utilizadas", { exact: true })).toBeVisible()
  await expect(page.getByText("Emergencias esgotadas", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Editar", exact: true }).click()
  await expect(page.getByRole("checkbox", { name: "Sem limite de agendamentos emergenciais", exact: true })).toBeChecked()
  await expect(page.locator("#contract-emergency-limit-create")).toHaveValue("15")
})
