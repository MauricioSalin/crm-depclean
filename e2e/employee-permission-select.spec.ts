import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const permissionProfiles = [
  {
    id: "profile-admin",
    name: "Administrador",
    description: "Acesso administrativo",
    permissions: ["settings_manage"],
  },
  {
    id: "profile-operational",
    name: "Operacional",
    description: "Acesso operacional",
    permissions: ["employees_view"],
  },
]

test("seleciona o perfil de permissão sem deformar ou ocultar a lista na modal de funcionário", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.route("**/api/v1/settings/permission-profiles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: {
          items: permissionProfiles,
          total: permissionProfiles.length,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      }),
    })
  })

  await page.setViewportSize({ width: 550, height: 760 })
  await page.goto("/funcionarios")
  await page.getByRole("button", { name: "Novo Funcionário" }).click()

  const dialog = page.getByRole("dialog", { name: "Novo Funcionário" })
  await dialog.getByLabel("Criar usuário do sistema").check()

  const permissionSelect = dialog.getByRole("combobox", { name: "Selecione um perfil" })
  await expect(permissionSelect).toContainText("Administrador")
  const triggerBox = await permissionSelect.boundingBox()
  await permissionSelect.click()

  const options = page.locator('[data-slot="popover-content"]')
  await expect(options).toBeVisible()

  expect(await options.evaluate((element) => element.closest('[data-slot="dialog-content"]'))).toBeNull()

  const optionsBox = await options.boundingBox()
  expect(triggerBox).not.toBeNull()
  expect(optionsBox).not.toBeNull()
  expect(optionsBox!.width / triggerBox!.width, JSON.stringify({ triggerBox, optionsBox })).toBeGreaterThanOrEqual(0.9)

  await options.getByRole("option", { name: "Operacional" }).click()
  await expect(permissionSelect).toContainText("Operacional")
  await expect(options).toBeHidden()
})

test("abre o multiselect de destinatários sobre a modal de notificação", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.route("**/api/v1/settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: {
          clientTypes: [],
          permissionProfiles,
          users: [],
          notificationRules: [{
            id: "notification-certificate-ready",
            name: "Certificado pronto para emissão",
            description: "Regra com destinatários configuráveis.",
            type: "certificate_ready",
            daysBefore: 0,
            contractExpirationAlertDays: [],
            time: "08:00",
            channels: ["system"],
            targetTeamIds: [],
            targetEmployeeIds: [],
            isActive: true,
            isDefault: true,
            createdAt: "2026-08-03T12:00:00.000Z",
            updatedAt: "2026-08-03T12:00:00.000Z",
          }],
          permissions: [],
          notificationTypes: [],
          notificationChannels: [],
        },
      }),
    })
  })

  await page.setViewportSize({ width: 550, height: 790 })
  await page.goto("/configuracoes?section=notifica%C3%A7%C3%B5es")

  const ruleCard = page.locator('[data-slot="card"]').filter({ hasText: "Certificado pronto para emissão" })
  await expect(ruleCard).toBeVisible()
  await ruleCard.locator("button").last().click()

  const dialog = page.getByRole("dialog", { name: "Editar Notificação Padrão" })
  const employeesSelect = dialog.getByRole("combobox", { name: "Buscar e adicionar funcionários..." })
  await employeesSelect.click()

  const options = page.locator('[data-slot="popover-content"]')
  await expect(options).toBeVisible()
  expect(await options.evaluate((element) => element.closest('[data-slot="dialog-content"]'))).toBeNull()
  await expect(options.getByRole("option", { name: /Funcionário E2E/ })).toBeVisible()
})
