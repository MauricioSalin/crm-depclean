import { expect, test, type Page } from "@playwright/test"
import { clientFixture, contractFixture, installApiMock, scheduleFixture, serviceFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const active = { id: contractFixture.id, contractNumber: "ATUAL-2026", startDate: "2026-01-01", endDate: "2026-12-31", isActive: true }
const expired = { ...active, id: "expired-contract", contractNumber: "ANTIGO-2025-condominio-com-nome-longo-para-identificar-o-contrato", startDate: "2025-01-01", endDate: "2025-12-31", isActive: false }
const date = "2026-07-29"

async function setup(page: Page, requiresContract = true, status = "scheduled") {
  await page.clock.setFixedTime(new Date("2026-07-28T12:00:00Z"))
  await installAuthenticatedSession(page)
  await installApiMock(page)
  let record = { ...scheduleFixture, date, status, isManual: true, contractId: "", isEmergency: true, emergencyContractId: "", emergencyContractNumber: "", billable: false }
  const requests: Array<Record<string, unknown>> = []
  await page.route("**/api/v1/schedules**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path === "/api/v1/schedules/emergency-contracts") {
      expect(url.searchParams.get("clientId")).toBe(clientFixture.id)
      return route.fulfill({ json: { success: true, data: { requiresContract, contracts: requiresContract ? [active, expired] : [] } } })
    }
    if ((path === "/api/v1/schedules" && request.method() === "POST") || (path === `/api/v1/schedules/${record.id}` && request.method() === "PATCH")) {
      const payload = request.postDataJSON()
      requests.push(payload)
      record = { ...record, ...payload, date: payload.scheduledDate || record.date, time: payload.scheduledTime || record.time, emergencyContractNumber: [active, expired].find(contract => contract.id === payload.emergencyContractId)?.contractNumber || "" }
      return route.fulfill({ json: { success: true, data: record } })
    }
    if (path === "/api/v1/schedules" && request.method() === "GET") return route.fulfill({ json: { success: true, data: [record] } })
    if (path === `/api/v1/schedules/${record.id}` && request.method() === "GET") return route.fulfill({ json: { success: true, data: record } })
    return route.fallback()
  })
  return { requests, record: () => record }
}

for (const route of ["/agenda", "/agendamentos"]) {
test(`emergencial exige contrato do cliente, inclui vencido e persiste na edição pela ${route}`, async ({ page }) => {
  const state = await setup(page)
  await page.goto(route)
  await page.getByRole("button", { name: "Novo Agendamento", exact: true }).click()
  const form = page.getByRole("dialog", { name: "Novo atendimento avulso", exact: true })
  await expect(form.getByLabel(/Contrato vinculado/)).toHaveCount(0)
  await form.getByText("Cliente *", { exact: true }).locator("..").getByRole("combobox").click()
  await page.getByRole("option", { name: clientFixture.companyName, exact: true }).click()
  await form.getByText("Serviços *", { exact: true }).locator("..").getByRole("combobox").click()
  await page.getByRole("option", { name: serviceFixture.name, exact: true }).click()
  await page.keyboard.press("Escape")
  await form.getByRole("button", { name: /Selecionar data|\d{2}\/\d{2}\/\d{4}/ }).click()
  await page.getByRole("button", { name: /29 de julho de 2026/i }).click()
  await form.locator('input[type="time"]').fill("14:00")
  await form.getByRole("checkbox", { name: "Agendamento emergencial", exact: true }).check()
  const contract = form.getByRole("combobox", { name: "Contrato vinculado *", exact: true })
  await expect(contract).toBeEnabled()
  await form.getByRole("button", { name: "Agendar", exact: true }).click()
  await expect(page.getByText("Selecione o contrato vinculado ao agendamento emergencial.", { exact: true })).toBeVisible()
  expect(state.requests).toHaveLength(0)
  await contract.click()
  await expect(page.getByRole("option", { name: /ATUAL-2026/ })).toBeVisible()
  await page.getByRole("option", { name: /ANTIGO-2025/ }).click()
  await form.getByRole("button", { name: "Agendar", exact: true }).click()
  await expect.poll(() => state.requests.length).toBe(1)
  expect(state.requests[0]).toMatchObject({ isEmergency: true, emergencyContractId: expired.id, billable: false })
  expect(state.requests[0]).not.toHaveProperty("contractId")
  await expect(form).toHaveCount(0)
  await page.goto(`/agenda?date=${date}&scheduleId=${scheduleFixture.id}`)
  const detail = page.getByRole("dialog")
  await expect(detail.getByText(expired.contractNumber, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Contrato vinculado *", exact: true })).toContainText("ANTIGO-2025")
  await page.getByRole("combobox", { name: "Contrato vinculado *", exact: true }).click()
  await page.getByRole("option", { name: /ATUAL-2026/ }).click()
  await page.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => state.requests.length).toBe(2)
  expect(state.requests[1]).toMatchObject({ emergencyContractId: active.id })
  expect(state.requests[1]).not.toHaveProperty("rescheduleReason")
  await page.reload()
  await expect(page.getByRole("dialog").getByText("ATUAL-2026", { exact: true })).toBeVisible()
})
}

test("cliente sem contrato vigente edita emergencial sem vínculo e sem badge de limite", async ({ page }) => {
  const state = await setup(page, false)
  await page.route("**/api/v1/emergencies", route => route.fulfill({ json: { success: true, data: [{ contractId: expired.id, clientId: clientFixture.id, used: 15, limit: 15, remaining: 0, exhausted: false, isActive: false }] } }))
  await page.goto(`/agenda?date=${date}&scheduleId=${scheduleFixture.id}`)
  await expect(page.getByRole("dialog").getByText("Sem vínculo", { exact: true })).toBeVisible()
  await expect(page.getByText("Emergencias esgotadas", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  const contract = page.getByRole("combobox", { name: "Contrato vinculado", exact: true })
  await expect(contract).toBeEnabled()
  await page.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => state.requests.length).toBe(1)
  expect(state.requests[0]).toMatchObject({ isEmergency: true, emergencyContractId: "" })
})

test("emergencial concluído sem vínculo permite escolha manual entre contratos em celular", async ({ page }) => {
  const state = await setup(page, true, "completed")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/agenda?date=${date}&scheduleId=${scheduleFixture.id}`)
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  const contract = page.getByRole("combobox", { name: "Contrato vinculado *", exact: true })
  await expect(contract).toHaveText("Selecione o contrato")
  await contract.click()
  await page.getByRole("option", { name: /ANTIGO-2025/ }).click()
  const box = await contract.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => state.requests.length).toBe(1)
  expect(state.requests[0]).toMatchObject({ emergencyContractId: expired.id })
  await page.reload()
  await expect(page.getByRole("dialog").getByText(expired.contractNumber, { exact: true })).toBeVisible()
})
