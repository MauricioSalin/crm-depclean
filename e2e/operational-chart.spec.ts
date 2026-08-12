import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const servicesByPeriodData = [
  { period: "29/06 - 03/07", completed: 15, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "04/07 - 08/07", completed: 11, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "09/07 - 13/07", completed: 4, scheduled: 0, cancelled: 0, emergency: 0 },
  { period: "14/07 - 18/07", completed: 4, scheduled: 4, cancelled: 0, emergency: 0 },
  { period: "19/07 - 23/07", completed: 0, scheduled: 3, cancelled: 0, emergency: 0 },
  { period: "24/07 - 28/07", completed: 0, scheduled: 4, cancelled: 0, emergency: 0 },
]

const monthlyRevenueData = [
  { month: "10/07", dateFrom: "2026-07-10", dateTo: "2026-07-14", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "15/07", dateFrom: "2026-07-15", dateTo: "2026-07-19", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "20/07", dateFrom: "2026-07-20", dateTo: "2026-07-24", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "25/07", dateFrom: "2026-07-25", dateTo: "2026-07-29", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "30/07", dateFrom: "2026-07-30", dateTo: "2026-08-03", value: 0, paidValue: 0, pendingValue: 0, lateValue: 0, overdueValue: 0, lateOverdueValue: 0 },
  { month: "04/08", dateFrom: "2026-08-04", dateTo: "2026-08-08", value: 300, paidValue: 100, pendingValue: 0, lateValue: 0, overdueValue: 200, lateOverdueValue: 200 },
]

const installments = [
  { id: "paid-1", contractId: "contract-1", contractNumber: "DEP-2026-001", clientId: "client-1", clientCompanyName: "CONDOMÍNIO PAGO", source: "contract", number: 1, value: 100, dueDate: "2026-08-04", status: "paid" },
  { id: "overdue-1", contractId: "contract-2", contractNumber: "DEP-2026-002", clientId: "client-2", clientCompanyName: "CONDOMÍNIO VENCIDO", source: "contract", number: 2, value: 200, dueDate: "2026-08-08", status: "overdue" },
  { id: "outside-1", contractId: "contract-3", contractNumber: "DEP-2026-003", clientId: "client-3", clientCompanyName: "CONDOMÍNIO FORA", source: "contract", number: 3, value: 400, dueDate: "2026-08-09", status: "overdue" },
]

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/analytics/dashboard**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        message: "Dados carregados.",
        data: {
          stats: {
            totalClients: 94,
            currentContracts: 90,
            expiredContracts: 3,
            contractStatusCounts: {
              awaitingSend: 1,
              awaitingSignature: 2,
              signed: 1,
              current: 90,
              expired: 3,
              canceled: 1,
            },
            currentContractsGlobalValue: 4_200,
            globalValue: 4_200,
            globalValueMode: "contractual",
            generalGlobalValue: 4_200,
            contractualGlobalValue: 4_200,
            monthlyRevenue: 350,
            monthlyRevenueChange: 0,
            monthlyRevenueMonthLabel: "Julho de 2026",
            scheduledServices: 1,
            scheduledServicesChange: 0,
            completedServices: 0,
            completedServicesChange: 0,
            cancelledServices: 0,
            emergencyServices: 0,
            completionRate: 0,
            overdueInstallments: 0,
            overdueInstallmentsValue: 0,
            teamProductivity: [],
            employeeProductivity: [],
          },
          monthlyRevenueData,
          installments,
          servicesByPeriodData,
          servicesByStatusData: [],
          servicesByTeamData: [],
          servicesSummaryData: [],
          contractExpirationsData: [],
          recentClients: [],
          upcomingServices: [],
        },
        meta: { version: "e2e", timestamp: "2026-07-28T12:00:00.000Z" },
      }),
    })
  })
})

test("mantém o último período visível dentro do gráfico operacional", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("tab", { name: "Serviços", exact: true }).click()

  const lastPeriod = page.getByText("24/07 - 28/07", { exact: true })
  await expect(lastPeriod).toBeVisible()
  const chart = lastPeriod.locator("xpath=ancestor::*[contains(@class, 'recharts-wrapper')]")

  const [chartBox, periodBox] = await Promise.all([chart.boundingBox(), lastPeriod.boundingBox()])
  expect(chartBox).not.toBeNull()
  expect(periodBox).not.toBeNull()
  expect(periodBox!.x + periodBox!.width).toBeLessThanOrEqual(chartBox!.x + chartBox!.width)
})

test("abre as parcelas pela faixa e combina o filtro de status ao clicar na barra", async ({ page }) => {
  await page.goto("/")

  const financialChart = page.getByText("Análise Operacional", { exact: true }).locator("xpath=following::*[contains(@class, 'recharts-wrapper')][1]")
  const financialChartBox = await financialChart.boundingBox()
  expect(financialChartBox).not.toBeNull()
  await financialChart.hover({
    position: {
      x: financialChartBox!.width - 40,
      y: financialChartBox!.height * 0.35,
    },
  })

  const periodCursor = financialChart.locator(".recharts-tooltip-cursor")
  await expect(periodCursor).toBeVisible()
  await expect(periodCursor).toHaveCSS("cursor", "pointer")
  const periodCursorBox = await periodCursor.boundingBox()
  expect(periodCursorBox).not.toBeNull()
  await page.mouse.click(periodCursorBox!.x + 5, periodCursorBox!.y + 5)

  const periodDialog = page.getByRole("dialog")
  await expect(periodDialog.getByRole("heading", { name: "Parcelas do período" })).toBeVisible()
  const periodDialogBox = await periodDialog.boundingBox()
  expect(periodDialogBox).not.toBeNull()
  expect(periodDialogBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width * 0.8 + 1)
  expect(periodDialogBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.8 + 1)
  await expect(periodDialog.getByText("04/08/2026 a 08/08/2026", { exact: true })).toBeVisible()
  await expect(periodDialog).not.toContainText("Todos os status")
  await expect(periodDialog.getByPlaceholder("Buscar por contrato ou cliente...")).toHaveCount(0)
  await expect(periodDialog.getByText("Todas", { exact: true })).toHaveCount(0)
  await expect(periodDialog.getByText("CONDOMÍNIO PAGO", { exact: true })).toBeVisible()
  await expect(periodDialog.getByText("CONDOMÍNIO VENCIDO", { exact: true })).toBeVisible()
  await expect(periodDialog.getByText("CONDOMÍNIO FORA", { exact: true })).toHaveCount(0)
  await periodDialog.getByRole("button", { name: "Fechar" }).click()

  const overdueBar = financialChart.locator(".financial-bar-overdue .recharts-bar-rectangle path")
  await overdueBar.hover()
  expect(await overdueBar.evaluate((element) => getComputedStyle(element).filter)).not.toBe("none")
  await overdueBar.click()

  const statusDialog = page.getByRole("dialog")
  await expect(statusDialog.getByText("04/08/2026 a 08/08/2026 · Vencidas", { exact: true })).toBeVisible()
  await expect(statusDialog.getByPlaceholder("Buscar por contrato ou cliente...")).toHaveCount(0)
  await expect(statusDialog.getByText("Todas", { exact: true })).toHaveCount(0)
  await expect(statusDialog.getByText("CONDOMÍNIO VENCIDO", { exact: true })).toBeVisible()
  await expect(statusDialog.getByText("CONDOMÍNIO PAGO", { exact: true })).toHaveCount(0)
})

test("limita a modal de parcelas a 80 por cento em telas menores", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 640 })
  await page.goto("/")

  await page.getByRole("button", { name: "Ver parcelas de 04/08" }).click()
  const periodDialog = page.getByRole("dialog")
  await expect(periodDialog.getByRole("heading", { name: "Parcelas do período" })).toBeVisible()

  const dialogBox = await periodDialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.width).toBeLessThanOrEqual(960 * 0.8 + 1)
  expect(dialogBox!.height).toBeLessThanOrEqual(640 * 0.8 + 1)
  expect(dialogBox!.x).toBeGreaterThanOrEqual(960 * 0.1 - 1)
  expect(dialogBox!.y).toBeGreaterThanOrEqual(640 * 0.1 - 1)
})

test("explica e identifica os modos do valor global", async ({ page }) => {
  await page.goto("/")

  const globalValuePicker = page.getByRole("button", { name: "Selecionar composição do valor global" })
  await expect(globalValuePicker).toHaveText("Geral")

  await globalValuePicker.click()
  const generalOption = page.getByRole("menuitemradio", { name: "Geral", exact: true })
  const activeContractsOption = page.getByRole("menuitemradio", { name: "Contratos Vigentes", exact: true })
  await generalOption.hover()
  const generalTooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Contratos vigentes, vencidos, renovados, serviços e extras." })
  await expect(generalTooltip).toBeVisible()
  await expect(generalTooltip).toHaveAttribute("data-side", "right")

  await activeContractsOption.hover()
  const activeContractsTooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Somente contratos vigentes." })
  await expect(activeContractsTooltip).toBeVisible()
  await expect(activeContractsTooltip).toHaveAttribute("data-side", "right")

  await expect(activeContractsOption).toBeVisible()
  await activeContractsOption.click()
  await expect(globalValuePicker).toHaveText("Contratos Vigentes")
})

test("mantém o seletor do faturamento ativo e com cursor de clique", async ({ page }) => {
  await page.goto("/")

  const revenuePeriodPicker = page.getByRole("button", { name: "Selecionar mês do faturamento" })
  await expect(revenuePeriodPicker).toHaveCSS("cursor", "pointer")
  await expect(revenuePeriodPicker).toHaveClass(/data-\[state=open\]:bg-primary\/15/)
  await revenuePeriodPicker.click()
  await expect(revenuePeriodPicker).toHaveAttribute("data-state", "open")

  const yearPicker = page.getByRole("combobox").filter({ hasText: "2026" })
  await expect(yearPicker).toHaveCSS("cursor", "pointer")
  await yearPicker.click()
  const yearOption = page.getByRole("option", { name: "2026", exact: true })
  await expect(yearOption).toHaveCSS("cursor", "pointer")
  await yearOption.click()

  const monthOption = page.getByRole("menu").getByRole("button", { name: "Ago", exact: true })
  await expect(monthOption).toHaveCSS("cursor", "pointer")
})
