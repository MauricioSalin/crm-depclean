import { expect, test } from "@playwright/test"

import { employeeFixture, installApiMock, scheduleFixture, teamFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const DAY = "2026-07-28"
const maria = {
  ...employeeFixture,
  id: "employee-maria",
  name: "Maria Responsável",
  email: "maria@depclean.test",
  cpf: "111.111.111-11",
  role: "Técnica operacional",
  teamIds: [],
}
const idleEmployee = {
  ...employeeFixture,
  id: "employee-idle",
  name: "Funcionário sem agenda",
  email: "idle@depclean.test",
  cpf: "222.222.222-22",
  teamIds: [],
}
const teamSchedule = {
  ...scheduleFixture,
  date: DAY,
  status: "completed" as const,
  additionalEmployees: [],
}
const employeeSchedule = {
  ...scheduleFixture,
  id: "schedule-maria",
  clientId: "client-maria",
  clientName: "Cliente da Maria",
  contractId: null,
  contractServiceId: null,
  contractServiceIds: [],
  isManual: true,
  isEmergency: true,
  teamId: undefined,
  teamName: undefined,
  teams: [],
  additionalEmployees: [{ id: maria.id, name: maria.name }],
  date: DAY,
  time: "09:00",
  duration: 60,
  durationValue: 60,
}
const cancelledSchedule = {
  ...employeeSchedule,
  id: "schedule-maria-cancelled",
  clientId: "client-maria-cancelled",
  clientName: "Atendimento cancelado da Maria",
  time: "11:00",
  status: "cancelled" as const,
  cancellationReason: "Cancelado para validação visual.",
}
const inProgressSchedule = {
  ...employeeSchedule,
  id: "schedule-maria-in-progress",
  clientId: "client-maria-in-progress",
  clientName: "Atendimento em andamento da Maria",
  isEmergency: false,
  time: "13:00",
  status: "in_progress" as const,
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.route("**/api/v1/employees**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [employeeFixture, maria, idleEmployee] }),
    })
  })
  await page.route("**/api/v1/teams**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [teamFixture] }),
    })
  })
  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: [teamSchedule, employeeSchedule, cancelledSchedule, inProgressSchedule],
      }),
    })
  })
})

test("ordena avulsos antes das equipes, diferencia os cabeçalhos e preenche a pessoa do horário vago", async ({ page }) => {
  await page.goto(`/agenda?date=${DAY}&view=day`)

  await expect(page.getByRole("tab", { name: "Dia", exact: true })).toHaveAttribute("data-state", "active")
  expect(await page.getByRole("tab").allTextContents()).toEqual(["Dia", "Semana", "Mês"])
  const employeeHeader = page.getByRole("button", { name: `Funcionário avulso: ${maria.name}` })
  const teamHeader = page.getByRole("button", { name: `Equipe: ${teamFixture.name}` })
  await expect(employeeHeader).toBeVisible()
  await expect(teamHeader).toBeVisible()
  await expect(employeeHeader.locator("svg.lucide-user-round")).toBeVisible()
  await expect(teamHeader.locator("svg.lucide-users-round")).toBeVisible()
  await expect(employeeHeader).toHaveCSS("border-top-width", "0px")
  await expect(employeeHeader).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await expect(page.locator('[data-resource-column="employee"]')).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  const employeeHeaderBox = await employeeHeader.boundingBox()
  const teamHeaderBox = await teamHeader.boundingBox()
  expect(employeeHeaderBox).not.toBeNull()
  expect(teamHeaderBox).not.toBeNull()
  expect(employeeHeaderBox!.x).toBeLessThan(teamHeaderBox!.x)

  await expect(page.getByText(employeeFixture.name, { exact: true })).toHaveCount(0)
  await expect(page.getByText(idleEmployee.name, { exact: true })).toHaveCount(0)
  await expect(page.getByText(maria.role, { exact: true })).toBeVisible()

  const emergencyCard = page.getByRole("button", { name: new RegExp(employeeSchedule.clientName) })
  const teamCard = page.getByRole("button", { name: new RegExp(teamSchedule.clientName) })
  const cancelledCard = page.getByRole("button", { name: new RegExp(cancelledSchedule.clientName) })
  const inProgressCard = page.getByRole("button", { name: new RegExp(inProgressSchedule.clientName) })
  await expect(emergencyCard).toHaveCSS("border-left-color", "rgb(220, 38, 38)")
  await expect(emergencyCard).toHaveAttribute("style", /background-color: color-mix\(in srgb, .* 10%, white\)/)
  await expect(teamCard).toHaveAttribute("style", /background-color: color-mix\(in srgb, .* 6%, white\)/)
  await expect(teamCard).toHaveAttribute("style", /border-color: color-mix\(in srgb, .* 45%, white\)/)
  await expect(teamCard).toHaveCSS("opacity", "1")
  await expect(teamCard).toHaveCSS("filter", "none")
  await expect(emergencyCard).toHaveCSS("opacity", "1")
  await expect(cancelledCard).toHaveCSS("opacity", "1")
  await expect(cancelledCard).toHaveCSS("filter", "none")
  await expect(cancelledCard).toHaveAttribute("style", /background-color: color-mix\(in srgb, .* 6%, white\)/)
  await expect(cancelledCard).toHaveAttribute("style", /border-color: color-mix\(in srgb, .* 45%, white\)/)
  await expect(inProgressCard).toHaveAttribute(
    "style",
    /background-color: color-mix\(in srgb, rgb\(237, 214, 107\) 10%, white\)/,
  )
  await expect(inProgressCard).toHaveCSS("border-top-color", "rgb(237, 214, 107)")
  await expect(inProgressCard).toHaveCSS("border-right-color", "rgb(237, 214, 107)")
  await expect(inProgressCard).toHaveCSS("border-bottom-color", "rgb(237, 214, 107)")
  await expect(inProgressCard).toHaveCSS("border-left-color", "rgb(237, 214, 107)")
  await expect(inProgressCard).toHaveCSS("opacity", "1")

  await cancelledCard.click()
  const cancelledDetailsDialog = page.getByRole("dialog", { name: new RegExp(cancelledSchedule.clientName) })
  const cancellationReasonCard = cancelledDetailsDialog
    .getByText("Motivo do cancelamento", { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]")
  await expect(cancellationReasonCard).toHaveClass(/bg-red-50\/70/)
  await expect(cancellationReasonCard).toHaveClass(/border-red-100/)
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Mostrar detalhes do dia" }).click()
  const dayPanel = page
    .getByText("Terça-feira, 28 de julho", { exact: true })
    .locator("xpath=ancestor::div[@data-slot='card'][1]")
  await expect(dayPanel.getByText(teamSchedule.clientName, { exact: true })).toBeVisible()
  await expect(dayPanel.getByText(employeeSchedule.clientName, { exact: true })).toBeVisible()
  await expect(dayPanel.getByText(cancelledSchedule.clientName, { exact: true })).toBeVisible()
  await expect(dayPanel.getByText(inProgressSchedule.clientName, { exact: true })).toBeVisible()
  const emergencyPanelCard = dayPanel
    .getByRole("heading", { name: employeeSchedule.clientName, exact: true })
    .locator("xpath=ancestor::div[@data-slot='card'][1]")
  await expect(emergencyPanelCard).toHaveClass(/border-red-300/)
  await expect(emergencyPanelCard).not.toHaveClass(/bg-red-50/)
  const inProgressPanelCard = dayPanel
    .getByRole("heading", { name: inProgressSchedule.clientName, exact: true })
    .locator("xpath=ancestor::div[@data-slot='card'][1]")
  await expect(inProgressPanelCard).not.toHaveClass(/bg-yellow-/)
  await expect(inProgressPanelCard).toHaveCSS("border-color", "rgb(237, 214, 107)")
  await expect(
    emergencyPanelCard.locator('[data-slot="badge"]').filter({ hasText: maria.name }),
  ).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await expect(emergencyPanelCard.getByRole("button", { name: "Editar" })).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  )

  await page.getByRole("button", { name: `Novo agendamento em ${DAY} às 10:00 para ${maria.name}` }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("28/07/2026", { exact: true })).toBeVisible()
  await expect(dialog.locator('input[type="time"]')).toHaveValue("10:00")
  await expect(dialog.getByText(maria.name, { exact: true })).toBeVisible()
})

test("mantém vermelho o indicador mensal do atendimento avulso emergencial", async ({ page }) => {
  await page.goto(`/agenda?date=${DAY}&view=month`)

  const emergencyDot = page.getByTitle(`${employeeSchedule.clientName} - ${employeeSchedule.serviceTypeName}`)
  const teamDot = page.getByTitle(`${teamSchedule.clientName} - ${teamSchedule.serviceTypeName}`)
  await expect(emergencyDot).toHaveCSS("background-color", "rgb(220, 38, 38)")
  await expect(teamDot).toHaveCSS("background-color", "rgb(132, 199, 0)")
})

test("abre o calendário pelo dia e mês e navega para a data escolhida", async ({ page }) => {
  await page.goto(`/agenda?date=${DAY}&view=day`)

  const periodButton = page.getByRole("button", { name: /Selecionar dia, mês e ano:/ })
  await expect(periodButton).toBeVisible()
  await periodButton.click()
  await page.locator('[data-day="30/07/2026"]').click()

  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2026-07-30")
  await expect(periodButton).toContainText("30 de julho de 2026")
})

test("mostra somente a coluna do usuário com visão restrita e limita sua largura", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await installAuthenticatedSession(page, {
    ...E2E_USER,
    id: "user-own-agenda",
    name: maria.name,
    email: maria.email,
    permissions: ["agenda_own_view"],
    employeeId: maria.id,
    role: maria.role,
  })

  const sharedSchedule = {
    ...teamSchedule,
    id: "schedule-shared-responsibility",
    additionalEmployees: [
      { id: maria.id, name: maria.name },
      { id: employeeFixture.id, name: employeeFixture.name },
    ],
  }
  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [sharedSchedule] }),
    })
  })

  await page.goto(`/agenda?date=${DAY}&view=day`)

  await expect(page.getByRole("button", { name: `Funcionário avulso: ${maria.name}` })).toBeVisible()
  await expect(page.getByRole("button", { name: `Funcionário avulso: ${employeeFixture.name}` })).toHaveCount(0)
  await expect(page.getByRole("button", { name: `Equipe: ${teamFixture.name}` })).toHaveCount(0)
  await expect(page.locator('[data-resource-column="employee"]')).toHaveCount(1)

  const resourceWidthRatio = () => page.evaluate(() => {
    const timeline = document.querySelector<HTMLElement>("[data-agenda-timeline-scroll]")
    const resource = document.querySelector<HTMLElement>('[data-resource-column="employee"]')
    if (!timeline || !resource) return 0
    return resource.getBoundingClientRect().width / (timeline.clientWidth - 56)
  })

  expect(await resourceWidthRatio()).toBeGreaterThan(0.23)
  expect(await resourceWidthRatio()).toBeLessThan(0.27)

  await page.setViewportSize({ width: 1100, height: 900 })
  await expect.poll(resourceWidthRatio).toBeGreaterThan(0.31)
  expect(await resourceWidthRatio()).toBeLessThan(0.35)
})

test("rola várias colunas lateralmente por arraste sem transformar o gesto em clique", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })

  const employees = Array.from({ length: 8 }, (_, index) => ({
    ...employeeFixture,
    id: `employee-scroll-${index}`,
    name: `Responsável ${String(index + 1).padStart(2, "0")}`,
    email: `responsavel${index + 1}@depclean.test`,
    cpf: `333.333.33${index}-${index}`,
    role: "Técnico operacional",
    teamIds: [],
  }))
  const schedules = employees.map((employee, index) => ({
    ...scheduleFixture,
    id: `schedule-scroll-${index}`,
    clientId: `client-scroll-${index}`,
    clientName: `Cliente ${index + 1}`,
    contractId: null,
    contractServiceId: null,
    contractServiceIds: [],
    isManual: true,
    isEmergency: false,
    teamId: undefined,
    teamName: undefined,
    teams: [],
    additionalEmployees: [{ id: employee.id, name: employee.name }],
    date: DAY,
    time: "08:00",
    duration: 60,
    durationValue: 60,
  }))

  await page.route("**/api/v1/employees**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: employees }),
    })
  })
  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: schedules }),
    })
  })

  await page.goto(`/agenda?date=${DAY}&view=day`)

  const scroller = page.locator("[data-agenda-timeline-scroll]")
  await expect(scroller).toBeVisible()
  const dimensions = await scroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth)

  const scrollerBox = await scroller.boundingBox()
  expect(scrollerBox).not.toBeNull()
  const dragY = scrollerBox!.y + Math.min(180, scrollerBox!.height / 2)
  const dragStartX = scrollerBox!.x + scrollerBox!.width - 100
  await page.mouse.move(dragStartX, dragY)
  await page.mouse.down()
  await page.mouse.move(dragStartX - 450, dragY, { steps: 10 })
  await page.mouse.up()

  await expect(page.getByRole("dialog")).toHaveCount(0)
  const scrollPositions = await page.evaluate(() => {
    const timeline = document.querySelector<HTMLElement>("[data-agenda-timeline-scroll]")
    const header = document.querySelector<HTMLElement>("[data-agenda-timeline-header-scroll]")
    return {
      timeline: timeline?.scrollLeft ?? 0,
      header: header?.scrollLeft ?? 0,
    }
  })
  expect(scrollPositions.timeline).toBeGreaterThan(0)
  expect(Math.abs(scrollPositions.timeline - scrollPositions.header)).toBeLessThanOrEqual(1)

  await page.getByRole("button", {
    name: `Novo agendamento em ${DAY} às 10:00 para ${employees[4].name}`,
  }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('input[type="time"]')).toHaveValue("10:00")
  await expect(dialog.getByText(employees[4].name, { exact: true })).toBeVisible()
})
