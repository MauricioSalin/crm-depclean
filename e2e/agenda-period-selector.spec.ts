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
  await expect(periodButton).toHaveClass(/data-\[state=open\]:bg-muted\/70/)
  await periodButton.click()
  await expect(periodButton).toHaveAttribute("data-state", "open")

  const yearPicker = page.getByRole("combobox", { name: "Ano", exact: true })
  await expect(yearPicker).toHaveCSS("cursor", "pointer")
  await yearPicker.click()
  const yearOption = page.getByRole("option", { name: "2027", exact: true })
  await expect(yearOption).toHaveCSS("cursor", "pointer")
  await yearOption.click()
  const monthOption = page.getByRole("menu").getByRole("button", { name: "Set", exact: true })
  await expect(monthOption).toHaveCSS("cursor", "pointer")
  await monthOption.click()

  await expect(periodButton).toHaveText("Ago. - Set. 2027")
  await expect(page.getByRole("button", { name: "QUA. 1", exact: true })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2027-09-01")
})
