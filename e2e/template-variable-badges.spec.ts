import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.describe("badges das variáveis do template", () => {
  test.beforeEach(async ({ page }) => {
    await installAuthenticatedSession(page)
    await installApiMock(page)
  })

  test("mostra o nome amigável, remove o token inteiro e permite inseri-lo novamente", async ({ page }) => {
    await page.goto("/templates?tab=contract&templateMode=new&view=editor")

    await expect(page.getByRole("heading", { name: "Novo Template de Contrato" })).toBeVisible()

    const companyNameBadge = page.locator('[data-template-variable-badge="client.companyName"]')

    await expect(companyNameBadge.first()).toBeVisible({ timeout: 20_000 })
    await expect(companyNameBadge.first()).toContainText("Nome do cliente")

    const clientVariablesGroup = page.getByRole("button", { name: /Cliente\s+15/ })
    await clientVariablesGroup.click()

    const companyNameOption = page
      .locator("button")
      .filter({ has: page.locator("span", { hasText: /^Nome do cliente$/ }) })
    await expect(companyNameOption).toBeVisible()
    await expect(companyNameOption).not.toContainText("{{client.companyName}}")

    const initialBadgeCount = await companyNameBadge.count()
    await companyNameBadge.first().hover()

    const removeButton = companyNameBadge.first().getByRole("button", { name: "Remover Nome do cliente" })
    await expect(removeButton).toBeVisible()
    await removeButton.click()
    await expect(companyNameBadge).toHaveCount(initialBadgeCount - 1)

    await companyNameOption.click()
    await expect(companyNameBadge).toHaveCount(initialBadgeCount)
    await expect(page.locator(".layout-page").first()).toContainText("{{client.companyName}}")
  })
})
