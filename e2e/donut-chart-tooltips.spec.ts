import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("mantém os tooltips das rosquinhas do painel acima do conteúdo central", async ({ page }) => {
  await page.goto("/")

  const cases = [
    {
      heading: "Contratos por status",
      sliceIndex: 3,
      tooltipText: ["Vigentes", "90 contratos"],
    },
    {
      heading: "Serviços por Período",
      sliceIndex: 0,
      tooltipText: ["0 serviços"],
    },
  ]

  await page.waitForTimeout(1_200)
  for (const currentCase of cases) {
    const card = page
      .getByText(currentCase.heading, { exact: true })
      .locator("xpath=ancestor::*[@data-slot='card'][1]")
    const chartSurface = card.locator("svg.recharts-surface").first()
    const currentSlice = card.locator("path.recharts-sector").nth(currentCase.sliceIndex)
    const tooltip = card.locator(".recharts-tooltip-wrapper")

    await expect(chartSurface).toBeVisible()
    await currentSlice.dispatchEvent("mouseover")
    await currentSlice.dispatchEvent("mousemove")

    await expect(tooltip).toBeVisible()
    for (const text of currentCase.tooltipText) {
      await expect(tooltip).toContainText(text)
    }
    await expect(tooltip).toHaveCSS("z-index", "20")
    await expect(tooltip).toHaveCSS("pointer-events", "none")
  }
})

test("exibe em Relatórios o card de hover da Saúde Financeira acima do conteúdo central", async ({ page }) => {
  await page.route("**/api/v1/analytics/financial**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: {
          summary: {
            totalPaid: 860,
            totalReceivable: 140,
            totalPending: 50,
            totalLate: 30,
            totalOverdue: 60,
            paidCount: 86,
            pendingCount: 5,
            lateCount: 3,
            overdueCount: 6,
            totalCount: 100,
            adherenceRate: 86,
          },
          installments: [],
          monthlyRevenueData: [],
          financeHealthData: [
            { name: "Pagas", value: 86 },
            { name: "A receber", value: 5 },
            { name: "Em atraso", value: 3 },
            { name: "Vencidas", value: 6 },
          ],
        },
      }),
    })
  })
  await page.goto("/relatorios?tab=financial")

  const card = page.locator('[data-report-chart="saude-financeira"]')
  const chartSurface = card.locator("svg.recharts-surface").first()
  const paidSlice = card.locator("path.recharts-sector").first()
  const tooltip = card.locator(".recharts-tooltip-wrapper")
  const centerContent = card.getByText("Adimplência", { exact: true }).locator("xpath=parent::div")

  await expect(card.getByRole("heading", { name: "Saúde Financeira", exact: true })).toBeVisible()
  await expect(chartSurface).toBeVisible()
  await page.waitForTimeout(1_600)
  await paidSlice.dispatchEvent("mouseover")
  await paidSlice.dispatchEvent("mousemove")

  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText("Pagas")
  await expect(tooltip).toContainText("86%")
  await expect(tooltip).toHaveCSS("z-index", "20")
  await expect(tooltip).toHaveCSS("pointer-events", "none")
  await expect(centerContent).toHaveCSS("pointer-events", "none")
})
