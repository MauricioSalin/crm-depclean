import { expect, test, type Page } from "@playwright/test"

import { clientFixture, clientTypeFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/clients/catalog/types", async (route) => {
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [{ ...clientTypeFixture, contractSignerRole: "owner" }] }),
    })
  })
  await page.route("**/api/v1/clients/cnpj/**", async (route) => {
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: {
        companyName: "Empresa Nova",
        responsibleName: "Maria Responsável",
        phone: "51999999999",
        email: "empresa@example.com",
        address: clientFixture.units[0].address,
      } }),
    })
  })
})

async function fillRequiredFields(page: Page) {
  await page.goto("/clientes/novo")
  await page.locator("#cnpj").fill("44277398000183")
  await expect(page.locator("#companyName")).toHaveValue("EMPRESA NOVA")
  await page.locator("#clientType").click()
  await page.getByRole("option", { name: "Condomínio", exact: true }).click()
  await page.locator("#responsibleCpf").fill("52998224725")
  await page.locator("#primaryUnitCount").fill("1")
  await page.getByText("Receber notificações do sistema", { exact: true }).first().click()
}

for (const financialCode of ["", "005"]) {
  test(`envia código ${financialCode || "automático"} ao criar o cliente`, async ({ page }) => {
    await fillRequiredFields(page)
    await page.getByLabel("Código", { exact: true }).fill(financialCode)
    const requestPromise = page.waitForRequest((request) =>
      request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/clients",
    )
    await page.getByRole("button", { name: "Cadastrar Cliente", exact: true }).click()
    const request = await requestPromise
    if (financialCode) expect(request.postDataJSON().financialCode).toBe(financialCode)
    else expect(request.postDataJSON()).not.toHaveProperty("financialCode")
    await expect(page).toHaveURL(/\/clientes$/)
  })
}

test("código repetido mantém o formulário e mostra a empresa no toast", async ({ page }) => {
  await page.route("**/api/v1/clients", async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    await route.fulfill({
      status: 409,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ message: "O código 05 já está em uso pela empresa EMPRESA EXISTENTE." }),
    })
  })
  await fillRequiredFields(page)
  await page.getByLabel("Código", { exact: true }).fill("5")
  await page.getByRole("button", { name: "Cadastrar Cliente", exact: true }).click()
  await expect(page.getByText("O código 05 já está em uso pela empresa EMPRESA EXISTENTE.", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/clientes\/novo$/)
  await expect(page.locator("#companyName")).toHaveValue("EMPRESA NOVA")
  await expect(page.locator("#financialCode")).toHaveValue("5")
})

test("código usa tel à direita da razão social e se adapta ao celular", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/clientes/novo")
  const code = page.getByLabel("Código", { exact: true })
  await expect(code).toHaveAttribute("type", "tel")
  await expect(code).toHaveValue("")
  const nameBox = await page.locator("#companyName").boundingBox()
  const codeBox = await code.boundingBox()
  expect(codeBox!.x).toBeGreaterThan(nameBox!.x + nameBox!.width)
  expect(codeBox!.y).toBe(nameBox!.y)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(code).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByText("Cliente sem contrato", { exact: true }).click()
  await expect(code).toBeDisabled()
})

test("código zero é bloqueado antes do envio", async ({ page }) => {
  await fillRequiredFields(page)
  let submitted = false
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/clients") submitted = true
  })
  await page.locator("#financialCode").fill("0")
  await page.getByRole("button", { name: "Cadastrar Cliente", exact: true }).click()
  await expect(page.getByText("Informe um código válido, com um número inteiro maior que zero.", { exact: true })).toBeVisible()
  expect(submitted).toBe(false)
})
