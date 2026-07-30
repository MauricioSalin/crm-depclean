import { expect, test } from "@playwright/test"

import { clientFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test("separa nome e CNPJ e mantém o badge alinhado no mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installAuthenticatedSession(page)
  await installApiMock(page)

  const delinquentClient = {
    ...clientFixture,
    companyName: "CONDOMÍNIO RESIDENCIAL MORADA DE CASCAIS",
    isDelinquent: true,
  }

  await page.route("**/api/v1/clients**", async (route) => {
    const pathname = new URL(route.request().url()).pathname

    if (route.request().method() === "GET" && pathname === "/api/v1/clients") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [delinquentClient] }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/clientes")

  const card = page.locator('[data-slot="card"]').filter({ hasText: delinquentClient.companyName })
  const cardBadge = card.getByText("Inadimplente", { exact: true })
  const cardCnpj = card.getByText(clientFixture.cnpj, { exact: true })

  await expect(card).toBeVisible()
  await expect(cardBadge).toBeVisible()
  await expect(cardCnpj).toBeVisible()

  const cardBadgeBox = await cardBadge.boundingBox()
  const cardCnpjBox = await cardCnpj.boundingBox()
  expect(cardBadgeBox).not.toBeNull()
  expect(cardCnpjBox).not.toBeNull()
  expect(cardCnpjBox!.y - (cardBadgeBox!.y + cardBadgeBox!.height)).toBeGreaterThanOrEqual(8)

  await page.getByRole("tab", { name: "Visualizar clientes em tabela" }).click()

  const row = page.getByRole("row").filter({ hasText: delinquentClient.companyName })
  const nameCell = row.locator("td").nth(0)
  const cnpjCell = row.locator("td").nth(1)
  const tableName = nameCell.getByText(delinquentClient.companyName, { exact: true })
  const tableBadge = nameCell.getByText("Inadimplente", { exact: true })

  await expect(nameCell).not.toContainText(clientFixture.cnpj)
  await expect(cnpjCell).toHaveText(clientFixture.cnpj)
  await expect(tableName).toBeVisible()
  await expect(tableBadge).toBeVisible()

  const tableNameBox = await tableName.boundingBox()
  const tableBadgeBox = await tableBadge.boundingBox()
  expect(tableNameBox).not.toBeNull()
  expect(tableBadgeBox).not.toBeNull()
  expect(Math.abs(
    tableNameBox!.y + tableNameBox!.height / 2
      - (tableBadgeBox!.y + tableBadgeBox!.height / 2),
  )).toBeLessThanOrEqual(1)
  expect(tableBadgeBox!.x).toBeGreaterThanOrEqual(tableNameBox!.x + tableNameBox!.width)
})
