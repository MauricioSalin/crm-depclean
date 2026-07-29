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
          monthlyRevenueData: [],
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

test("explica e identifica os modos do valor global", async ({ page }) => {
  await page.goto("/")

  const globalValuePicker = page.getByRole("button", { name: "Selecionar composição do valor global" })
  await expect(globalValuePicker).toHaveText("Geral")

  await globalValuePicker.hover()
  const tooltip = page.getByRole("tooltip")
  await expect(tooltip).toContainText("Geral: contratos ativos e inativos, serviços e extras.")
  await expect(tooltip).toContainText("Contratos Ativos: somente contratos vigentes.")

  await globalValuePicker.click()
  const activeContractsOption = page.getByRole("menuitemradio", { name: "Contratos Ativos", exact: true })
  await expect(activeContractsOption).toBeVisible()
  await activeContractsOption.click()
  await expect(globalValuePicker).toHaveText("Contratos Ativos")
})
