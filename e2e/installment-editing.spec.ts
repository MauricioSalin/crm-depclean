import { expect, test } from "@playwright/test"

import {
  clientFixture,
  contractFixture,
  installApiMock,
} from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const contractViewer = {
  ...E2E_USER,
  id: "user-e2e-contract-viewer",
  permissions: ["clients_view", "contracts_view"],
  permissionProfileName: "Visualização de contratos",
}

test("edita a mesma parcela nos perfis do cliente e do contrato sem repetir o status atual", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  const installmentId = "e2e-0001-inst-1"
  let installmentPatch: Record<string, unknown> | null = null
  let contractState = {
    ...contractFixture,
    installmentsCount: 1,
    installments: [{
      id: installmentId,
      number: 1,
      value: 866.66,
      dueDate: "2026-07-22T03:00:00.000Z",
      paidDate: "2026-07-28T03:00:00.000Z",
      paidValue: 866.66,
      status: "paid" as const,
      paymentMethod: "",
      notes: "",
      createdAt: "2026-07-01T12:00:00.000Z",
    }],
  }

  await page.route("**/api/v1/contracts**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/contracts") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [contractState] }),
      })
      return
    }

    if (request.method() === "GET" && pathname === `/api/v1/contracts/${contractFixture.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: contractState }),
      })
      return
    }

    if (
      request.method() === "PATCH"
      && pathname === `/api/v1/contracts/${contractFixture.id}/installments/${installmentId}`
    ) {
      installmentPatch = request.postDataJSON() as Record<string, unknown>
      contractState = {
        ...contractState,
        installments: contractState.installments.map((installment) => ({
          ...installment,
          dueDate: String(installmentPatch?.dueDate),
          paidDate: String(installmentPatch?.paidDate),
          paidValue: installment.value,
        })),
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: contractState }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=parcelas`)
  await expect(page.getByRole("columnheader", { name: "Data do pagamento" })).toBeVisible()
  const clientInstallmentRow = page.getByRole("row").filter({ hasText: "1/1" })
  await expect(clientInstallmentRow.getByText("28/07/2026", { exact: true })).toBeVisible()
  await clientInstallmentRow.getByRole("button").click()
  await expect(page.getByRole("menuitem", { name: "Editar parcela" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Marcar como paga" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Editar parcela" }).click()
  await expect(page.getByRole("dialog", { name: "Editar parcela 1" })).toBeVisible()
  await expect(page.getByLabel("Vencimento da parcela")).toHaveText("22/07/2026")
  await expect(page.getByLabel("Vencimento da parcela")).toBeEnabled()
  await expect(page.getByLabel("Data de pagamento da parcela")).toHaveText("28/07/2026")
  await page.getByRole("button", { name: "Cancelar" }).click()

  await page.goto(`/contratos/${contractFixture.id}?tab=parcelas`)
  const contractInstallmentRow = page.getByRole("row").filter({ hasText: "1/1" })
  await contractInstallmentRow.getByRole("button").click()
  await expect(page.getByRole("menuitem", { name: "Marcar como paga" })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Editar parcela" }).click()

  const valueInput = page.getByRole("textbox", { name: "Valor", exact: true })
  await expect(valueInput).toHaveValue("R$ 866,66")
  await expect(valueInput).toBeDisabled()
  await page.getByLabel("Vencimento da parcela").click()
  await page.getByRole("button", { name: /24 de julho de 2026/i }).click()
  await page.getByRole("button", { name: "Salvar alterações" }).click()

  await expect.poll(() => installmentPatch).toEqual({
    dueDate: "2026-07-24",
    status: "paid",
    paidDate: "2026-07-28",
  })
  await expect(page.getByRole("dialog", { name: "Editar parcela 1" })).toHaveCount(0)
})

test("edita parcelas contratuais e abre cobranças avulsas na tabela do relatório financeiro", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  const installmentId = "e2e-report-inst-1"
  let installmentPatch: Record<string, unknown> | null = null
  let schedulePatch: Record<string, unknown> | null = null

  await page.route("**/api/v1/analytics/financial**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: {
          summary: {
            totalPaid: 0,
            totalReceivable: 2_366.66,
            totalPending: 2_366.66,
            totalLate: 0,
            totalOverdue: 0,
            paidCount: 0,
            pendingCount: 2,
            lateCount: 0,
            overdueCount: 0,
            totalCount: 2,
            adherenceRate: 0,
          },
          installments: [
            {
              id: installmentId,
              contractId: contractFixture.id,
              contractNumber: contractFixture.contractNumber,
              clientId: clientFixture.id,
              clientCompanyName: clientFixture.companyName,
              source: "contract",
              number: 1,
              value: 866.66,
              dueDate: "2026-08-07T03:00:00.000Z",
              status: "overdue",
              storedStatus: "pending",
            },
            {
              id: "schedule-e2e-report",
              contractId: "",
              contractNumber: "Agendamento avulso",
              clientId: "client-report-schedule",
              clientCompanyName: "Cliente Avulso E2E",
              source: "schedule",
              scheduleId: "e2e-report",
              number: 1,
              value: 1_500,
              dueDate: "2026-08-28T03:00:00.000Z",
              status: "pending",
              storedStatus: "pending",
            },
          ],
          monthlyRevenueData: [],
          financeHealthData: [],
        },
      }),
    })
  })

  await page.route(`**/api/v1/contracts/${contractFixture.id}/installments/${installmentId}`, async (route) => {
    installmentPatch = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: contractFixture }),
    })
  })

  await page.route("**/api/v1/schedules/e2e-report/billing", async (route) => {
    schedulePatch = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: { id: "e2e-report" } }),
    })
  })

  await page.goto("/relatorios?tab=financial")

  const contractRow = page.getByRole("row").filter({ hasText: clientFixture.companyName })
  await contractRow.getByRole("button", { name: "Abrir ações da parcela" }).click()
  const editAction = page.getByRole("menuitem", { name: "Editar parcela" })
  await expect(editAction.locator("svg")).toBeVisible()
  await editAction.click()

  await expect(page.getByRole("dialog", { name: "Editar parcela 1" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Valor", exact: true })).toBeDisabled()
  await page.getByLabel("Vencimento da parcela").click()
  await page.getByRole("button", { name: /29 de agosto de 2026/i }).click()
  await page.getByRole("button", { name: "Salvar alterações" }).click()

  await expect.poll(() => installmentPatch).toEqual({
    dueDate: "2026-08-29",
    status: "pending",
  })

  const scheduleRow = page.getByRole("row").filter({ hasText: "Cliente Avulso E2E" })
  await scheduleRow.getByRole("button", { name: "Abrir ações da parcela" }).click()
  await page.getByRole("menuitem", { name: "Editar parcela" }).click()
  await expect(page.getByRole("dialog", { name: "Editar cobrança avulsa" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Valor", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Salvar alterações" }).click()
  await expect.poll(() => schedulePatch).toEqual({
    value: 1_500,
    billingDueDate: "2026-08-28",
    billingStatus: "pending",
  })
})

test("não oferece ações de parcela sem a permissão de editar contratos", async ({ page }) => {
  await installAuthenticatedSession(page, contractViewer)
  await installApiMock(page, contractViewer)

  const contractState = {
    ...contractFixture,
    installmentsCount: 1,
    installments: [{
      id: "e2e-0001-inst-1",
      number: 1,
      value: 866.66,
      dueDate: "2026-07-22T03:00:00.000Z",
      status: "pending" as const,
      paymentMethod: "",
      notes: "",
      createdAt: "2026-07-01T12:00:00.000Z",
    }],
  }

  await page.route("**/api/v1/contracts**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/contracts") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [contractState] }),
      })
      return
    }

    if (request.method() === "GET" && pathname === `/api/v1/contracts/${contractFixture.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: contractState }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=parcelas`)
  await expect(page.getByRole("row").filter({ hasText: "1/1" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Ações" })).toHaveCount(0)

  await page.goto(`/contratos/${contractFixture.id}?tab=parcelas`)
  await expect(page.getByRole("row").filter({ hasText: "1/1" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Ações" })).toHaveCount(0)
})
