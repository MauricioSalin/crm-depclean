import { expect, test } from "@playwright/test"

import { clientFixture, clientTypeFixture, installApiMock, serviceFixture } from "./support/api-mock"
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
