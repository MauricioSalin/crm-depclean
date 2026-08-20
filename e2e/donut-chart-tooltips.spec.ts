import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("mantém o tooltip da rosquinha de contratos acima do conteúdo central", async ({ page }) => {
  await page.goto("/")

  const card = page
    .getByRole("heading", { name: "Contratos por status", exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
  const chartSurface = card.locator("svg.recharts-surface").first()
  const currentSlice = card.locator("path.recharts-sector").nth(3)
  const tooltip = card.locator(".recharts-tooltip-wrapper")

  await expect(chartSurface).toBeVisible()
  await page.waitForTimeout(1_200)
  await currentSlice.dispatchEvent("mouseover")
  await currentSlice.dispatchEvent("mousemove")

  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText("Vigentes")
  await expect(tooltip).toContainText("90 contratos")
  await expect(tooltip).toHaveCSS("z-index", "10")
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
  await expect(tooltip).toHaveCSS("z-index", "10")
  await expect(centerContent).toHaveCSS("pointer-events", "none")
})
