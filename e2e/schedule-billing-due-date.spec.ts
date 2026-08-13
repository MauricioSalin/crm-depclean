import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test("exibe vencimento junto do valor nas criações de Agenda e Agendamentos", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  for (const path of ["/agendamentos", "/agenda"]) {
    await page.goto(path)
    await page.getByRole("button", { name: "Novo Agendamento", exact: true }).click()

    const dialog = page.getByRole("dialog", { name: "Novo atendimento avulso" })
    const billingDueDate = dialog.getByRole("button", { name: "Data de vencimento" })
    await expect(billingDueDate).toBeDisabled()

    await dialog.getByRole("checkbox", { name: "Gerar cobrança no financeiro" }).click()
    await expect(billingDueDate).toBeEnabled()
    await expect(dialog.getByText("Valor (R$)", { exact: true })).toBeVisible()

    await page.keyboard.press("Escape")
  }
})

test("preenche o vencimento nas edições abertas por Agendamentos e Agenda", async ({ page }) => {
  const manualSchedule = {
    ...scheduleFixture,
    id: "schedule-billing-edit",
    contractId: null,
    contractServiceId: null,
    contractServiceIds: [],
    isManual: true,
    billingDueDate: "2026-08-20",
  }

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [manualSchedule] }),
      })
      return
    }
    if (request.method() === "GET" && pathname === `/api/v1/schedules/${manualSchedule.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: manualSchedule }),
      })
      return
    }
    await route.fallback()
  })

  await page.goto("/agendamentos")
  await page.getByRole("button", { name: `Abrir ações do agendamento de ${manualSchedule.clientName}` }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  await expect(page.getByRole("button", { name: "Data de vencimento" })).toContainText("20/08/2026")

  await page.keyboard.press("Escape")
  await page.goto(`/agenda?scheduleId=${manualSchedule.id}`)
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  await expect(page.getByRole("button", { name: "Data de vencimento" })).toContainText("20/08/2026")
})

test("lista a cobrança avulsa em Extras e permite editar, pagar ou marcar como não paga", async ({ page }) => {
  type BillingScheduleState = Omit<
    typeof scheduleFixture,
    | "id"
    | "contractId"
    | "contractServiceId"
    | "contractServiceIds"
    | "isManual"
    | "status"
    | "value"
    | "billingDueDate"
    | "billingStatus"
    | "effectiveBillingStatus"
  > & {
    id: string
    contractId: null
    contractServiceId: null
    contractServiceIds: string[]
    isManual: true
    status: "completed"
    value: number
    billingDueDate: string
    billingStatus: "pending" | "paid" | "overdue"
    effectiveBillingStatus: "overdue" | "pending" | "paid"
  }
  let scheduleState: BillingScheduleState = {
    ...scheduleFixture,
    id: "schedule-client-charge",
    contractId: null,
    contractServiceId: null,
    contractServiceIds: [],
    isManual: true,
    status: "completed" as const,
    value: 5_040,
    billingDueDate: "2026-08-20",
    billingStatus: "pending" as const,
    effectiveBillingStatus: "overdue" as const,
  }
  const billingPatches: Array<Record<string, unknown>> = []

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [scheduleState] }),
      })
      return
    }
    if (request.method() === "PATCH" && pathname === `/api/v1/schedules/${scheduleState.id}/billing`) {
      const patch = request.postDataJSON() as Record<string, unknown>
      billingPatches.push(patch)
      const paid = patch.billingStatus === "paid"
      scheduleState = {
        ...scheduleState,
        value: typeof patch.value === "number" ? patch.value : scheduleState.value,
        billingDueDate: typeof patch.billingDueDate === "string" ? patch.billingDueDate : scheduleState.billingDueDate,
        billingStatus: paid ? "paid" : patch.billingStatus === "overdue" ? "overdue" : "pending",
        effectiveBillingStatus: paid ? "paid" : patch.billingStatus === "overdue" ? "overdue" : "pending",
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: scheduleState }),
      })
      return
    }
    await route.fallback()
  })

  await page.goto(`/clientes/${scheduleFixture.clientId}?tab=agenda`)
  const agendaRow = page.getByRole("row").filter({ hasText: scheduleState.serviceTypeName })
  await expect(agendaRow.getByText("R$ 5.040,00", { exact: true })).toBeVisible()
  await expect(agendaRow.getByText("Venc. 20/08/2026", { exact: true })).toBeVisible()
  await expect(agendaRow.getByText("Vencida", { exact: true })).toBeVisible()

  await page.getByRole("tab", { name: /Parcelas/ }).click()
  await expect(page.getByRole("row").filter({ hasText: "Agendamento avulso" })).toHaveCount(0)

  await page.getByRole("tab", { name: /Extras/ }).click()
  const chargeRow = page.getByRole("row").filter({ hasText: "Agendamento avulso" })
  await expect(chargeRow.getByText(scheduleState.serviceTypeName, { exact: true })).toBeVisible()
  await expect(chargeRow.getByText("R$ 5.040,00", { exact: true })).toBeVisible()
  await expect(chargeRow.getByText("20/08/2026", { exact: true })).toBeVisible()

  await chargeRow.getByRole("button", { name: "Abrir ações da cobrança do agendamento avulso" }).click()
  await page.getByRole("menuitem", { name: "Editar cobrança" }).click()
  const editDialog = page.getByRole("dialog", { name: "Editar cobrança avulsa" })
  const valueInput = editDialog.getByRole("textbox", { name: "Valor", exact: true })
  await expect(valueInput).toBeEnabled()
  await valueInput.press("Backspace")
  await valueInput.press("Backspace")
  await valueInput.press("Backspace")
  await valueInput.press("Backspace")
  await valueInput.press("Backspace")
  await valueInput.press("Backspace")
  await valueInput.pressSequentially("612345")
  await editDialog.getByLabel("Vencimento da parcela").click()
  await page.getByRole("button", { name: /25 de agosto de 2026/i }).click()
  await editDialog.getByRole("button", { name: "Salvar alterações" }).click()
  await expect.poll(() => billingPatches.at(-1)).toMatchObject({
    value: 6_123.45,
    billingDueDate: "2026-08-25",
    billingStatus: "pending",
  })
  await expect(chargeRow.getByText("R$ 6.123,45", { exact: true })).toBeVisible()
  await expect(chargeRow.getByText("25/08/2026", { exact: true })).toBeVisible()

  await chargeRow.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Marcar como paga" }).click()
  await expect.poll(() => billingPatches.at(-1)).toMatchObject({
    billingStatus: "paid",
    paidDate: expect.any(String),
    paidValue: 6_123.45,
  })
  await expect(chargeRow.getByText("Paga", { exact: true })).toBeVisible()

  await chargeRow.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Marcar como não paga" }).click()
  await expect.poll(() => billingPatches.at(-1)).toMatchObject({ billingStatus: "pending" })
  await expect(chargeRow.getByText("Pendente", { exact: true })).toBeVisible()
})
