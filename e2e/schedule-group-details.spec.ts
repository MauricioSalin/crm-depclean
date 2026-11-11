import { expect, test, type Page } from "@playwright/test"
import { installApiMock, scheduleFixture, serviceFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const visits = [
  { id: "vivaz-10", date: "2026-11-10", duration: 480, status: "completed", completionStartTime: "09:00", completionEndTime: "16:10", executionDurationMinutes: 430 },
  { id: "vivaz-11", date: "2026-11-11", duration: 480, status: "scheduled" },
  { id: "vivaz-12", date: "2026-11-12", duration: 240, status: "scheduled" },
].map((visit, index) => ({
  ...scheduleFixture, ...visit, clientName: "Vivaz Ecoville", serviceTypeName: "Limpeza de caixa d'água", multiDayGroupId: "vivaz-10", multiDayIndex: index + 1,
  multiDayTotal: 3, time: "08:00", durationType: "hours", durationValue: visit.duration / 60, teams: [], additionalEmployees: [],
  multiDayDates: index === 0 ? ["2026-11-10", "2026-11-11", "2026-11-12"] : [],
  multiDayTimes: index === 0 ? ["08:00", "08:00", "08:00"] : [],
  multiDayDurations: index === 0 ? [480, 480, 240] : undefined,
}))

async function setup(page: Page, onlyLastVisit = false, canEditLocked = true) {
  const user = { ...E2E_USER, permissions: E2E_USER.permissions.filter((permission) => canEditLocked || permission !== "settings_manage") }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  const updates: { id: string; payload: Record<string, unknown> }[] = []
  const pastCapacity = { ...visits[0], id: "other-client", clientName: "Outro cliente", multiDayGroupId: "", multiDayIndex: 1, multiDayTotal: 1,
    multiDayDates: [], multiDayTimes: [], multiDayDurations: undefined, status: "scheduled", duration: 720, durationValue: 12 }
  await page.route("**/api/v1/services**", (route) => route.fulfill({ json: { success: true, data: [{ ...serviceFixture, name: "Limpeza de caixa d'água", dailyScheduleLimitHours: 16 }] } }))
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith("/schedules") && request.method() === "GET") {
      return route.fulfill({ json: { success: true, data: onlyLastVisit ? visits.slice(2) : [...visits, pastCapacity] } })
    }
    const visit = visits.find((item) => path.endsWith(`/${item.id}`))
    if (!visit) return route.fallback()
    if (request.method() === "PATCH") updates.push({ id: visit.id, payload: request.postDataJSON() })
    return route.fulfill({ json: { success: true, data: { ...visit, visits } } })
  })
  return updates
}

async function expectFullDetails(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Detalhes do agendamento de Vivaz Ecoville" })
  await expect(dialog.getByText("3 dias • 20 horas previstas", { exact: true })).toBeVisible()
  const days = dialog.getByRole("list", { name: "Dias do atendimento" })
  await expect(days.getByRole("listitem")).toHaveCount(3)
  await expect(days).toContainText("Dia 1 · 10/11/2026")
  await expect(days).toContainText("Dia 2 · 11/11/2026")
  await expect(days).toContainText("Dia 3 · 12/11/2026")
  await expect(days.getByRole("listitem").first()).toContainText("Concluído")
  await expect(days.getByRole("listitem").first()).toContainText("Executado de 09:00 a 16:10")
  await expect(dialog.getByText("Execução de 10/11/2026", { exact: true })).toBeVisible()
  return dialog
}

test("qualquer card da Agenda abre o grupo inteiro e a edição salva pela primeira visita", async ({ page }) => {
  const updates = await setup(page)
  await page.goto("/agenda?date=2026-11-11")
  for (const visit of visits) {
    await page.locator(`button[data-schedule-id="${visit.id}"]`).click()
    await expectFullDetails(page)
    await page.keyboard.press("Escape")
  }
  await page.locator('button[data-schedule-id="vivaz-12"]').click()
  const details = await expectFullDetails(page)
  await details.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  const editor = page.getByRole("dialog", { name: "Editar atendimento recorrente" })
  await expect(editor.getByLabel("Duração do agendamento", { exact: true })).toHaveValue("3")
  await expect(editor.getByRole("button", { name: "Dia 1", exact: true })).toHaveText("10/11/2026")
  await expect(editor.getByRole("button", { name: "Dia 3", exact: true })).toHaveText("12/11/2026")
  await expect(editor.getByText("Status manual", { exact: true })).toHaveCount(0)
  await editor.getByLabel("Duração do Dia 3", { exact: true }).fill("3")
  await editor.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => updates).toContainEqual({ id: "vivaz-10", payload: expect.objectContaining({
    multiDayDates: ["2026-11-10", "2026-11-11", "2026-11-12"], multiDayDurations: [480, 480, 180], durationValue: 3,
  }) })
})

test("Agendamentos no celular carrega dias fora da lista e edita o atendimento completo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page, true, false)
  await page.goto("/agendamentos")
  await page.getByText("Vivaz Ecoville", { exact: true }).click()
  const details = await expectFullDetails(page)
  await details.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  const editor = page.getByRole("dialog", { name: "Editar atendimento recorrente" })
  await expect(editor.getByLabel("Duração do agendamento", { exact: true })).toHaveValue("3")
  await expect(editor.getByLabel("Duração do Dia 1", { exact: true })).toHaveValue("8")
  await expect(editor.getByLabel("Duração do Dia 1", { exact: true })).toBeDisabled()
  await expect(editor.getByLabel("Duração do Dia 2", { exact: true })).toHaveValue("8")
  await expect(editor.getByLabel("Duração do Dia 3", { exact: true })).toHaveValue("4")
  await expect(editor.getByLabel("Duração do Dia 3", { exact: true })).toBeEditable()
  const overflow = await editor.evaluate((element) => element.scrollWidth - element.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test("o atalho do dashboard também abre e edita todos os dias do atendimento", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"))
  await setup(page)
  await page.goto("/")
  await page.getByRole("region", { name: "Hoje", exact: true }).getByRole("button", { name: "Abrir agendamento de Vivaz Ecoville", exact: true }).click()
  const details = await expectFullDetails(page)
  await details.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  const editor = page.getByRole("dialog", { name: "Editar atendimento recorrente" })
  await expect(editor.getByLabel("Duração do agendamento", { exact: true })).toHaveValue("3")
  await expect(editor.getByRole("button", { name: "Dia 1", exact: true })).toHaveText("10/11/2026")
  await expect(editor.getByLabel("Duração do Dia 3", { exact: true })).toHaveValue("4")
})
