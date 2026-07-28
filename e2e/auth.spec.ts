import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"

test.beforeEach(async ({ page }) => {
  await installApiMock(page)
})

test("máscara o CPF e conclui o fluxo de login por senha", async ({ page }) => {
  await page.goto("/login")

  const identifier = page.getByLabel("E-mail ou CPF").first()
  await identifier.fill("12345678901")
  await expect(identifier).toHaveValue("123.456.789-01")

  await page.getByRole("button", { name: "Avançar" }).click()
  await expect(page.getByRole("textbox", { name: "Senha" })).toBeVisible()
  await page.getByRole("textbox", { name: "Senha" }).fill("senha-e2e")
  await page.getByRole("button", { name: "Entrar" }).click()

  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
})

test("preserva a rota original depois de autenticar", async ({ page }) => {
  await page.goto("/clientes?search=e2e")
  await expect(page).toHaveURL(/\/login\?redirectTo=/)

  await page.getByLabel("E-mail ou CPF").first().fill("e2e@depclean.test")
  await page.getByRole("button", { name: "Avançar" }).click()
  await page.getByRole("textbox", { name: "Senha" }).fill("senha-e2e")
  await page.getByRole("button", { name: "Entrar" }).click()

  await expect(page).toHaveURL("/clientes?search=e2e")
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible()
})

test("impede redirecionamento externo pelo parâmetro de retorno", async ({ page }) => {
  await page.goto("/login?redirectTo=https://example.com")
  await page.getByLabel("E-mail ou CPF").first().fill("e2e@depclean.test")
  await page.getByRole("button", { name: "Avançar" }).click()
  await page.getByRole("textbox", { name: "Senha" }).fill("senha-e2e")
  await page.getByRole("button", { name: "Entrar" }).click()

  await expect(page).toHaveURL("/")
})
