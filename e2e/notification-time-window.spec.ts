import { expect, test } from "@playwright/test"
import { installApiMock, serviceFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const types = ["new_schedule", "schedule_confirmed", "schedule_change", "schedule_cancel", "schedule_reminder", "informative", "certificate"]

for (const width of [1440, 390]) {
  test(`configura faixa de horario por notificacao e preserva a escolha (${width}px)`, async ({ page }) => {
    test.setTimeout(120_000)
    page.setDefaultTimeout(15_000)
    await page.setViewportSize({ width, height: 1000 })
    await installAuthenticatedSession(page)
    await installApiMock(page)
    const rules = types.map((type) => ({
      id: `rule-${type}`, name: `Regra ${type}`, type, description: "",
      daysBefore: 7, contractExpirationAlertDays: [], time: "08:00", channels: ["whatsapp"],
      targetTeamIds: [], targetEmployeeIds: [], hideTimeServiceTypeIds: [] as string[],
      hideTimeForAllServices: true, isDefault: true, isActive: true,
      createdAt: "2026-10-20T12:00:00Z", updatedAt: "2026-10-20T12:00:00Z",
    }))
    await page.route("**/api/v1/settings", (route) => route.fulfill({ json: {
      success: true, data: {
        clientTypes: [], permissionProfiles: [], users: [], notificationRules: rules,
        permissions: [], notificationTypes: types.map((value) => ({ value, label: value })),
        notificationChannels: [{ value: "whatsapp", label: "WhatsApp" }],
      },
    } }))
    await page.route("**/api/v1/settings/notification-rules/*", async (route) => {
      const id = new URL(route.request().url()).pathname.split("/").at(-1)
      const rule = rules.find((item) => item.id === id)!
      Object.assign(rule, route.request().postDataJSON())
      await route.fulfill({ json: { success: true, data: rule } })
    })
    await page.goto(`/configuracoes?section=${encodeURIComponent("notificações")}`)
    const dialog = page.getByRole("dialog", { name: "Editar Notificação Padrão" })
    for (const type of types) {
      await page.getByRole("button", { name: `Editar notificação Regra ${type}`, exact: true }).click()
      const toggle = dialog.getByRole("switch", { name: "Entre 08h e 18h para todos os serviços" })
      await expect(toggle).toBeChecked()
      await toggle.click()
      const services = dialog.getByRole("combobox", { name: "Selecionar serviços sem horário específico" })
      await expect(services).toBeVisible()
      if (type === "new_schedule") {
        await services.click()
        await page.getByRole("option", { name: serviceFixture.name }).click()
        await page.keyboard.press("Escape")
      }
      await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
      await expect(dialog).not.toBeVisible()
      expect(rules.find((item) => item.type === type)?.hideTimeForAllServices).toBe(false)
    }
    expect(rules[0].hideTimeServiceTypeIds).toEqual([serviceFixture.id])
    expect(rules.slice(1).every((rule) => rule.hideTimeServiceTypeIds.length === 0)).toBe(true)
    await page.reload()
    await page.getByRole("button", { name: "Editar notificação Regra new_schedule", exact: true }).click()
    await expect(dialog.getByRole("switch", { name: "Entre 08h e 18h para todos os serviços" })).not.toBeChecked()
    await expect(dialog).toContainText(serviceFixture.name)
    await dialog.getByRole("switch", { name: "Entre 08h e 18h para todos os serviços" }).click()
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(rules[0].hideTimeForAllServices).toBe(true)
    expect(rules[1].hideTimeForAllServices).toBe(false)
  })
}
