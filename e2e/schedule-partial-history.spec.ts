import { expect, test, type Locator, type Page } from "@playwright/test"
import path from "node:path"
import ExcelJS from "exceljs"
import { clientFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import type { ScheduleRecord } from "../lib/api/schedules"

const base: ScheduleRecord = {
  ...scheduleFixture, durationType: "minutes", recurrence: { type: "none", daysOfWeek: [], interval: 1 },
  billingStatus: "pending", effectiveBillingStatus: "pending", status: "scheduled",
  isManual: true, contractId: null, contractServiceId: null, contractServiceIds: [],
}
const historical: ScheduleRecord = {
  ...base, id: "atlanta~execution~1", sourceScheduleId: "atlanta", isHistoricalExecution: true,
  clientName: "Atlanta", serviceTypeName: "Limpeza de rede", status: "partially_completed",
  date: "2026-10-20", time: "08:00", duration: 240, durationValue: 240, durationType: "minutes",
  completionStartDate: "2026-10-20", completionStartTime: "08:00", completionEndDate: "2026-10-20", completionEndTime: "12:00",
  executionDurationMinutes: 240, serviceReport: "Sucção realizada na primeira visita.",
  attendanceDisposal: { mtrNumber: "001234, 009876", mtrNumbers: ["001234", "009876"], type: "fossa", stationId: "station", stationName: "Estação", unitPrice: 19, quantityM3: 2, totalValue: 38 },
  billable: false, value: 0, canStartAttendance: false, canAttachNa: false,
  naAttachments: [{ fileName: "na-outubro.pdf", documentUrl: "/api/v1/files/atlanta/na-outubro.pdf" }],
}
const returnVisit: ScheduleRecord = {
  ...historical, id: "atlanta~execution~2", date: "2026-11-16", completionStartDate: "2026-11-16", completionEndDate: "2026-11-16",
  duration: 120, durationValue: 120, completionEndTime: "10:00", executionDurationMinutes: 120,
  serviceReport: "Retorno sem sucção.", attendanceDisposal: null,
  naAttachments: [
    { fileName: "na-novembro.pdf", documentUrl: "/api/v1/files/atlanta/na-novembro.pdf" },
    { fileName: "foto-novembro.jpg", documentUrl: "/api/v1/files/atlanta/foto-novembro.jpg" },
  ],
}
const pending: ScheduleRecord = {
  ...base, id: "atlanta", clientName: "Atlanta", serviceTypeName: "Limpeza de rede",
  date: "2026-11-23", status: "rescheduled", billable: true, isManual: true, value: 950, billingDueDate: "2026-11-23",
}
const visits = [pending, returnVisit, historical]

async function capturePreview(target: Page | Locator, name: string) {
  const directory = process.env.E2E_SCREENSHOT_DIR
  if (directory) await target.screenshot({ path: path.join(directory, `${name}.png`), animations: "disabled" })
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}`, (route) => route.fulfill({
    json: { success: true, data: { ...clientFixture, companyName: "Atlanta" } },
  }))
  await page.route("**/api/v1/schedules**", async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname)
    if (path.endsWith("/schedules") || path.endsWith("/history")) return route.fulfill({ json: { success: true, data: visits } })
    const found = visits.find((visit) => path.endsWith(`/${visit.id}`))
    if (found) return route.fulfill({ json: { success: true, data: found } })
    return route.fallback()
  })
})

test("agenda preserva as três datas e abre a visita parcial com várias MTRs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/agendamentos")
  const row = page.getByRole("row").filter({ hasText: "20/10/2026" })
  await expect(row).toContainText("Concluído Parcial")
  await expect(page.getByRole("row").filter({ hasText: "16/11/2026" })).toContainText("Concluído Parcial")
  await expect(page.getByRole("row").filter({ hasText: "23/11/2026" })).toContainText("Reagendado")
  await capturePreview(page, "01-agendamentos-visitas")
  await row.getByRole("button", { name: "Abrir ações do agendamento de Atlanta" }).click()
  await expect(page.getByRole("menuitem", { name: /Editar|Cancelar|Excluir/ })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Visualizar", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("MTR 1: 001234")
  await expect(dialog).toContainText("MTR 2: 009876")
  await expect(dialog).toContainText("Sucção realizada na primeira visita.")
  await expect(dialog.getByRole("link", { name: "Visualizar na-outubro.pdf", exact: true })).toHaveAttribute("href", /\/api\/v1\/files\/atlanta\/na-outubro\.pdf$/)
  await expect(dialog.getByRole("link", { name: /novembro/ })).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: /Reagendar|Editar/ })).toHaveCount(0)
  await capturePreview(dialog, "03-detalhes-visita-mtrs")
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(dialog).toContainText("001234")
  await expect(dialog.getByRole("button", { name: /Reagendar|Editar/ })).toHaveCount(0)
})

test("ficha do cliente mostra as visitas parciais e consulta a execução selecionada", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/clientes/${clientFixture.id}?tab=agenda`)
  const row = page.getByRole("row").filter({ hasText: "20/10/2026" })
  await expect(row).toContainText("Concluído Parcial")
  await expect(page.getByRole("row").filter({ hasText: "16/11/2026" })).toContainText("Concluído Parcial")
  await capturePreview(page, "02-historico-cliente")
  await row.click()
  await expect(page.getByRole("dialog")).toContainText("MTR 1: 001234")
  await expect(page.getByRole("dialog").getByRole("button", { name: /Reagendar|Editar/ })).toHaveCount(0)
})

test("calendário mantém cada visita no dia executado após os reagendamentos", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/agenda?date=2026-10-20&view=week")
  const first = page.locator('[data-schedule-id="atlanta~execution~1"][data-schedule-status="partially_completed"]')
  await expect(first).toContainText("08:00 - 12:00")
  await capturePreview(page, "04-calendario-visita-original")
  await first.click()
  await expect(page.getByRole("dialog")).toContainText("MTR 1: 001234")
  await expect(page.getByRole("dialog").getByRole("button", { name: /Reagendar|Editar/ })).toHaveCount(0)
  await page.goto("/agenda?date=2026-11-16&view=week")
  await expect(page.locator('[data-schedule-id="atlanta~execution~2"][data-schedule-status="partially_completed"]')).toBeVisible()
  await page.locator('[data-schedule-id="atlanta~execution~2"]').click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("Retorno sem sucção.")
  await expect(dialog).not.toContainText("001234")
  await expect(dialog.getByRole("link", { name: "Visualizar na-novembro.pdf", exact: true })).toHaveAttribute("href", /\/api\/v1\/files\/atlanta\/na-novembro\.pdf$/)
  await expect(dialog.getByRole("link", { name: "Visualizar foto-novembro.jpg", exact: true })).toHaveAttribute("target", "_blank")
  await expect(dialog.getByRole("link", { name: /outubro/ })).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: /Remover|Editar nome|Reagendar/ })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(dialog.getByRole("link", { name: "Visualizar na-novembro.pdf", exact: true })).toBeVisible()
  await expect(dialog.getByRole("link", { name: "Visualizar foto-novembro.jpg", exact: true })).toBeVisible()
  await expect.poll(() => dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-schedule-id="atlanta~execution~1"]')).toHaveCount(0)
  await page.goto("/agenda?date=2026-11-23&view=week")
  await expect(page.locator('[data-schedule-id="atlanta"][data-schedule-status="rescheduled"]')).toBeVisible()
})

test("exporta cada visita parcial com seu descarte e MTRs", async ({ page }) => {
  test.setTimeout(90_000)
  await page.route("**/api/v1/analytics/reports**", (route) => route.fulfill({ json: { success: true, data: {
    dashboardStats: { completedServices: 0, scheduledServices: 1, cancelledServices: 0, emergencyServices: 0, completionRate: 0 },
    servicesByPeriodData: [], servicesSummaryData: [], servicesParticipationData: [], serviceClientSummary: [],
    scheduleDetails: [returnVisit, historical].map((visit) => ({
      ...visit, scheduledDate: visit.date, scheduledTime: visit.time, estimatedDuration: visit.duration,
      serviceIds: visit.serviceTypeIds, serviceNames: [visit.serviceTypeName], teamNames: [], employeeNames: [],
    })),
  } } }))
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = ((object: Blob | MediaSource) => object instanceof Blob && object.type.startsWith("image/svg+xml")
      ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E" : original(object)) as typeof URL.createObjectURL
  })
  await page.goto("/relatorios?tab=services")
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Gerar relatório" }).click()
  const download = await downloadPromise
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile((await download.path())!)
  const sheet = workbook.getWorksheet("Dados")!
  let headerRow = 0
  sheet.eachRow((row) => { if (row.getCell(1).value === "Data agendada") headerRow = row.number })
  expect(headerRow).toBeGreaterThan(0)
  const headers = (sheet.getRow(headerRow).values as ExcelJS.CellValue[]).slice(1).map(String)
  const exported = [1, 2].map((offset) => {
    const values = (sheet.getRow(headerRow + offset).values as ExcelJS.CellValue[]).slice(1)
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]))
  })
  expect(exported[0]).toMatchObject({ "Data agendada": "16/11/2026", Status: "Concluído Parcial", "N° de MTR": "Não informado" })
  expect(exported[1]).toMatchObject({ "Data agendada": "20/10/2026", Status: "Concluído Parcial", "N° de MTR": "001234, 009876", "Quantidade do descarte (m³)": 2 })
})
