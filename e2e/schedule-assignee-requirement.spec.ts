import { expect, test } from "@playwright/test"
import { clientFixture, employeeFixture, installApiMock, scheduleFixture, serviceFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-28T12:00:00Z"))
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

for (const path of ["/agenda", "/agendamentos"]) {
  test(`cria atendimento avulso sem equipe ou funcionário pela ${path}`, async ({ page }) => {
    let saved: any
    await page.route("**/api/v1/schedules", async (route) => {
      if (route.request().method() !== "POST") return route.fallback()
      saved = route.request().postDataJSON()
      await route.fulfill({ json: { success: true, data: { ...scheduleFixture, ...saved, id: "unassigned-created", isManual: true } } })
    })
    await page.goto(path)
    await page.getByRole("button", { name: "Novo Agendamento", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Novo atendimento avulso" })
    await dialog.getByText("Cliente *", { exact: true }).locator("..").getByRole("combobox").click()
    await page.getByRole("option", { name: clientFixture.companyName, exact: true }).click()
    await dialog.getByText("Serviços *", { exact: true }).locator("..").getByRole("combobox").click()
    await page.getByRole("option", { name: serviceFixture.name, exact: true }).click()
    await page.keyboard.press("Escape")
    await dialog.getByText("Equipes", { exact: true }).locator("..").getByRole("button").click()
    await dialog.getByRole("button", { name: /Selecionar data|\d{2}\/\d{2}\/\d{4}/ }).click()
    await page.getByRole("button", { name: /29 de julho de 2026/i }).click()
    await dialog.locator('input[type="time"]').fill("08:00")
    await dialog.getByRole("button", { name: "Agendar", exact: true }).click()
    await expect.poll(() => saved).toMatchObject({ clientId: clientFixture.id, serviceTypeId: serviceFixture.id, teamIds: [], additionalEmployeeIds: [] })
    await expect(dialog).toHaveCount(0)
  })
}

test("remove o último funcionário e reabre o atendimento avulso sem atribuições", async ({ page }) => {
  let record: any = { ...scheduleFixture, contractId: "", contractServiceId: "", contractServiceIds: [], isManual: true,
    teamId: "", teamName: "", teamIds: [], teams: [], additionalEmployees: [employeeFixture], billable: false, value: 0,
  }
  const patches: any[] = []
  await page.route("**/api/v1/schedules**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/v1/schedules") return route.fulfill({ json: { success: true, data: [record] } })
    if (path !== `/api/v1/schedules/${record.id}`) return route.fallback()
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON()
      patches.push(payload)
      record = { ...record, ...payload, additionalEmployees: [], teams: [], teamId: "", teamName: "" }
    }
    await route.fulfill({ json: { success: true, data: record } })
  })
  const openForm = async () => {
    await page.goto("/agendamentos")
    await page.getByRole("button", { name: `Abrir ações do agendamento de ${record.clientName}` }).click()
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
    return page.getByRole("dialog", { name: "Editar atendimento avulso" })
  }
  const dialog = await openForm()
  await dialog.getByText("Funcionários Avulsos", { exact: true }).locator("..").getByRole("button").click()
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => patches.length).toBe(1)
  expect(patches[0]).toMatchObject({ teamIds: [], additionalEmployeeIds: [] })
  await expect(dialog).toHaveCount(0)

  const reopened = await openForm()
  await expect(reopened.getByText(employeeFixture.name, { exact: true })).toHaveCount(0)
  await reopened.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => patches.length).toBe(2)
  expect(patches[1]).toMatchObject({ teamIds: [], additionalEmployeeIds: [] })
  await expect(reopened).toHaveCount(0)
})
