import { expect, test } from "@playwright/test"

import { clientFixture, installApiMock } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const fepamCredentials = {
  fepamCpf: "52998224725",
  fepamPassword: "senha-fepam-segura",
}

test("revela CPF e senha FEPAM somente após o clique de usuário autorizado", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  let credentialRequests = 0
  await page.route(`**/api/v1/clients/${clientFixture.id}/fepam-credentials`, async (route) => {
    credentialRequests += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: fepamCredentials }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}`)

  await expect(page.getByRole("row").filter({ hasText: "CPF FEPAM" })).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "Senha FEPAM" })).toBeVisible()
  await expect(page.getByText(fepamCredentials.fepamPassword, { exact: true })).toHaveCount(0)
  expect(credentialRequests).toBe(0)

  await page.getByRole("button", { name: "Mostrar CPF FEPAM" }).click()
  await expect(page.getByText("529.982.247-25", { exact: true })).toBeVisible()
  expect(credentialRequests).toBe(1)

  await page.getByRole("button", { name: "Mostrar senha FEPAM" }).click()
  await expect(page.getByText(fepamCredentials.fepamPassword, { exact: true })).toBeVisible()
  expect(credentialRequests).toBe(1)

  await page.getByRole("button", { name: "Ocultar senha FEPAM" }).click()
  await expect(page.getByText(fepamCredentials.fepamPassword, { exact: true })).toHaveCount(0)
})

test("não oferece revelação das credenciais FEPAM sem permissão para criar ou editar cliente", async ({ page }) => {
  const viewer = {
    ...E2E_USER,
    id: "user-client-viewer",
    permissionProfileId: "profile-client-viewer",
    permissionProfileName: "Consulta de clientes",
    permissions: ["clients_view"],
  }

  await installAuthenticatedSession(page, viewer)
  await installApiMock(page, viewer)

  let credentialRequests = 0
  await page.route(`**/api/v1/clients/${clientFixture.id}/fepam-credentials`, async (route) => {
    credentialRequests += 1
    await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "Proibido" }) })
  })

  await page.goto(`/clientes/${clientFixture.id}`)

  await expect(page.getByRole("row").filter({ hasText: "CPF FEPAM" })).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "Senha FEPAM" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Mostrar CPF FEPAM" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Mostrar senha FEPAM" })).toHaveCount(0)
  await expect(page.getByText(fepamCredentials.fepamPassword, { exact: true })).toHaveCount(0)
  expect(credentialRequests).toBe(0)
})

test("exibe traço e não oferece olho quando os dados FEPAM estão vazios", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: {
          ...clientFixture,
          hasFepamCpf: false,
          hasFepamPassword: false,
        },
      }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}`)

  const cpfRow = page.getByRole("row").filter({ hasText: "CPF FEPAM" })
  const passwordRow = page.getByRole("row").filter({ hasText: "Senha FEPAM" })
  await expect(cpfRow.getByText("-", { exact: true })).toBeVisible()
  await expect(passwordRow.getByText("-", { exact: true })).toBeVisible()
  await expect(cpfRow.getByRole("button", { name: "Mostrar CPF FEPAM" })).toHaveCount(0)
  await expect(passwordRow.getByRole("button", { name: "Mostrar senha FEPAM" })).toHaveCount(0)
  await expect(cpfRow.getByText("********", { exact: true })).toHaveCount(0)
  await expect(passwordRow.getByText("********", { exact: true })).toHaveCount(0)
})

test("mantém CPF e senha FEPAM ocultos também no cadastro do cliente", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.goto("/clientes/novo")

  const fepamSection = page
    .getByRole("heading", { name: "Dados FEPAM", exact: true })
    .locator("xpath=ancestor::div[@data-slot='card']")
  await expect(fepamSection).toBeVisible()
  const cpfInput = fepamSection.getByLabel("CPF", { exact: true })
  const passwordInput = fepamSection.getByLabel("Senha", { exact: true })
  await expect(cpfInput).toHaveAttribute("type", "password")
  await expect(passwordInput).toHaveAttribute("type", "password")

  await cpfInput.fill("52998224725")
  await passwordInput.fill(fepamCredentials.fepamPassword)
  await page.getByRole("button", { name: "Mostrar CPF FEPAM" }).click()
  await page.getByRole("button", { name: "Mostrar senha FEPAM" }).click()

  await expect(cpfInput).toHaveAttribute("type", "text")
  await expect(cpfInput).toHaveValue("529.982.247-25")
  await expect(passwordInput).toHaveAttribute("type", "text")
  await expect(passwordInput).toHaveValue(fepamCredentials.fepamPassword)
})
