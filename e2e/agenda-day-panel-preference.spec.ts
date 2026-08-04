import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const DAY_PANEL_STORAGE_KEY = `depclean:agenda-day-panel-open:v1:${E2E_USER.id}`

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("abre o painel do dia fechado e restaura a última preferência", async ({ page }) => {
  await page.goto("/agenda?date=2026-07-28")

  const showPanelButton = page.getByRole("button", { name: "Mostrar detalhes do dia" })
  const hidePanelButton = page.getByRole("button", { name: "Recolher detalhes do dia" })

  await expect(showPanelButton).toBeVisible()
  await showPanelButton.click()
  await expect(hidePanelButton).toBeVisible()
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), DAY_PANEL_STORAGE_KEY)).toBe("true")

  await page.reload()
  await expect(hidePanelButton).toBeVisible()

  await hidePanelButton.click()
  await expect(showPanelButton).toBeVisible()
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), DAY_PANEL_STORAGE_KEY)).toBe("false")

  await page.reload()
  await expect(showPanelButton).toBeVisible()
})
