import { expect, test } from "@playwright/test"
import path from "node:path"

import { clientFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

test("exibe vencimento junto do valor nas criações de Agenda e Agendamentos", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  for (const path of ["/agendamentos", "/agenda"]) {
    await page.goto(path)
    await page.getByRole("button", { name: "Novo Agendamento", exact: true }).click()

    const dialog = page.getByRole("dialog", { name: "Novo atendimento avulso" })
    const billingDueDate = dialog.getByRole("button", { name: "Data de vencimento" })
    await expect(billingDueDate).toHaveCount(0)
    await expect(dialog.getByLabel("Valor (R$)", { exact: true })).toHaveCount(0)
    await expect(dialog.getByLabel("Qtd. de parcelas", { exact: true })).toHaveCount(0)

    await dialog.getByRole("checkbox", { name: "Gerar cobrança no financeiro" }).click()
    await expect(billingDueDate).toBeEnabled()
    await expect(dialog.getByText("Valor (R$)", { exact: true })).toBeVisible()
    await expect(dialog.getByLabel("Qtd. de parcelas", { exact: true })).toHaveValue("1")
    await expect(dialog.getByLabel("Valor de entrada", { exact: true })).toBeVisible()

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

test("lista a cobrança avulsa em Extras e oferece todos os status financeiros", async ({ page }) => {
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
    billingStatus: "pending" | "paid" | "late" | "overdue"
    effectiveBillingStatus: "pending" | "paid" | "late" | "overdue"
    paidDate?: string
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
      const nextStatus = patch.billingStatus === "paid"
        || patch.billingStatus === "late"
        || patch.billingStatus === "overdue"
        || patch.billingStatus === "pending"
        ? patch.billingStatus
        : scheduleState.billingStatus
      scheduleState = {
        ...scheduleState,
        value: typeof patch.value === "number" ? patch.value : scheduleState.value,
        billingDueDate: typeof patch.billingDueDate === "string" ? patch.billingDueDate : scheduleState.billingDueDate,
        billingStatus: nextStatus,
        effectiveBillingStatus: nextStatus,
        paidDate: typeof patch.paidDate === "string" ? patch.paidDate : paid ? scheduleState.paidDate : undefined,
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
  await expect(page.getByRole("columnheader", { name: "Ordenar por Valor", exact: true })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Ordenar por Vencimento", exact: true })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Ordenar por Status da cobrança", exact: true })).toBeVisible()
  await expect(agendaRow.getByText("20/08/2026", { exact: true })).toBeVisible()
  await expect(agendaRow.getByText("Vencida", { exact: true })).toBeVisible()

  await page.getByRole("tab", { name: /Parcelas/ }).click()
  await expect(page.getByRole("row").filter({ hasText: "Agendamento avulso" })).toHaveCount(0)

  await page.getByRole("tab", { name: /Extras/ }).click()
  await expect(page.getByRole("columnheader", { name: "Data do pagamento" })).toBeVisible()
  const chargeRow = page.getByRole("row").filter({ hasText: "Agendamento avulso" })
  await expect(chargeRow.getByText(scheduleState.serviceTypeName, { exact: true })).toBeVisible()
  await expect(chargeRow.getByText("R$ 5.040,00", { exact: true })).toBeVisible()
  await expect(chargeRow.getByText("20/08/2026", { exact: true })).toBeVisible()

  await chargeRow.getByRole("button", { name: "Abrir ações da cobrança do agendamento avulso" }).click()
  await expect(page.getByRole("menuitem", { name: "Marcar como atrasada" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Marcar como pendente" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Marcar como vencida" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Marcar como atrasada" }).click()
  await expect.poll(() => billingPatches.at(-1)).toMatchObject({ billingStatus: "late" })
  await expect(chargeRow.getByText("Atrasada", { exact: true })).toBeVisible()

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
    billingStatus: "late",
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
  const paidDate = String(billingPatches.at(-1)?.paidDate)
  await expect(chargeRow.getByText(paidDate.slice(0, 10).split("-").reverse().join("/"), { exact: true })).toBeVisible()
  await expect(chargeRow.getByText("Paga", { exact: true })).toBeVisible()

  await chargeRow.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Marcar como vencida" }).click()
  await expect.poll(() => billingPatches.at(-1)).toMatchObject({ billingStatus: "overdue" })
  await expect(chargeRow.getByText("Vencida", { exact: true })).toBeVisible()

  await chargeRow.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Marcar como pendente" }).click()
  await expect.poll(() => billingPatches.at(-1)).toMatchObject({ billingStatus: "pending" })
  await expect(chargeRow.getByText("Pendente", { exact: true })).toBeVisible()
})

for (const financialAccess of [true, false]) test(`separa as colunas da cobrança e mantém hífen nos recorrentes (financeiro: ${financialAccess})`, async ({ page }) => {
  const user = financialAccess ? E2E_USER : { ...E2E_USER, permissions: E2E_USER.permissions.filter((permission) => !["financial_view", "financial_manage", "settings_manage"].includes(permission)) }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  await page.setViewportSize({ width: 1600, height: 1000 })
  const manual = { ...scheduleFixture, id: "charged", serviceTypeName: "Cobrança avulsa", isManual: true, contractId: null, billable: true, value: 950, date: "2026-11-23", billingDueDate: "2026-11-30", billingStatus: "pending", effectiveBillingStatus: "pending" }
  const schedules = [
    manual,
    { ...scheduleFixture, id: "recurring", serviceTypeName: "Visita recorrente", isManual: false, date: "2026-11-20" },
    { ...manual, id: "free", serviceTypeName: "Avulso sem cobrança", billable: false, date: "2026-11-19" },
    { ...manual, id: "cancelled", serviceTypeName: "Cobrança cancelada", status: "cancelled", date: "2026-11-18" },
  ]
  await page.route("**/api/v1/schedules", (route) => route.fulfill({ json: { success: true, data: schedules } }))
  await page.goto(`/clientes/${clientFixture.id}?tab=agenda`)
  const table = page.getByRole("table")
  await expect(page.getByRole("columnheader", { name: "Ordenar por Status", exact: true })).toBeVisible()
  if (!financialAccess) {
    for (const name of ["Valor", "Vencimento", "Status da cobrança"]) await expect(table.getByRole("columnheader", { name: `Ordenar por ${name}`, exact: true })).toHaveCount(0)
    await expect(table.getByText("R$ 950,00", { exact: true })).toHaveCount(0)
    return
  }
  const charged = table.getByRole("row").filter({ hasText: "Cobrança avulsa" })
  await expect(charged.getByRole("cell").nth(6)).toHaveText("R$ 950,00")
  await expect(charged.getByRole("cell").nth(7)).toHaveText("30/11/2026")
  await expect(charged.getByRole("cell").nth(8)).toHaveText("Pendente")
  await expect(charged.getByRole("cell").nth(9)).toHaveText("Agendado")
  for (const name of ["Visita recorrente", "Avulso sem cobrança"]) {
    const row = table.getByRole("row").filter({ hasText: name })
    for (const index of [6, 7, 8]) await expect(row.getByRole("cell").nth(index)).toHaveText("-")
  }
  await expect(table.getByRole("row").filter({ hasText: "Cobrança cancelada" }).getByRole("cell").nth(8)).toHaveText("Cancelada")
  if (process.env.E2E_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.E2E_SCREENSHOT_DIR, "05-financeiro-colunas.png"), animations: "disabled" })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(table.getByRole("columnheader", { name: "Ordenar por Vencimento", exact: true })).toBeVisible()
  await expect(charged.getByText("30/11/2026", { exact: true })).toHaveText("30/11/2026")
})

test("padroniza o menu de status dos extras cadastrados", async ({ page }) => {
  let extraState = {
    id: "extra-e2e",
    clientId: clientFixture.id,
    description: "Descarte adicional",
    value: 480,
    createdDate: "2026-08-01",
    dueDate: "2026-08-10",
    status: "overdue" as "pending" | "paid" | "late" | "overdue",
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  }
  const statusPatches: string[] = []

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/extras**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === "GET" && pathname === `/api/v1/clients/${clientFixture.id}/extras`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [extraState] }),
      })
      return
    }
    if (request.method() === "PATCH" && pathname === `/api/v1/clients/${clientFixture.id}/extras/${extraState.id}/status`) {
      const patch = request.postDataJSON() as { status: typeof extraState.status }
      statusPatches.push(patch.status)
      extraState = { ...extraState, status: patch.status }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: extraState }),
      })
      return
    }
    await route.fallback()
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=extras`)
  const extraRow = page.getByRole("row").filter({ hasText: extraState.description })
  await extraRow.getByRole("button", { name: "Abrir ações do valor extra" }).click()
  await expect(page.getByRole("menuitem", { name: "Marcar como paga" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Marcar como pendente" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Marcar como atrasada" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Marcar como vencida" })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Marcar como cancelada" })).toHaveCount(0)

  await page.getByRole("menuitem", { name: "Marcar como atrasada" }).click()
  await expect.poll(() => statusPatches.at(-1)).toBe("late")
  await expect(extraRow.getByText("Atrasada", { exact: true })).toBeVisible()
})
