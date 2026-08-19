import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test("novo template de informativo inicia o horário de envio às 08:00", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.goto("/templates?tab=informative")
  await page.getByRole("button", { name: "Novo Template" }).click()

  await expect(page.getByLabel("Horário de envio")).toHaveValue("08:00")
})
