import { expect, test, type Locator } from "@playwright/test"
import { clientFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import type { ScheduleRecord } from "../lib/api/schedules"

async function setMoney(input: Locator, digits: string) {
  for (let index = 0; index < 12; index++) await input.press("Backspace")
  await input.pressSequentially(digits)
}

function billableSchedule(): ScheduleRecord {
  return {
    ...scheduleFixture, id: "schedule-installments", contractId: "", contractServiceId: "", contractServiceIds: [],
    isManual: true, billable: true, status: "in_progress", canAttachNa: true,
    value: 1000, billingInstallmentsCount: 5, billingDownPaymentValue: 500, billingDueDate: "2026-09-10",
    billingStatus: "pending", effectiveBillingStatus: "pending",
    billingInstallments: ["2026-09-10", "2026-10-10", "2026-11-10", "2026-12-10", "2027-01-10"].map((dueDate, index) => ({
      id: `extra-${index + 1}`, number: index + 1, value: index === 0 ? 500 : 125, dueDate, status: "pending", effectiveStatus: "pending",
    })),
  } as ScheduleRecord
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-28T12:00:00Z"))
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

for (const screen of ["agendamentos", "agenda", "dashboard"] as const) {
  test(`plano avulso: ${screen} envia e recarrega quantidade, entrada e vencimento`, async ({ page }) => {
    let record = billableSchedule()
    let saved: Record<string, unknown> | undefined
    await page.route("**/api/v1/schedules**", async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === "/api/v1/schedules") return route.fulfill({ json: { success: true, data: [record] } })
      if (path === `/api/v1/schedules/${record.id}`) {
        if (route.request().method() === "PATCH") {
          saved = route.request().postDataJSON()
          record = { ...record, ...saved }
        }
        return route.fulfill({ json: { success: true, data: record } })
      }
      await route.fallback()
    })
    const openForm = async () => {
      if (screen === "agendamentos") {
        await page.goto("/agendamentos")
        await page.getByRole("button", { name: `Abrir ações do agendamento de ${record.clientName}` }).click()
        await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
      } else if (screen === "agenda") {
        await page.goto(`/agenda?scheduleId=${record.id}`)
        await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
      } else {
        await page.goto("/")
        await page.locator('[data-dashboard-widget="live-services"]').getByRole("button", { name: `Abrir agendamento de ${record.clientName}` }).click()
        await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
      }
      return page.getByRole("dialog", { name: "Editar atendimento avulso" })
    }
    const dialog = await openForm()
    await expect(dialog.getByLabel("Qtd. de parcelas", { exact: true })).toHaveValue("5")
    await expect(dialog.getByLabel("Valor de entrada", { exact: true })).toHaveValue("R$ 500,00")
    await expect(dialog.getByRole("button", { name: "Data de vencimento" })).toContainText("10/09/2026")
    await dialog.getByLabel("Qtd. de parcelas", { exact: true }).fill("4")
    await setMoney(dialog.getByLabel("Valor de entrada", { exact: true }), "40000")
    if (screen === "agendamentos") {
      const fields = dialog.locator("#schedule-billing-value").locator("../..")
      const billingSection = fields.locator("..")
      await expect(fields).toHaveCSS("border-top-width", "0px")
      await expect(fields).toHaveCSS("padding", "0px")
      for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport)
        const spacing = await fields.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return {
            before: rect.top - element.previousElementSibling!.getBoundingClientRect().bottom,
            after: element.nextElementSibling!.getBoundingClientRect().top - rect.bottom,
            overflow: element.scrollWidth > element.clientWidth,
          }
        })
        expect(spacing).toEqual({ before: 20, after: 20, overflow: false })
        await billingSection.screenshot({ path: `test-results/schedule-installments-form-${viewport.width}.png` })
      }
      await page.setViewportSize({ width: 1280, height: 900 })
    }
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
    await expect.poll(() => saved).toMatchObject({ billable: true, value: 1000, billingInstallmentsCount: 4, billingDownPaymentValue: 400, billingDueDate: "2026-09-10" })
    const reopened = await openForm()
    await expect(reopened.getByLabel("Qtd. de parcelas", { exact: true })).toHaveValue("4")
    await expect(reopened.getByLabel("Valor de entrada", { exact: true })).toHaveValue("R$ 400,00")
  })
}

test("Extras mostra cinco registros e edita somente o valor, vencimento e pagamento da parcela escolhida", async ({ page }) => {
  const record = billableSchedule()
  const patches: Record<string, unknown>[] = []
  await page.route("**/api/v1/schedules**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/v1/schedules") return route.fulfill({ json: { success: true, data: [record] } })
    if (path === `/api/v1/schedules/${record.id}/billing`) {
      const patch = route.request().postDataJSON()
      patches.push(patch)
      const item = record.billingInstallments!.find((item) => item.id === patch.installmentId)!
      if (patch.value !== undefined) item.value = patch.value
      if (patch.billingDueDate) item.dueDate = patch.billingDueDate
      if (patch.billingStatus) item.status = item.effectiveStatus = patch.billingStatus
      item.paidDate = patch.paidDate
      item.paidValue = patch.paidValue
      record.value = record.billingInstallments!.reduce((sum, entry) => sum + entry.value, 0)
      return route.fulfill({ json: { success: true, data: record } })
    }
    await route.fallback()
  })
  await page.goto(`/clientes/${clientFixture.id}?tab=extras`)
  await expect(page.getByRole("columnheader", { name: "Qtd. de parcelas" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Valor de entrada" })).toBeVisible()
  const rows = page.getByRole("row").filter({ hasText: "Agendamento avulso" })
  await expect(rows).toHaveCount(5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const dates = ["10/09/2026", "10/10/2026", "10/11/2026", "10/12/2026", "10/01/2027"]
  for (let index = 0; index < 5; index++) {
    const row = rows.filter({ hasText: `Parcela ${index + 1}/5` })
    await expect(row.getByRole("cell").nth(2)).toHaveText(index === 0 ? "R$ 500,00" : "R$ 125,00")
    await expect(row.getByRole("cell").nth(3)).toHaveText("5")
    await expect(row.getByRole("cell").nth(4)).toHaveText("R$ 500,00")
    await expect(row.getByText(dates[index], { exact: true })).toBeVisible()
  }
  await page.getByRole("tabpanel").evaluate((panel) => panel.querySelectorAll("div").forEach((element) => { element.scrollLeft = 0 }))
  await page.setViewportSize({ width: 1536, height: 1100 })
  await page.screenshot({ path: "test-results/schedule-installments-extras.png" })
  const second = rows.filter({ hasText: "Parcela 2/5" })
  await second.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Editar cobrança", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar cobrança avulsa" })
  await setMoney(dialog.getByRole("textbox", { name: "Valor", exact: true }), "15000")
  await dialog.getByLabel("Vencimento da parcela").click()
  await page.getByRole("button", { name: /15 de outubro de 2026/i }).click()
  await dialog.getByRole("button", { name: "Salvar alterações" }).click()
  await expect.poll(() => patches.at(-1)).toMatchObject({ installmentId: "extra-2", value: 150, billingDueDate: "2026-10-15" })
  await expect(second.getByRole("cell").nth(2)).toHaveText("R$ 150,00")
  await expect(second.getByText("15/10/2026", { exact: true })).toBeVisible()
  await expect(rows.filter({ hasText: "Parcela 3/5" }).getByRole("cell").nth(2)).toHaveText("R$ 125,00")
  await second.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Marcar como paga" }).click()
  await expect.poll(() => patches.at(-1)).toMatchObject({ installmentId: "extra-2", billingStatus: "paid", paidValue: 150 })
  await expect(second.getByText("Paga", { exact: true })).toBeVisible()
  await page.reload()
  await expect(second.getByRole("cell").nth(2)).toHaveText("R$ 150,00")
  await expect(second.getByText("Paga", { exact: true })).toBeVisible()
  await page.getByRole("tab", { name: /Parcelas/ }).click()
  await expect(page.getByRole("row").filter({ hasText: "Agendamento avulso" })).toHaveCount(0)
})
