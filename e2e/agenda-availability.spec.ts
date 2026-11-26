import { expect, test } from "@playwright/test"
import { combineAgendaAvailabilityResources, getAgendaMonthAvailability } from "../lib/schedule-availability"
import type { ScheduleRecord } from "../lib/api/schedules"
import type { TeamRecord } from "../lib/api/teams"
import { clientFixture, employeeFixture, installApiMock, scheduleFixture, teamFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const NOW = new Date("2026-11-24T10:00:00-03:00")
const team = { ...teamFixture, permissionId: "" } satisfies TeamRecord
const resource = { id: "team", name: team.name, teamIds: [team.id], employeeIds: [] }
const displayEmployee = { ...employeeFixture, name: "Funcionário com Nome Completo de Teste da Disponibilidade" }
const idleEmployee = { ...employeeFixture, id: "employee-without-schedules", name: "Funcionário sem agendamento", teamIds: [] }
const idleTeam = { ...team, id: "team-idle", name: "Equipe disponível", memberIds: [idleEmployee.id], members: [{ id: idleEmployee.id, name: idleEmployee.name }] }
const otherClient = { ...clientFixture, id: "other-client", companyName: "Outro cliente" }
const makeSchedule = (changes: Partial<ScheduleRecord> = {}) => ({ ...scheduleFixture, date: "2026-11-25", additionalEmployees: [], durationValue: changes.duration ?? scheduleFixture.durationValue, ...changes }) as ScheduleRecord
const calculate = (schedules: ScheduleRecord[], extra = {}) => getAgendaMonthAvailability({
  schedules, teams: [team], resources: [resource], dates: ["2026-11-25"], durationMinutes: 60, now: NOW, ...extra,
})

test("calcula livre, parcial e lotado sem contar almoço ou sobreposição de intervalos", () => {
  expect(calculate([])[0].status).toBe("free")
  const partial = calculate([makeSchedule({ time: "08:00", duration: 120 })])[0]
  expect(partial.status).toBe("partial")
  expect(partial.resources[0].times).toContain("10:00")
  expect(partial.resources[0].times).not.toContain("09:30")
  expect(partial.resources[0].times).not.toContain("11:30")
  expect(partial.resources[0].times).not.toContain("12:00")
  expect(calculate([makeSchedule({ time: "08:00", duration: 540 })])[0].status).toBe("full")
})

test("respeita duração, funcionários compartilhados e cancelamentos", () => {
  const busy = makeSchedule({ teams: [], additionalEmployees: [{ id: employeeFixture.id, name: employeeFixture.name }], time: "08:00", duration: 540 })
  expect(calculate([busy])[0].status).toBe("full")
  expect(calculate([{ ...busy, status: "cancelled" }])[0].status).toBe("free")
  const afternoon = makeSchedule({ time: "10:00", duration: 420 })
  expect(calculate([afternoon], { durationMinutes: 120 })[0].resources[0].times).toEqual(["08:00"])
  expect(calculate([afternoon], { durationMinutes: 240 })[0].status).toBe("full")
})

test("considera visitas em datas específicas e atendimentos que cruzam a meia-noite", () => {
  const multi = makeSchedule({ date: "2026-11-23", durationType: "days", duration: 960, durationValue: 2,
    multiDayDates: ["2026-11-23", "2026-11-25"], multiDayTimes: ["08:00", "08:00"], multiDayDurations: [540, 540] })
  expect(calculate([multi])[0].status).toBe("full")
  const overnight = makeSchedule({ date: "2026-11-24", time: "23:00", duration: 600 })
  expect(calculate([overnight])[0].resources[0].times[0]).toBe("09:00")
})

test("mostra o dia atual inteiro e identifica horários passados sem inventar disponibilidade sem recursos", () => {
  const days = calculate([], { dates: ["2026-11-23", "2026-11-24", "2026-11-28"] })
  expect(days[0].status).toBe("closed")
  expect(days[1].resources[0].times[0]).toBe("08:00")
  expect(days[1].resources[0].pastTimes).toContain("09:30")
  expect(days[1].resources[0].pastTimes).not.toContain("10:00")
  expect(days[2].status).toBe("closed")
  expect(calculate([], { dates: ["2026-11-28"], includeWeekends: true })[0].status).toBe("free")
  expect(calculate([], { resources: [] })[0].status).toBe("closed")
  const evening = calculate([], { dates: ["2026-11-24"], now: new Date("2026-11-24T23:00:00-03:00") })[0]
  expect(evening.status).toBe("free")
  expect(evening.resources[0].times.length).toBeGreaterThan(0)
  expect(evening.resources[0].pastTimes).toEqual(evening.resources[0].times)
})

test("opção em conjunto usa apenas a interseção dos horários livres", () => {
  const first = { id: "first", name: displayEmployee.name, teamIds: [], employeeIds: [displayEmployee.id] }
  const second = { id: "second", name: idleEmployee.name, teamIds: [], employeeIds: [idleEmployee.id] }
  const combined = combineAgendaAvailabilityResources([first, second], [team])!
  const schedules = [
    makeSchedule({ teams: [], additionalEmployees: [{ id: displayEmployee.id, name: displayEmployee.name }], time: "08:00", duration: 120 }),
    makeSchedule({ id: "busy-second", teams: [], additionalEmployees: [{ id: idleEmployee.id, name: idleEmployee.name }], time: "10:00", duration: 120 }),
  ]
  const result = calculate(schedules, { resources: [first, second, combined] })[0]
  const [a, b, together] = result.resources
  expect(together.times).toEqual(a.times.filter((time) => b.times.includes(time)))
  expect(together.times[0]).toBe("13:00")
  const noCommon = calculate([
    { ...schedules[0], time: "13:00", duration: 240, durationValue: 240 },
    { ...schedules[1], time: "08:00", duration: 240, durationValue: 240 },
  ], { resources: [first, second, combined] })[0]
  expect(noCommon.resources[0].times.length).toBeGreaterThan(0)
  expect(noCommon.resources[1].times.length).toBeGreaterThan(0)
  expect(noCommon.resources[2].times).toEqual([])
})

test("equipes respeitam conflitos dos integrantes e o conjunto não duplica funcionários cobertos", () => {
  const overlappingTeam = { ...idleTeam, memberIds: [displayEmployee.id, idleEmployee.id] }
  const resources = [
    { id: "team:first", name: team.name, teamIds: [team.id], employeeIds: [] },
    { id: "team:second", name: overlappingTeam.name, teamIds: [overlappingTeam.id], employeeIds: [] },
  ]
  const busy = makeSchedule({ teams: [], additionalEmployees: [{ id: displayEmployee.id, name: displayEmployee.name }], time: "08:00", duration: 540 })
  expect(calculate([busy], { teams: [team, overlappingTeam], resources })[0].status).toBe("full")
  const combined = combineAgendaAvailabilityResources([
    resources[0],
    { id: "employee:first", name: displayEmployee.name, teamIds: [], employeeIds: [displayEmployee.id] },
    { id: "employee:second", name: idleEmployee.name, teamIds: [], employeeIds: [idleEmployee.id] },
  ], [team, idleTeam])!
  expect(combined.teamIds).toEqual([team.id])
  expect(combined.employeeIds).toEqual([idleEmployee.id])
})

test("disponibilidade do cliente considera somente seus atendimentos, cancelamentos e visitas em várias datas", () => {
  const client = { id: "client", name: "", kind: "client", clientId: clientFixture.id, teamIds: [], employeeIds: [] }
  const busy = makeSchedule({ time: "08:00", duration: 120 })
  const result = calculate([busy, makeSchedule({ clientId: otherClient.id, time: "10:00", duration: 420 })], { resources: [client] })[0]
  expect(result.status).toBe("partial")
  expect(result.resources[0].times).toContain("10:00")
  expect(result.resources[0].times).not.toContain("09:30")
  expect(calculate([{ ...busy, status: "cancelled" }], { resources: [client] })[0].status).toBe("free")
  const multi = makeSchedule({ date: "2026-11-23", durationType: "days", duration: 960, durationValue: 2,
    multiDayDates: ["2026-11-23", "2026-11-25"], multiDayTimes: ["08:00", "08:00"], multiDayDurations: [540, 540] })
  expect(calculate([multi], { resources: [client] })[0].status).toBe("full")
  const overnight = makeSchedule({ date: "2026-11-24", time: "23:00", duration: 600 })
  expect(calculate([overnight], { resources: [client] })[0].resources[0].times[0]).toBe("09:00")
})

async function setup(page: import("@playwright/test").Page, now = NOW) {
  await page.clock.install({ time: now })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(/\/api\/v1\/clients(?:\?|$)/, (route) => route.fulfill({ json: { success: true, data: [clientFixture, otherClient] } }))
  await page.route("**/api/v1/teams**", (route) => route.fulfill({ json: { success: true, data: [team, idleTeam] } }))
  await page.route("**/api/v1/employees**", (route) => route.fulfill({ json: { success: true, data: [displayEmployee, idleEmployee] } }))
  await page.route("**/api/v1/schedules", (route) => route.fulfill({ json: { success: true, data: [
    makeSchedule({ id: "busy", duration: 540 }),
    makeSchedule({ id: "partial", date: "2026-11-26", duration: 120 }),
  ] } }))
  await page.goto("/agenda?date=2026-11-25&view=day&status=completed&q=cliente-inexistente")
  const availabilityButton = page.getByRole("button", { name: "Disponibilidade", exact: true })
  const newScheduleButton = page.getByRole("button", { name: "Novo Agendamento", exact: true })
  await expect(availabilityButton).toBeVisible()
  await expect(newScheduleButton).toBeVisible()
  const availabilityBox = await availabilityButton.boundingBox()
  const newScheduleBox = await newScheduleButton.boundingBox()
  expect(availabilityBox!.x).toBeLessThan(newScheduleBox!.x)
  expect(Math.abs(availabilityBox!.y - newScheduleBox!.y)).toBeLessThan(2)
  await availabilityButton.click()
  return page.getByRole("dialog", { name: "Disponibilidade da agenda" })
}

async function selectDuration(page: import("@playwright/test").Page, dialog: import("@playwright/test").Locator, label = "1 hora") {
  await dialog.getByRole("combobox", { name: "Duração do atendimento" }).click()
  await page.getByRole("option", { name: label, exact: true }).click()
}

async function selectEmployee(page: import("@playwright/test").Page, dialog: import("@playwright/test").Locator, name = displayEmployee.name) {
  await dialog.getByRole("combobox", { name: "Funcionário", exact: true }).click()
  await page.getByRole("option", { name, exact: true }).click()
  await page.keyboard.press("Escape")
}

test("hoje fica em negrito sem sublinhado e exibe resultados após o expediente sem permitir horários passados", async ({ page }) => {
  const dialog = await setup(page, new Date("2026-11-24T23:00:00-03:00"))
  await selectDuration(page, dialog)
  await selectEmployee(page, dialog)
  const today = dialog.locator('[data-availability-date="2026-11-24"]')
  await today.click()
  await expect(today).toHaveAttribute("data-availability-status", "free")
  await expect(today).toHaveAttribute("aria-current", "date")
  await expect(today.locator("span").first()).toHaveCSS("font-weight", "700")
  await expect(today.locator("span").first()).toHaveCSS("text-decoration-line", "none")
  await expect(dialog.getByRole("region", { name: "Horários disponíveis" }).getByText(displayEmployee.name, { exact: true })).toBeVisible()
  await expect(dialog.getByRole("button", { name: /Agendar.*às 08:00/ })).toBeDisabled()
  await expect(dialog.getByRole("button", { name: /Agendar.*às 16:00/ })).toBeDisabled()
  await dialog.locator('[data-availability-date="2026-11-27"]').click()
  await expect(dialog.getByRole("button", { name: /Agendar.*às 08:00/ })).toBeEnabled()
})

test("calendário mostra estados, filtro de duração e abre formulário preenchido", async ({ page }) => {
  const dialog = await setup(page)
  await expect(dialog.getByRole("combobox", { name: "Duração do atendimento" })).toHaveText("Duração")
  await selectEmployee(page, dialog)
  await selectDuration(page, dialog, "30 minutos")
  await expect(dialog.locator('[data-availability-date="2026-11-25"]')).toHaveAttribute("data-availability-status", "full")
  await expect(dialog.locator('[data-availability-date="2026-11-26"]')).toHaveAttribute("data-availability-status", "partial")
  await expect(dialog.locator('[data-availability-date="2026-11-27"]')).toHaveAttribute("data-availability-status", "free")
  await dialog.locator('[data-availability-date="2026-11-26"]').click()
  await dialog.getByRole("combobox", { name: "Duração do atendimento" }).click()
  await page.getByRole("option", { name: "2 horas", exact: true }).click()
  await expect(dialog.getByRole("button", { name: /Agendar.*às 10:00/ })).toBeVisible()
  await expect(dialog.getByRole("button", { name: /Agendar.*às 11:00/ })).toHaveCount(0)
  await dialog.getByRole("button", { name: /Agendar.*às 10:00/ }).click()
  await expect(dialog).toHaveCount(0)
  const form = page.getByRole("dialog")
  await expect(form).toBeVisible()
  await expect(form.locator('input[type="time"]').first()).toHaveValue("10:00")
  await expect(form.getByText(displayEmployee.name, { exact: true })).toBeVisible()
})

test("funciona no celular e consulta disponibilidade sem esconder conflitos pelos filtros da agenda", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const dialog = await setup(page)
  await selectDuration(page, dialog)
  await selectEmployee(page, dialog)
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await dialog.locator('[data-availability-date="2026-11-27"]').click()
  await expect(dialog.getByRole("button", { name: /Agendar.*às 08:00/ })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Ver agenda deste dia" })).toHaveCount(0)
  await expect(dialog.getByRole("region", { name: "Horários disponíveis" }).getByText(displayEmployee.name, { exact: true })).toBeVisible()
})

test("filtra somente funcionários, inclui finais de semana automaticamente e navega entre meses", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1000 })
  const dialog = await setup(page)
  await selectDuration(page, dialog)
  await selectEmployee(page, dialog)
  const selectedColors = new Set<string>()
  for (const date of ["2026-11-25", "2026-11-26", "2026-11-27"]) {
    const day = dialog.locator(`[data-availability-date="${date}"]`)
    await day.click()
    await expect(day).toHaveCSS("cursor", "pointer")
    await expect(day).toHaveAttribute("aria-pressed", "true")
    selectedColors.add(await day.evaluate((element) => getComputedStyle(element).borderTopColor))
  }
  expect(selectedColors.size).toBe(3)
  await dialog.locator('[data-availability-date="2026-11-28"]').click()
  await expect(dialog.locator('[data-availability-date="2026-11-28"]')).toHaveAttribute("data-availability-status", "free")
  await expect(dialog.getByRole("checkbox", { name: "Incluir fins de semana" })).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: /Primeira data disponível/ })).toHaveCount(0)
  await expect(dialog.getByText(/dias com disponibilidade neste mês|Livre: todos os horários possíveis|Consulta de 08h/)).toHaveCount(0)
  await dialog.getByRole("button", { name: "Próximo mês da disponibilidade" }).click()
  await expect(dialog.locator('[data-availability-date="2026-12-01"]')).toBeVisible()
  await dialog.getByRole("button", { name: "Mês anterior da disponibilidade" }).click()
  await dialog.locator('[data-availability-date="2026-11-26"]').click()
  await expect(dialog.locator('[data-availability-date="2026-11-26"]')).toHaveAttribute("aria-pressed", "true")
  await dialog.getByRole("heading", { name: "Disponibilidade da agenda" }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: "../output/agenda-disponibilidade-desktop.png" })
})

test("exige responsável e duração, muda a mensagem conforme falta filtrar e limpa os resultados", async ({ page }) => {
  const dialog = await setup(page)
  const slots = dialog.getByRole("region", { name: "Horários disponíveis" })
  await expect(slots).toHaveText("Selecione uma equipe ou funcionário e a duração para ver a disponibilidade.")
  await expect(slots.getByRole("heading")).toHaveCount(0)
  await expect(slots.getByRole("button")).toHaveCount(0)
  await dialog.locator('[data-availability-date="2026-11-27"]').click()
  await selectEmployee(page, dialog, idleEmployee.name)
  await expect(slots).toHaveText("Selecione a duração para ver a disponibilidade.")
  await selectDuration(page, dialog)
  await expect(slots.locator('[data-availability-employee]')).toHaveCount(1)
  await expect(slots.getByText(idleEmployee.name, { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: `Remover ${idleEmployee.name} do filtro`, exact: true }).click()
  await expect(slots).toHaveText("Selecione uma equipe ou funcionário para ver a disponibilidade.")
  await expect(slots.getByRole("button")).toHaveCount(0)
  await dialog.getByRole("button", { name: "Limpar filtros", exact: true }).click()
  await expect(slots).toHaveText("Selecione uma equipe ou funcionário e a duração para ver a disponibilidade.")
  await expect(dialog.getByRole("combobox", { name: "Funcionário", exact: true })).toHaveText("Funcionários")
  await expect(dialog.getByRole("combobox", { name: "Duração do atendimento" })).toHaveText("Duração")
  await expect(dialog.locator('[data-availability-date="2026-11-27"]')).toHaveAttribute("aria-pressed", "true")
  await expect(dialog.getByRole("button", { name: "Limpar filtros", exact: true })).toBeDisabled()
})

test("seleciona vários funcionários, recalcula disponibilidade e permite remover e limpar a seleção", async ({ page }) => {
  const dialog = await setup(page)
  await selectDuration(page, dialog)
  const employeeFilter = dialog.getByRole("combobox", { name: "Funcionário", exact: true })
  await employeeFilter.click()
  await page.getByRole("option", { name: displayEmployee.name, exact: true }).click()
  await page.getByRole("option", { name: idleEmployee.name, exact: true }).click()
  await expect(page.getByRole("option", { name: displayEmployee.name, exact: true }).locator("svg")).toHaveClass(/opacity-100/)
  await expect(page.getByRole("option", { name: idleEmployee.name, exact: true }).locator("svg")).toHaveClass(/opacity-100/)
  await page.keyboard.press("Escape")
  await expect(employeeFilter).toHaveText("2 funcionários selecionados")
  const selected = dialog.getByRole("group", { name: "Funcionários selecionados" })
  await expect(selected.getByText(displayEmployee.name, { exact: true })).toBeVisible()
  await expect(selected.getByText(idleEmployee.name, { exact: true })).toBeVisible()
  // One selected employee is fully booked; the other has a free day.
  await expect(dialog.locator('[data-availability-date="2026-11-25"]')).toHaveAttribute("data-availability-status", "partial")
  await expect(dialog.locator('[data-availability-combined="true"]')).toContainText("Nenhum horário em comum")
  await dialog.locator('[data-availability-date="2026-11-26"]').click()
  await expect(dialog.locator('[data-availability-employee]')).toHaveCount(2)
  const scheduledEmployeeCard = dialog.locator(`[data-availability-employee="${displayEmployee.id}"]`)
  const idleEmployeeCard = dialog.locator(`[data-availability-employee="${idleEmployee.id}"]`)
  await expect(scheduledEmployeeCard.getByRole("button", { name: /às 08:00/ })).toHaveCount(0)
  await expect(scheduledEmployeeCard.getByRole("button", { name: /às 10:00/ })).toBeVisible()
  await expect(idleEmployeeCard.getByRole("button", { name: /às 08:00/ })).toBeVisible()
  const together = dialog.locator('[data-availability-combined="true"]')
  await expect(together.getByRole("button", { name: /às 08:00/ })).toHaveCount(0)
  await expect(together.getByRole("button", { name: /às 10:00/ })).toBeVisible()
  await dialog.getByRole("button", { name: `Remover ${idleEmployee.name} do filtro`, exact: true }).click()
  await expect(employeeFilter).toHaveText("1 funcionário selecionado")
  await expect(dialog.locator('[data-availability-date="2026-11-25"]')).toHaveAttribute("data-availability-status", "full")
  await expect(dialog.locator('[data-availability-employee]')).toHaveCount(1)
  await dialog.getByRole("button", { name: "Limpar filtros", exact: true }).click()
  await expect(employeeFilter).toHaveText("Funcionários")
  await expect(selected).toHaveCount(0)
  await expect(dialog.getByRole("combobox", { name: "Duração do atendimento" })).toHaveText("Duração")
})

test("abre agendamento em conjunto com os dois funcionários e a duração selecionada", async ({ page }) => {
  const dialog = await setup(page)
  await dialog.getByRole("combobox", { name: "Funcionário", exact: true }).click()
  await page.getByRole("option", { name: displayEmployee.name, exact: true }).click()
  await page.getByRole("option", { name: idleEmployee.name, exact: true }).click()
  await page.keyboard.press("Escape")
  await dialog.getByRole("combobox", { name: "Duração do atendimento" }).click()
  await page.getByRole("option", { name: "2 horas", exact: true }).click()
  await dialog.locator('[data-availability-date="2026-11-26"]').click()
  await dialog.locator('[data-availability-combined="true"]').getByRole("button", { name: /às 10:00/ }).click()
  const form = page.getByRole("dialog")
  await expect(form.locator('input[type="time"]').first()).toHaveValue("10:00")
  await expect(form.getByText(displayEmployee.name, { exact: true })).toBeVisible()
  await expect(form.getByText(idleEmployee.name, { exact: true })).toBeVisible()
})

test("filtra várias equipes, mostra conjunto e limpa funcionários, equipes e duração", async ({ page }) => {
  const dialog = await setup(page)
  await selectDuration(page, dialog)
  const teamFilter = dialog.getByRole("combobox", { name: "Equipes", exact: true })
  await teamFilter.click()
  await page.getByRole("option", { name: team.name, exact: true }).click()
  await page.getByRole("option", { name: idleTeam.name, exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(teamFilter).toHaveText("2 equipes selecionadas")
  await expect(dialog.getByRole("group", { name: "Equipes selecionadas" }).getByText(team.name, { exact: true })).toBeVisible()
  await expect(dialog.locator('[data-availability-employee]')).toHaveCount(0)
  await expect(dialog.locator('[data-availability-combined="true"]')).toContainText("Nenhum horário em comum")
  await dialog.locator('[data-availability-date="2026-11-26"]').click()
  await expect(dialog.locator('[data-availability-team]')).toHaveCount(2)
  await expect(dialog.locator(`[data-availability-team="${team.id}"]`).getByRole("button", { name: /às 08:00/ })).toHaveCount(0)
  await expect(dialog.locator(`[data-availability-team="${idleTeam.id}"]`).getByRole("button", { name: /às 08:00/ })).toBeVisible()
  await dialog.getByRole("button", { name: `Remover equipe ${idleTeam.name} do filtro`, exact: true }).click()
  await expect(teamFilter).toHaveText("1 equipe selecionada")
  await expect(dialog.locator('[data-availability-combined="true"]')).toHaveCount(0)
  await dialog.getByRole("combobox", { name: "Funcionário", exact: true }).click()
  await page.getByRole("option", { name: idleEmployee.name, exact: true }).click()
  await page.keyboard.press("Escape")
  await dialog.getByRole("combobox", { name: "Duração do atendimento" }).click()
  await page.getByRole("option", { name: "2 horas", exact: true }).click()
  await dialog.getByRole("button", { name: "Limpar filtros", exact: true }).click()
  await expect(teamFilter).toHaveText("Equipes")
  await expect(dialog.getByRole("combobox", { name: "Funcionário", exact: true })).toHaveText("Funcionários")
  await expect(dialog.getByRole("combobox", { name: "Duração do atendimento" })).toHaveText("Duração")
  await expect(dialog.getByRole("group", { name: "Equipes selecionadas" })).toHaveCount(0)
})

test("agendamento em conjunto de equipes preenche todas as equipes selecionadas", async ({ page }) => {
  const dialog = await setup(page)
  await selectDuration(page, dialog)
  await dialog.getByRole("combobox", { name: "Equipes", exact: true }).click()
  await page.getByRole("option", { name: team.name, exact: true }).click()
  await page.getByRole("option", { name: idleTeam.name, exact: true }).click()
  await page.keyboard.press("Escape")
  await dialog.locator('[data-availability-date="2026-11-26"]').click()
  await dialog.locator('[data-availability-combined="true"]').getByRole("button", { name: /às 10:00/ }).click()
  const form = page.getByRole("dialog")
  await expect(form.locator('input[type="time"]').first()).toHaveValue("10:00")
  await expect(form.getByText(team.name, { exact: true })).toBeVisible()
  await expect(form.getByText(idleTeam.name, { exact: true })).toBeVisible()
})

test("aba Clientes exige cliente e duração, usa seleção única e mostra somente horários", async ({ page }) => {
  const dialog = await setup(page)
  await selectEmployee(page, dialog)
  await dialog.getByRole("tab", { name: "Clientes", exact: true }).click()
  const slots = dialog.getByRole("region", { name: "Horários disponíveis" })
  await expect(slots).toHaveText("Selecione um cliente e a duração para ver a disponibilidade.")
  await expect(dialog.getByRole("combobox", { name: "Funcionário", exact: true })).toHaveCount(0)
  await expect(dialog.getByRole("combobox", { name: "Equipes", exact: true })).toHaveCount(0)
  await selectDuration(page, dialog, "2 horas")
  await expect(slots).toHaveText("Selecione um cliente para ver a disponibilidade.")
  const clientFilter = dialog.getByRole("combobox", { name: "Cliente", exact: true })
  await clientFilter.click()
  await page.getByRole("option", { name: clientFixture.companyName, exact: true }).click()
  await expect(dialog.locator('[data-availability-date="2026-11-25"]')).toHaveAttribute("data-availability-status", "full")
  await expect(dialog.locator('[data-availability-date="2026-11-26"]')).toHaveAttribute("data-availability-status", "partial")
  await expect(dialog.locator('[data-availability-date="2026-11-27"]')).toHaveAttribute("data-availability-status", "free")
  await dialog.locator('[data-availability-date="2026-11-26"]').click()
  await expect(slots.getByText(clientFixture.companyName, { exact: true })).toHaveCount(0)
  await expect(slots.locator('[data-availability-employee], [data-availability-team], [data-availability-combined]')).toHaveCount(0)
  await expect(slots.getByRole("button", { name: /às 08:00/ })).toHaveCount(0)
  await expect(slots.getByRole("button", { name: /às 10:00/ })).toBeVisible()
  await clientFilter.click()
  await page.getByRole("option", { name: otherClient.companyName, exact: true }).click()
  await expect(clientFilter).toHaveText(otherClient.companyName)
  await expect(dialog.locator('[data-availability-date="2026-11-25"]')).toHaveAttribute("data-availability-status", "free")
  await expect(slots.getByRole("button", { name: /às 08:00/ })).toBeVisible()
  await dialog.getByRole("tab", { name: "Funcionários", exact: true }).click()
  await expect(slots.getByText(displayEmployee.name, { exact: true })).toBeVisible()
  await dialog.getByRole("tab", { name: "Clientes", exact: true }).click()
  await expect(slots.getByText(displayEmployee.name, { exact: true })).toHaveCount(0)
  await dialog.getByRole("button", { name: "Limpar filtros", exact: true }).click()
  await expect(clientFilter).toHaveText("Cliente")
  await expect(slots).toHaveText("Selecione um cliente e a duração para ver a disponibilidade.")
  await clientFilter.click()
  await page.getByRole("option", { name: clientFixture.companyName, exact: true }).click()
  await expect(slots).toHaveText("Selecione a duração para ver a disponibilidade.")
})

test("horário na aba Clientes abre formulário com cliente, data e duração selecionados", async ({ page }) => {
  const dialog = await setup(page)
  await dialog.getByRole("tab", { name: "Clientes", exact: true }).click()
  await dialog.getByRole("combobox", { name: "Cliente", exact: true }).click()
  await page.getByRole("option", { name: clientFixture.companyName, exact: true }).click()
  await selectDuration(page, dialog, "2 horas")
  await dialog.locator('[data-availability-date="2026-11-26"]').click()
  await dialog.getByRole("button", { name: "Agendar em 2026-11-26 às 10:00", exact: true }).click()
  const form = page.getByRole("dialog")
  await expect(form.locator('input[type="time"]').first()).toHaveValue("10:00")
  await expect(form.getByRole("combobox").filter({ hasText: clientFixture.companyName })).toBeVisible()
})

for (const width of [320, 390]) {
  async function expectFullscreen(dialog: import("@playwright/test").Locator) {
    await expect(dialog).toHaveCSS("width", `${width}px`)
    await expect(dialog).toHaveCSS("height", "844px")
    await expect(dialog).toHaveCSS("border-radius", "0px")
    await expect.poll(async () => {
      const box = await dialog.boundingBox()
      return box ? { x: Math.round(box.x), y: Math.round(box.y) } : null
    }).toEqual({ x: 0, y: 0 })
  }

  test(`aba Clientes acessível no celular de ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const dialog = await setup(page)
    await expectFullscreen(dialog)
    await dialog.getByRole("tab", { name: "Clientes", exact: true }).click()
    await expect(dialog.getByRole("region", { name: "Horários disponíveis" })).toContainText("Selecione um cliente e a duração")
    await dialog.getByRole("combobox", { name: "Cliente", exact: true }).click()
    await page.getByRole("option", { name: clientFixture.companyName, exact: true }).click()
    await selectDuration(page, dialog)
    await dialog.locator('[data-availability-date="2026-11-26"]').click()
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await dialog.getByRole("heading", { name: "Disponibilidade da agenda" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `../output/agenda-disponibilidade-clientes-mobile-${width}.png` })
    const slot = dialog.getByRole("button", { name: /Agendar em.*às 10:00/ })
    await slot.scrollIntoViewIfNeeded()
    await expect(slot).toBeVisible()
    await page.screenshot({ path: `../output/agenda-disponibilidade-clientes-horarios-${width}.png` })
  })

  test(`modal sem sobreposição e horários acessíveis no celular de ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const dialog = await setup(page)
    await expectFullscreen(dialog)
    await selectDuration(page, dialog)
    await dialog.locator('[data-availability-date="2026-11-27"]').click()
    const employeeFilter = dialog.getByRole("combobox", { name: "Funcionário", exact: true })
    await employeeFilter.click()
    await page.getByRole("option", { name: displayEmployee.name, exact: true }).click()
    await page.getByRole("option", { name: idleEmployee.name, exact: true }).click()
    await page.keyboard.press("Escape")
    await expect(employeeFilter).toHaveText("2 funcionários selecionados")
    const teamFilter = dialog.getByRole("combobox", { name: "Equipes", exact: true })
    await teamFilter.click()
    await page.getByRole("option", { name: idleTeam.name, exact: true }).click()
    await page.keyboard.press("Escape")
    await expect(teamFilter).toHaveText("1 equipe selecionada")
    await dialog.getByRole("heading", { name: "Disponibilidade da agenda" }).scrollIntoViewIfNeeded()
    await expect(dialog.getByRole("button", { name: "Fechar", exact: true })).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Limpar filtros", exact: true })).toBeVisible()
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await expect(dialog.locator('[data-slot="dialog-header"] svg')).toHaveCount(0)
    await expect(dialog.locator('[data-slot="dialog-header"]')).toHaveCSS("border-bottom-width", "0px")
    await expect(dialog.getByRole("button", { name: "Ver agenda deste dia" })).toHaveCount(0)
    await expect(dialog.locator('[aria-label="Calendário de disponibilidade"]')).toHaveCSS("border-top-width", "1px")
    const slots = dialog.getByRole("region", { name: "Horários disponíveis" })
    await expect(slots).toHaveCSS("border-top-width", "0px")
    await expect(slots.locator('[data-availability-employee]')).toHaveCount(2)
    await expect(slots.locator('[data-availability-employee]').first()).toHaveCSS("border-top-width", "0px")
    await page.screenshot({ path: `../output/agenda-disponibilidade-mobile-${width}.png` })
    const fullName = slots.getByText(displayEmployee.name, { exact: true })
    await fullName.scrollIntoViewIfNeeded()
    await expect(fullName).toBeVisible()
    expect(await fullName.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    const slot = slots.locator(`[data-availability-employee="${displayEmployee.id}"]`).getByRole("button", { name: /Agendar.*às 08:00/ })
    await slot.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `../output/agenda-disponibilidade-mobile-horarios-${width}.png` })
    await slot.click()
    await expect(page.getByRole("dialog").locator('input[type="time"]').first()).toHaveValue("08:00")
  })
}
