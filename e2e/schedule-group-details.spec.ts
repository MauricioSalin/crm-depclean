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

async function setup(page: Page, onlyLastVisit = false, canEditLocked = true, technician = false) {
  const user = { ...E2E_USER, permissions: technician ? ["agenda_own_view"] : E2E_USER.permissions.filter((permission) => canEditLocked || permission !== "settings_manage") }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  const updates: { id: string; payload: Record<string, unknown> }[] = []
  const records = visits.map((visit) => ({ ...visit, canStartAttendance: true, canAttachNa: true,
    additionalEmployees: [{ id: E2E_USER.employeeId, name: "Técnico E2E" }] }))
  const pastCapacity = { ...visits[0], id: "other-client", clientName: "Outro cliente", multiDayGroupId: "", multiDayIndex: 1, multiDayTotal: 1,
    multiDayDates: [], multiDayTimes: [], multiDayDurations: undefined, status: "scheduled", duration: 720, durationValue: 12 }
  await page.route("**/api/v1/services**", (route) => route.fulfill({ json: { success: true, data: [{ ...serviceFixture, name: "Limpeza de caixa d'água", dailyScheduleLimitHours: 16 }] } }))
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith("/schedules") && request.method() === "GET") {
      return route.fulfill({ json: { success: true, data: onlyLastVisit ? records.slice(2) : [...records, pastCapacity] } })
    }
    const visit = records.find((item) => path.endsWith(`/${item.id}`) || path.endsWith(`/${item.id}/status`) || path.endsWith(`/${item.id}/start`))
    if (!visit) return route.fallback()
    if (request.method() === "PATCH") {
      updates.push({ id: visit.id, payload: request.postDataJSON() })
      if (path.endsWith("/status")) visit.status = request.postDataJSON().status
      if (path.endsWith("/start")) visit.status = "in_progress"
    }
    return route.fulfill({ json: { success: true, data: { ...visit, visits: records } } })
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


for (const width of [1440, 390]) test(`navega pelos dias na mesma modal e altera apenas o dia escolhido (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"))
  const updates = await setup(page, true)
  await page.goto("/agendamentos")
  await page.getByText("Vivaz Ecoville", { exact: true }).click()
  const details = await expectFullDetails(page)
  await details.evaluate((element) => element.setAttribute("data-original-dialog", "yes"))
  await details.getByRole("button", { name: "Abrir Dia 3 de 12/11/2026", exact: true }).click()
  await expect(details).toHaveAttribute("data-original-dialog", "yes")
  await expect(details.getByRole("list", { name: "Dias do atendimento" })).toHaveCount(0)
  await expect(details.locator('[data-schedule-detail-card="scheduled-time"]')).toContainText("4 horas")
  await expect(details.locator('[data-schedule-detail-card="execution"]')).toHaveCount(0)
  await details.getByRole("button", { name: "Voltar ao atendimento completo", exact: true }).click()
  await expectFullDetails(page)
  await details.getByRole("button", { name: "Abrir Dia 2 de 11/11/2026", exact: true }).click()
  await expect(details.locator('[data-schedule-detail-card="scheduled-date"]')).toContainText("11/11/2026")
  await expect(details.locator('[data-schedule-detail-card="scheduled-time"]')).toContainText("8 horas")
  await details.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  const editor = page.getByRole("dialog", { name: "Editar atendimento recorrente" })
  await expect(editor.getByText("Status manual", { exact: true })).toBeVisible()
  await expect(editor.getByLabel("Duração do agendamento", { exact: true })).toHaveValue("8")
  await editor.getByText("Status manual", { exact: true }).locator("..").getByRole("combobox").click()
  await page.getByRole("option", { name: "Não concluído", exact: true }).click()
  await editor.getByLabel("Motivo *", { exact: true }).fill("Cliente solicitou suspender somente esta visita.")
  await editor.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => updates.some((item) => item.id === "vivaz-11" && item.payload.status === "not_completed")).toBe(true)
  expect(updates.every((item) => item.id === "vivaz-11")).toBe(true)
  expect(updates.every((item) => !("multiDayDates" in item.payload))).toBe(true)
})

test("técnico continua abrindo e iniciando apenas a visita do dia", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"))
  const updates = await setup(page, false, false, true)
  await page.goto("/agenda?date=2026-11-11")
  await page.locator('button[data-schedule-id="vivaz-11"]').click()
  const details = page.getByRole("dialog", { name: "Detalhes do agendamento de Vivaz Ecoville" })
  await expect(details.getByRole("list", { name: "Dias do atendimento" })).toHaveCount(0)
  await expect(details.locator('[data-schedule-detail-card="scheduled-date"]')).toContainText("11/11/2026")
  await expect(details.locator('[data-schedule-detail-card="scheduled-time"]')).toContainText("8 horas")
  await expect(details.getByRole("button", { name: "Editar agendamento", exact: true })).toHaveCount(0)
  await details.getByRole("button", { name: "Iniciar atendimento", exact: true }).click()
  await expect.poll(() => updates.length).toBe(1)
  expect(updates[0].id).toBe("vivaz-11")
})


test("administra o check-in e os anexos do dia selecionado sem usar a primeira visita concluída", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"))
  const updates = await setup(page)
  await page.goto("/agenda?date=2026-11-11")
  await page.locator('button[data-schedule-id="vivaz-10"]').click()
  const details = await expectFullDetails(page)
  await details.getByRole("button", { name: "Abrir Dia 2 de 11/11/2026", exact: true }).click()
  await expect(details.getByRole("button", { name: "Iniciar atendimento", exact: true })).toBeEnabled()
  await details.getByRole("button", { name: "Iniciar atendimento", exact: true }).click()
  await expect.poll(() => updates.map((item) => item.id)).toEqual(["vivaz-11"])
  await page.locator('button[data-schedule-id="vivaz-10"]').click()
  await expectFullDetails(page)
  await details.getByRole("button", { name: "Abrir Dia 2 de 11/11/2026", exact: true }).click()
  await details.getByRole("button", { name: "Encerrar atendimento de 11/11/2026", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Anexos do atendimento", exact: true })).toBeVisible()
})

test("dashboard edita a execução do dia concluído escolhido", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"))
  await setup(page)
  await page.goto("/")
  await page.getByRole("region", { name: "Hoje", exact: true }).getByRole("button", { name: "Abrir agendamento de Vivaz Ecoville", exact: true }).click()
  const details = await expectFullDetails(page)
  await details.getByRole("button", { name: "Abrir Dia 1 de 10/11/2026", exact: true }).click()
  await expect(details.getByText("Execução do atendimento", { exact: true })).toBeVisible()
  await details.getByRole("button", { name: "Editar execução do atendimento", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Editar execução do atendimento", exact: true })).toBeVisible()
  await expect(page.locator('#dashboard-schedule-completion-start-time')).toHaveValue("09:00")
})


test("reagenda somente a visita aberta dentro do grupo", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"))
  const updates = await setup(page, true)
  await page.goto("/agendamentos")
  await page.getByText("Vivaz Ecoville", { exact: true }).click()
  const details = await expectFullDetails(page)
  await details.getByRole("button", { name: "Abrir Dia 3 de 12/11/2026", exact: true }).click()
  await details.getByRole("button", { name: "Reagendar", exact: true }).click()
  await details.getByLabel("Motivo do reagendamento *", { exact: true }).click()
  await page.getByRole("option", { name: "Chuva", exact: true }).click()
  await details.getByLabel("Horário", { exact: true }).fill("09:00")
  await details.getByRole("button", { name: "Salvar reagendamento", exact: true }).click()
  await expect.poll(() => updates).toEqual([{ id: "vivaz-12", payload: expect.objectContaining({
    scheduledDate: "2026-11-12", scheduledTime: "09:00", rescheduleReason: "rain",
  }) }])
  expect(updates[0].payload).not.toHaveProperty("multiDayDates")
})
