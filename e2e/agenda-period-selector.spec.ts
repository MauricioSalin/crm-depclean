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
  await expect(periodButton).toHaveCSS("cursor", "pointer")
  await periodButton.click()
  await expect(periodButton).toHaveAttribute("data-state", "open")
  expect(await periodButton.getAttribute("class")).toContain("data-[state=open]:bg-muted/70")

  const yearButton = page.getByRole("combobox", { name: "Ano", exact: true })
  await expect(yearButton).toHaveCSS("cursor", "pointer")
  await yearButton.click()
  await page.getByRole("option", { name: "2027", exact: true }).click()
  const septemberButton = page.getByRole("menu").getByRole("button", { name: "Set", exact: true })
  await expect(septemberButton).toHaveCSS("cursor", "pointer")
  await septemberButton.click()

  await expect(periodButton).toHaveText("Ago. - Set. 2027")
  await expect(page.getByRole("button", { name: "QUA. 1", exact: true })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2027-09-01")
})
