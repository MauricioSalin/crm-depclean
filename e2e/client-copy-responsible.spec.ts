import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("copia os dados do responsável para o síndico", async ({ page }) => {
  await page.goto("/clientes/novo")

  await page.locator("#responsibleName").fill("Responsável do condomínio")
  await page.locator("#email").fill("responsavel@condominio.com.br")
  await page.locator("#phone").fill("51987654321")
  await page.locator("#responsibleCpf").fill("12345678909")

  await page.locator("#syndicName").fill("Dados anteriores")
  await page.locator("#syndicEmail").fill("anterior@condominio.com.br")
  await page.locator("#syndicPhone").fill("51911112222")
  await page.locator("#syndicCpf").fill("98765432100")

  await page.getByRole("button", { name: "Copiar dados do responsável" }).click()

  await expect(page.locator("#syndicName")).toHaveValue("Responsável do condomínio")
  await expect(page.locator("#syndicEmail")).toHaveValue("responsavel@condominio.com.br")
  await expect(page.locator("#syndicPhone")).toHaveValue("(51) 98765-4321")
  await expect(page.locator("#syndicCpf")).toHaveValue("123.456.789-09")
  await expect(page.getByText("Dados do responsável copiados para o síndico.")).toBeVisible()
})
