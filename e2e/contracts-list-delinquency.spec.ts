import { expect, test } from "@playwright/test"

import { contractFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("exibe a inadimplência ao lado do cliente e amplia a coluna de nome", async ({ page }) => {
  await page.route("**/api/v1/contracts**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() !== "GET" || pathname !== "/api/v1/contracts") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Contratos carregados.",
        data: [{ ...contractFixture, isClientDelinquent: true }],
        meta: { version: "e2e", timestamp: new Date().toISOString() },
      }),
    })
  })

  await page.goto("/contratos")

  const contractHeader = page.getByRole("columnheader", { name: "Contrato" })
  const financialCodeHeader = page.getByRole("columnheader", { name: "Código" })
  const clientHeader = page.getByRole("columnheader", { name: "Cliente" })
  await expect(contractHeader).toHaveClass(/w-\[220px\]/)
  await expect(financialCodeHeader).toBeVisible()
  await expect(clientHeader).toHaveClass(/w-\[500px\]/)

  const contractRow = page.getByRole("link", { name: `Abrir contrato ${contractFixture.contractNumber}` })
  const financialCodeCell = contractRow.getByRole("cell").nth(1)
  const clientCell = contractRow.getByRole("cell").nth(2)
  const statusCell = contractRow.getByRole("cell").nth(5)

  await expect(financialCodeCell).toHaveText(contractFixture.financialCode)
  await expect(clientCell).toContainText(contractFixture.clientCompanyName)
  await expect(clientCell.getByText("Inadimplente", { exact: true })).toBeVisible()
  await expect(statusCell.getByText("Inadimplente", { exact: true })).toHaveCount(0)
})
