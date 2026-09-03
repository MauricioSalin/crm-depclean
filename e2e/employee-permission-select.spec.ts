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

test("configura serviços sem horário e mantém tipo e horário sem sobreposição", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  const reminderRule = {
    id: "default-schedule-reminder-client",
    name: "Lembrete de agendamento ao cliente",
    description: "Clientes recebem um lembrete antes de qualquer agendamento.",
    type: "schedule_reminder",
    daysBefore: 7,
    contractExpirationAlertDays: [],
    time: "08:00",
    channels: ["whatsapp"],
    targetTeamIds: [],
    targetEmployeeIds: [],
    hideTimeServiceTypeIds: [],
    isActive: true,
    isDefault: true,
    createdAt: "2026-09-03T12:00:00.000Z",
    updatedAt: "2026-09-03T12:00:00.000Z",
  }
  let submittedPayload: Record<string, unknown> | undefined

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
          notificationRules: [reminderRule],
          permissions: [],
          notificationTypes: [],
          notificationChannels: [],
        },
      }),
    })
  })
  await page.route("**/api/v1/settings/notification-rules/default-schedule-reminder-client", async (route) => {
    submittedPayload = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: { ...reminderRule, ...submittedPayload },
      }),
    })
  })

  await page.setViewportSize({ width: 1024, height: 820 })
  await page.goto("/configuracoes?section=notifica%C3%A7%C3%B5es")

  const ruleCard = page.locator('[data-slot="card"]').filter({ hasText: reminderRule.name })
  await ruleCard.locator("button").last().click()

  const dialog = page.getByRole("dialog", { name: "Editar Notificação Padrão" })
  const typeSelect = dialog.getByRole("combobox").first()
  const timeInput = dialog.locator("#rule-time")
  const [dialogBox, typeBox, timeBox] = await Promise.all([
    dialog.boundingBox(),
    typeSelect.boundingBox(),
    timeInput.boundingBox(),
  ])

  expect(dialogBox).not.toBeNull()
  expect(typeBox).not.toBeNull()
  expect(timeBox).not.toBeNull()
  expect(typeBox!.x + typeBox!.width).toBeLessThanOrEqual(timeBox!.x)
  expect(timeBox!.x + timeBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width)

  await expect(dialog.getByLabel("Ocultar horário na mensagem")).toHaveCount(0)
  const servicesSelect = dialog.getByRole("combobox", { name: "Selecionar serviços sem horário específico" })
  await expect(servicesSelect).toBeVisible()
  await servicesSelect.click()
  await page.getByRole("option", { name: /Controle de pragas E2E/ }).click()
  await page.keyboard.press("Escape")
  await dialog.getByRole("button", { name: "Salvar" }).click()

  await expect.poll(() => submittedPayload).toBeDefined()
  expect(submittedPayload?.hideTimeServiceTypeIds).toEqual(["service-e2e"])
})

test("mantém os campos das demais modais de configuração dentro dos limites", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.setViewportSize({ width: 1024, height: 820 })

  const cases = [
    { section: "tipos-cliente", button: "Novo Tipo", dialog: "Novo Tipo de Cliente" },
    { section: "permissoes", button: "Novo Perfil", dialog: "Nova Permissão" },
    { section: "usuarios", button: "Novo Usuário", dialog: "Novo Usuário do Sistema" },
  ]

  for (const item of cases) {
    await page.goto(`/configuracoes?section=${item.section}`)
    await page.getByRole("button", { name: item.button }).click()
    const dialog = page.getByRole("dialog", { name: item.dialog })
    await expect(dialog).toBeVisible()

    const dialogBox = await dialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    const fieldBoxes = await dialog.locator('input, textarea, [role="combobox"]').evaluateAll((fields) =>
      fields.filter((field) => {
        const style = window.getComputedStyle(field)
        return style.display !== "none" && style.visibility !== "hidden"
      }).map((field) => {
        const box = field.getBoundingClientRect()
        return { left: box.left, right: box.right }
      }),
    )

    for (const fieldBox of fieldBoxes) {
      expect(fieldBox.left).toBeGreaterThanOrEqual(dialogBox!.x)
      expect(fieldBox.right).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width)
    }

    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
  }
})
