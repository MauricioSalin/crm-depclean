import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("seleciona mês e ano e abre a primeira semana do período", async ({ page }) => {
  await page.goto("/agenda")
  await expect(page.locator("main")).toBeVisible()

  const periodButton = page.getByRole("button", { name: /Selecionar mês e ano:/ })
  await periodButton.click()

  await page.getByLabel("Mês", { exact: true }).selectOption("8")
  await page.getByLabel("Ano", { exact: true }).selectOption("2027")
  await page.getByRole("button", { name: "Mostrar primeira semana", exact: true }).click()

  await expect(periodButton).toHaveText("Ago. - Set. 2027")
  await expect(page.getByRole("button", { name: "QUA. 1", exact: true })).toBeVisible()
})
