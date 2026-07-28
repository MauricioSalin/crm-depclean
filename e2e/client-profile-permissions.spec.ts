import { expect, test } from "@playwright/test"

import {
  clientFixture,
  clientServiceFixture,
  clientTypeFixture,
  installApiMock,
  serviceFixture,
} from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const operationalUser = {
  ...E2E_USER,
  id: "user-e2e-operational",
  name: "Operacional E2E",
  permissionProfileId: "profile-e2e-operational",
  permissionProfileName: "Operacional",
  permissions: ["clients_view", "services_view", "agenda_own_view"],
  isSystemUser: false,
}

test("não exibe o atalho Acessar contrato no cabeçalho do perfil", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.goto(`/clientes/${clientFixture.id}`)

  await expect(page.getByRole("button", { name: "Acessar contrato", exact: true })).toHaveCount(0)
})

test("exibe hífen sem ícone para equipe não definida na aba Serviços", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/services`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Serviço de teste carregado.",
        data: [{
          ...clientServiceFixture,
          teams: [],
          additionalEmployees: [],
        }],
      }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}`)
  await page.getByRole("tab", { name: "Serviços (1)" }).click()

  const serviceRow = page.getByRole("row").filter({ hasText: serviceFixture.name })
  const emptyAssignment = serviceRow.getByText("-", { exact: true })
  await expect(emptyAssignment).toBeVisible()
  await expect(emptyAssignment.locator("xpath=ancestor::td[1]").locator("svg")).toHaveCount(0)
})

test("o perfil do cliente respeita as permissões do menu e lista os serviços", async ({ page }) => {
  await installAuthenticatedSession(page, operationalUser)
  await installApiMock(page, operationalUser)

  await page.goto(`/clientes/${clientFixture.id}`)
  await expect(page.getByRole("heading", { name: "Perfil do Cliente" })).toBeVisible()

  await expect(page.getByRole("tab", { name: "Dados" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Serviços (1)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Agenda (1)" })).toBeVisible()
  await expect(page.getByRole("tab", { name: /Contratos/ })).toHaveCount(0)
  await expect(page.getByRole("tab", { name: /Parcelas/ })).toHaveCount(0)
  await expect(page.getByRole("tab", { name: /Extras/ })).toHaveCount(0)
  await expect(page.getByRole("tab", { name: /Anexos/ })).toHaveCount(0)
  await expect(page.getByText("Contratos ativos")).toHaveCount(0)
  await expect(page.getByText("Total pago")).toHaveCount(0)
  await expect(page.getByText(clientTypeFixture.name, { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: "Ajuda" })).toHaveCount(0)

  await page.getByRole("tab", { name: "Serviços (1)" }).click()
  await expect(page.getByText(serviceFixture.name, { exact: true })).toBeVisible()
  await expect(page.getByText("Agendado", { exact: true })).toBeVisible()

  await page.goto("/clientes")
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible()
  await expect(page.getByText(clientTypeFixture.name, { exact: true }).first()).toBeVisible()

  await page.goto("/ajuda")
  await expect(page).not.toHaveURL(/\/ajuda$/)
})
