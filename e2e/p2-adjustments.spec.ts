import { expect, test } from "@playwright/test"
import { contractFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import { multiDayDateValues, multiDayTimeValues } from "../lib/schedule-multi-day"
import { checkScheduleAvailability } from "../lib/schedule-availability"
import type { ScheduleRecord } from "../lib/api/schedules"

test("P2: disponibilidade considera o horário próprio dos dias adicionais", () => {
  const date = "2026-11-06"
  const existing = { ...scheduleFixture, date: "2026-11-07", time: "13:30", duration: 60, durationType: "hours", durationValue: 1, teams: [{ id: "team-p2", name: "Equipe", color: "" }], additionalEmployees: [] } as ScheduleRecord
  const formData = { date, time: "08:00", duration: 3, durationType: "days" as const, multiDayDates: [date, "2026-11-07", "2026-11-08"], multiDayTimes: ["08:00", "13:30", "09:00"], teamIds: ["team-p2"], employeeIds: [] }
  const params = { schedules: [existing], teams: [], formData, mode: "manual" as const, suggestAlternative: false }
  expect(checkScheduleAvailability(params).available).toBe(false)
  expect(checkScheduleAvailability({ ...params, formData: { ...formData, multiDayTimes: ["08:00", "15:30", "09:00"] } }).available).toBe(true)
})

test("P2: dias adicionais nascem consecutivos, preenchidos e preservam escolhas", () => {
  expect(multiDayDateValues("2026-11-06", 3)).toEqual(["2026-11-06", "2026-11-07", "2026-11-08"])
  expect(multiDayDateValues("2026-11-06", 4, ["2026-11-06", "2026-11-10", "2026-11-13"])).toEqual(["2026-11-06", "2026-11-10", "2026-11-13", "2026-11-14"])
  expect(multiDayDateValues("2026-11-10", 3, ["2026-11-06", "2026-11-07", "2026-11-08"])).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"])
  expect(multiDayTimeValues("08:00", 3)).toEqual(["08:00", "08:00", "08:00"])
  expect(multiDayTimeValues("09:00", 3, ["08:00", "13:30", "08:00"])).toEqual(["09:00", "13:30", "09:00"])
  expect(multiDayTimeValues("08:00", 4, ["08:00", "13:30", ""])).toEqual(["08:00", "13:30", "13:30", "13:30"])
})

test("P2: conclui parcialmente com motivo e duas placas e apresenta duração real", async ({ page }) => {
  const date = "2026-10-27"
  let schedule = { ...scheduleFixture, date, status: "in_progress", completionStartDate: date, completionStartTime: "08:00", completionEndDate: date, completionEndTime: "10:35", executionDurationMinutes: undefined as number | undefined, statusHistory: [] as Array<Record<string, string>> }
  let payload: Record<string, any> | null = null
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/vehicles", (route) => route.fulfill({ json: { success: true, data: { types: [{ id: "truck", name: "Caminhão" }, { id: "car", name: "Carro" }], vehicles: [{ id: "a", typeId: "truck", plate: "ABC1D23" }, { id: "b", typeId: "car", plate: "XYZ9876" }] } } }))
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === "GET" && pathname.endsWith("/schedules")) return route.fulfill({ json: { success: true, data: [schedule] } })
    if (request.method() === "GET" && pathname.endsWith("/completion-employees")) return route.fulfill({ json: { success: true, data: [] } })
    if (request.method() === "PATCH" && pathname.endsWith("/complete")) {
      payload = request.postDataJSON()
      schedule = { ...schedule, status: "partially_completed", executionDurationMinutes: 155, statusHistory: [{ status: "partially_completed", reason: payload!.partialReason, changedAt: new Date().toISOString(), changedByName: "Administrador E2E" }], ...{ attendanceVehiclePlate: payload!.vehiclePlates.join(", "), attendanceVehiclePlates: payload!.vehiclePlates } }
      return route.fulfill({ json: { success: true, data: schedule } })
    }
    await route.fallback()
  })
  await page.goto(`/agenda?date=${date}`)
  await page.getByRole("button", { name: /Condomínio E2E/ }).click()
  await page.getByRole("button", { name: "Encerrar atendimento", exact: true }).click()
  await page.getByLabel("Horário de fim *").fill("10:35")
  await page.locator("#agenda-completion-vehicle-type").click()
  await page.getByRole("option", { name: "Caminhão", exact: true }).click()
  await page.locator("#agenda-completion-vehicle-plate").click()
  await page.getByRole("option", { name: "ABC1D23", exact: true }).click()
  await page.getByRole("button", { name: "Adicionar veículo", exact: true }).click()
  await page.locator("#agenda-completion-vehicle-type-1").click()
  await page.getByRole("option", { name: "Carro", exact: true }).click()
  await page.locator("#agenda-completion-vehicle-plate-1").click()
  await page.getByRole("option", { name: "XYZ9876", exact: true }).click()
  await page.getByRole("button", { name: "Concluir parcialmente", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Concluir parcialmente", exact: true })
  await expect(dialog.getByRole("button", { name: "Confirmar conclusão parcial" })).toBeDisabled()
  await dialog.getByLabel("Motivo *").fill("Retornar para executar o trecho restante.")
  await dialog.getByRole("button", { name: "Confirmar conclusão parcial" }).click()
  await expect.poll(() => payload?.vehiclePlates).toEqual(["ABC1D23", "XYZ9876"])
  await expect.poll(() => payload?.partialReason).toBe("Retornar para executar o trecho restante.")
  await expect(page.getByRole("heading", { name: "Encerrar atendimento", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: /Condomínio E2E/ }).click()
  const details = page.getByRole("dialog")
  await expect(details.locator("[data-schedule-detail-badges] [data-slot=badge]").filter({ hasText: "Concluído Parcial" })).toBeVisible()
  await expect(details.locator('[data-schedule-detail-card="history"] [data-slot=badge]')).toHaveCount(0)
  await expect(details.locator('[data-schedule-detail-card="history"]').getByText("Concluído Parcial", { exact: true })).toHaveCount(0)
  await details.locator("[data-schedule-detail-badges]").screenshot({ path: "../output/p2-detail-status-badges.png" })
  await expect(details.getByText("2 horas e 35 minutos", { exact: true })).toBeVisible()
  await expect(details.getByText("ABC1D23, XYZ9876", { exact: true })).toBeVisible()
  await expect(details.getByText("Retornar para executar o trecho restante.", { exact: true })).toBeVisible()
})

test("P2: seção fixa permite data e horário por dia sem campos vazios", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    if (route.request().method() === "GET" && new URL(route.request().url()).pathname.endsWith("/schedules")) return route.fulfill({ json: { success: true, data: [{ ...scheduleFixture, date: "2026-11-06", time: "08:00", duration: 480, durationType: "days", durationValue: 1, multiDayGroupId: "group-p2", multiDayTotal: 3, multiDayIndex: 1, multiDayDates: ["2026-11-06", "2026-11-10", "2026-11-13"], multiDayTimes: ["08:00", "13:30", "09:00"] }] } })
    await route.fallback()
  })
  await page.goto("/agendamentos")
  await page.getByRole("button", { name: "Abrir ações do agendamento de Condomínio E2E" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const section = page.getByRole("region", { name: "Dias adicionais do atendimento" })
  await expect(section).toBeVisible()
  await expect(section.getByText(/Datas do atendimento/)).toHaveCount(0)
  await expect(section.locator("details, summary")).toHaveCount(0)
  await expect(section.getByText("Dia 1", { exact: true })).toHaveCount(0)
  await expect(section.getByRole("button", { name: "Dia 2", exact: true })).toHaveText("10/11/2026")
  await expect(section.getByRole("button", { name: "Dia 3", exact: true })).toHaveText("13/11/2026")
  await expect(section.getByLabel("Horário do Dia 2")).toHaveValue("13:30")
  await section.getByLabel("Horário do Dia 2").fill("14:00")
  await section.getByLabel("Horário do Dia 2").fill("")
  await expect(section.getByLabel("Horário do Dia 2")).toHaveValue("14:00")
  await section.getByRole("button", { name: "Dia 2", exact: true }).click()
  await page.getByRole("button", { name: /terça-feira, 10 de novembro de 2026/i }).click()
  await page.keyboard.press("Escape")
  await expect(section.getByRole("button", { name: "Dia 2", exact: true })).toHaveText("10/11/2026")
  await page.getByLabel("Duração", { exact: true }).fill("4")
  const expanded = section
  await expect(expanded.getByRole("button", { name: "Dia 4", exact: true })).toHaveText("14/11/2026")
  await expect(expanded.getByLabel("Horário do Dia 4")).toHaveValue("09:00")
  await expanded.scrollIntoViewIfNeeded()
  await expanded.screenshot({ path: "../output/p2-multiday-fields-desktop.png" })
  await page.setViewportSize({ width: 390, height: 844 })
  await expanded.scrollIntoViewIfNeeded()
  await expanded.screenshot({ path: "../output/p2-multiday-fields-mobile.png" })
})

test("P2: plano mantém o rascunho ao trocar de aba e dias dentro do item sem título ou recuo", async ({ page, context }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  const contract = { ...contractFixture, status: "closed", signedAt: "2026-10-20", clicksign: { envelopeId: "envelope-p2-test", documentKey: "document-p2-test", status: "closed", signers: [] }, automationCreateSchedules: true, automationSchedulePlanSavedAt: "2026-10-27T12:00:00Z" }
  let item = { ...scheduleFixture, id: "schedule-plan-p2", contractId: contract.id, date: "2026-11-02", time: "08:00", duration: 1440, durationValue: 3, durationType: "days", multiDayDates: ["2026-11-02", "2026-11-05", "2026-11-10"], multiDayTimes: ["08:00", "08:00", "08:00"], teams: [], additionalEmployees: [] }
  const nextItem = { ...item, id: "schedule-plan-next", date: "2026-12-02", duration: 60, durationValue: 1, durationType: "hours", multiDayDates: [], multiDayTimes: [] }
  let savedDates: string[] = []
  let savedTimes: string[] = []
  let planReads = 0
  await page.route("**/api/v1/contracts**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/schedule-plan")) {
      if (route.request().method() === "PATCH") {
        savedDates = route.request().postDataJSON().items[0].multiDayDates
        savedTimes = route.request().postDataJSON().items[0].multiDayTimes
        item = { ...item, multiDayDates: savedDates, multiDayTimes: savedTimes }
      } else {
        planReads++
      }
      return route.fulfill({ json: { success: true, data: { items: [{ ...item, updatedAt: `2026-10-28T12:00:${String(planReads).padStart(2, "0")}Z` }, nextItem], generatedItems: [item, nextItem], anchorDate: "2026-10-23", endDate: "2027-07-28", isSaved: true, isPublished: false } } })
    }
    if (pathname.endsWith("/contracts/" + contract.id)) return route.fulfill({ json: { success: true, data: contract } })
    await route.fallback()
  })
  await page.goto(`/contratos/${contract.id}`)
  await page.getByRole("button", { name: "Agendamentos", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Agendamentos previstos" })
  await expect(dialog.getByRole("region", { name: "Dias adicionais do atendimento" })).toBeVisible()
  await expect(dialog.getByText(/Datas do atendimento/)).toHaveCount(0)
  await expect(dialog.getByText("Dia 2", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Dia 3", { exact: true })).toBeVisible()
  await dialog.getByLabel("Horário do Dia 2").fill("13:30")
  await dialog.getByLabel("Horário do Dia 3").fill("09:00")
  await dialog.locator('[data-schedule-id="schedule-plan-p2"] input[type="tel"]').fill("4")
  await expect(dialog.getByRole("button", { name: "Dia 4", exact: true })).toHaveText("11/11/2026")
  const parent = dialog.locator('[data-schedule-id="schedule-plan-p2"]')
  await expect(parent).toHaveCSS("border-bottom-width", "0px")
  const section = dialog.getByRole("region", { name: "Dias adicionais do atendimento" })
  const bounds = await section.boundingBox()
  const tableBounds = await dialog.locator("table").first().boundingBox()
  expect(bounds).not.toBeNull()
  expect(tableBounds).not.toBeNull()
  expect(Math.abs(bounds!.x - tableBounds!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(bounds!.width - tableBounds!.width)).toBeLessThanOrEqual(1)
  await dialog.screenshot({ path: "../output/p2-plan-item-layout.png" })
  const readsBeforeFocus = planReads
  const otherTab = await context.newPage()
  await otherTab.goto("about:blank")
  await otherTab.bringToFront()
  await page.bringToFront()
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")))
  await expect.poll(() => planReads).toBeGreaterThan(readsBeforeFocus)
  await expect(dialog.getByLabel("Horário do Dia 2")).toHaveValue("13:30")
  await expect(dialog.getByLabel("Horário do Dia 3")).toHaveValue("09:00")
  await expect(parent.locator('input[type="tel"]')).toHaveValue("4")
  await otherTab.close()
  await dialog.getByRole("button", { name: "Voltar", exact: true }).click()
  await page.getByRole("button", { name: "Agendamentos", exact: true }).click()
  await expect(dialog.getByLabel("Horário do Dia 2")).toHaveValue("08:00")
  await expect(dialog.getByRole("button", { name: "Dia 4", exact: true })).toHaveCount(0)
  await dialog.getByLabel("Horário do Dia 2").fill("13:30")
  await dialog.getByLabel("Horário do Dia 3").fill("09:00")
  await dialog.getByRole("button", { name: "Salvar agendamentos", exact: true }).click()
  await expect.poll(() => savedDates).toEqual(["2026-11-02", "2026-11-05", "2026-11-10"])
  await expect.poll(() => savedTimes).toEqual(["08:00", "13:30", "09:00"])
})

for (const editChildDirectly of [false, true]) {
  test(`P2: edita a referência do segundo dia ${editChildDirectly ? "diretamente" : "pela seção Dia 2"} sem pedir reagendamento`, async ({ page }) => {
    await installAuthenticatedSession(page)
    await installApiMock(page)
    const record = { ...scheduleFixture, date: editChildDirectly ? "2026-11-05" : "2026-11-03", time: "08:00", status: "scheduled", duration: 480, durationType: "days", durationValue: 1, multiDayGroupId: "reference-ui", multiDayIndex: editChildDirectly ? 2 : 1, multiDayTotal: 2,
      multiDayDates: editChildDirectly ? [] : ["2026-11-03", "2026-11-05"], multiDayTimes: editChildDirectly ? [] : ["08:00", "08:00"] }
    let payload: Record<string, any> | null = null
    let statusUpdates = 0
    await page.route("**/api/v1/schedules**", async (route) => {
      const request = route.request(), pathname = new URL(request.url()).pathname
      if (request.method() === "GET" && pathname.endsWith("/schedules")) return route.fulfill({ json: { success: true, data: [record] } })
      if (request.method() === "PATCH" && pathname.endsWith("/status")) statusUpdates++
      if (request.method() === "PATCH" && pathname.endsWith("/" + record.id)) {
        payload = request.postDataJSON()
        return route.fulfill({ json: { success: true, data: record } })
      }
      await route.fallback()
    })
    await page.goto("/agendamentos")
    await page.getByRole("button", { name: "Abrir ações do agendamento de Condomínio E2E" }).click()
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: /Editar atendimento/ })
    await dialog.getByRole("button", { name: editChildDirectly ? "05/11/2026" : "Dia 2", exact: true }).click()
    await page.getByRole("button", { name: /segunda-feira, 9 de novembro de 2026/i }).click()
    if (editChildDirectly) await dialog.locator('input[type="time"]').fill("13:30")
    else await dialog.getByLabel("Horário do Dia 2").fill("13:30")
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
    await expect.poll(() => payload).not.toBeNull()
    expect(payload!.rescheduleReason).toBeUndefined()
    expect(statusUpdates).toBe(0)
    if (editChildDirectly) {
      expect(payload!.scheduledDate).toBe("2026-11-09")
      expect(payload!.scheduledTime).toBe("13:30")
    } else {
      expect(payload!.scheduledDate).toBe("2026-11-03")
      expect(payload!.multiDayDates).toEqual(["2026-11-03", "2026-11-09"])
      expect(payload!.multiDayTimes).toEqual(["08:00", "13:30"])
    }
    await expect(page.getByRole("button", { name: "Salvar reagendamento", exact: true })).toHaveCount(0)
  })
}

test("P2: plano legado salvo mantém 12 e 18 ativos sem criar card fantasma no dia 13", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  const dates = ["2026-11-12", "2026-11-18"]
  const parent = { ...scheduleFixture, id: "legacy-plan", date: dates[0], time: "08:00", status: "rescheduled", duration: 960, durationType: "days", durationValue: 2, multiDayGroupId: "legacy-plan", multiDayIndex: 1, multiDayTotal: 2, multiDayDates: dates, multiDayTimes: ["08:00", "13:00"] }
  const child = { ...parent, id: "legacy-plan-day-2", date: dates[1], time: "13:00", status: "cancelled", duration: 480, durationValue: 1, multiDayIndex: 2, multiDayDates: [], multiDayTimes: [] }
  let records = [parent, child]
  let saves = 0
  await page.route("**/api/v1/schedules**", async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    if (request.method() === "GET" && pathname.endsWith("/schedules")) return route.fulfill({ json: { success: true, data: records } })
    if (request.method() === "PATCH" && pathname.endsWith("/legacy-plan")) {
      const payload = request.postDataJSON()
      expect(payload.multiDayDates).toEqual(dates)
      expect(payload.multiDayTimes).toEqual(["08:00", "13:00"])
      records = [{ ...parent, duration: 480, durationValue: 1 }, { ...child, status: "rescheduled" }]
      saves++
      return route.fulfill({ json: { success: true, data: records[0] } })
    }
    await route.fallback()
  })
  await page.goto("/agenda?date=2026-11-12&view=week")
  const initial = page.locator('button[data-schedule-id="legacy-plan"]')
  await expect(initial).toHaveCount(1)
  await page.goto("/agendamentos")
  const row = page.getByRole("row").filter({ hasText: "12/11/2026" })
  await row.getByRole("button", { name: /Abrir ações do agendamento/ }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: /Editar atendimento/ })
  await expect(dialog.getByRole("button", { name: "Dia 2", exact: true })).toHaveText("18/11/2026")
  await expect(dialog.getByLabel("Horário do Dia 2")).toHaveValue("13:00")
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => saves).toBe(1)
  await page.reload()
  await expect(page.getByRole("row").filter({ hasText: "18/11/2026" }).getByText("Reagendado", { exact: true })).toBeVisible()
  await page.goto("/agenda?date=2026-11-12&view=week")
  await expect(page.locator('button[data-schedule-id="legacy-plan"]')).toHaveCount(1)
  await expect(page.locator('button[data-schedule-id="legacy-plan-day-2"]')).toHaveCount(0)
  await page.goto("/agenda?date=2026-11-18&view=week")
  const second = page.locator('button[data-schedule-id="legacy-plan-day-2"]')
  await expect(second).toHaveCount(1)
  await expect(second).toContainText("13:00")
  await expect(second).not.toHaveClass(/opacity-50|line-through/)
  await second.screenshot({ path: "../output/p2-fixed-day-18-timeline.png" })
})
