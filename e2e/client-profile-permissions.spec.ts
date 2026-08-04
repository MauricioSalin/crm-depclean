import { expect, test } from "@playwright/test"

import {
  clientFixture,
  clientServiceFixture,
  clientTypeFixture,
  contractFixture,
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

const contractViewerUser = {
  ...E2E_USER,
  id: "user-e2e-contract-viewer",
  name: "Consulta de Contratos E2E",
  permissionProfileId: "profile-e2e-contract-viewer",
  permissionProfileName: "Consulta de contratos",
  permissions: ["clients_view", "contracts_view"],
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

test("exibe as durações e cláusulas salvas nos perfis", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.goto(`/clientes/${clientFixture.id}?tab=servicos`)
  await expect(page.getByRole("columnheader", { name: "Ordenar por Duração", exact: true })).toBeVisible()
  await expect(
    page.getByRole("row").filter({ hasText: serviceFixture.name }).getByText("120 minutos", { exact: true }),
  ).toBeVisible()

  await page.getByRole("tab", { name: "Agenda (1)", exact: true }).click()
  await expect(page.getByRole("columnheader", { name: "Ordenar por Duração", exact: true })).toBeVisible()
  await expect(
    page.getByRole("row").filter({ hasText: serviceFixture.name }).getByText("120 minutos", { exact: true }),
  ).toBeVisible()

  await page.goto(`/contratos/${contractFixture.id}?tab=agenda`)
  await expect(page.getByRole("columnheader", { name: "Ordenar por Duração", exact: true })).toBeVisible()
  await expect(
    page.getByRole("row").filter({ hasText: serviceFixture.name }).getByText("120 minutos", { exact: true }),
  ).toBeVisible()

  await page.route(`**/api/v1/contracts/${contractFixture.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: {
          ...contractFixture,
          services: contractFixture.services.map((service) => ({
            ...service,
            duration: 3,
            durationType: "hours",
            clauses: ["Cláusula exclusiva salva no contrato."],
          })),
        },
      }),
    })
  })

  await page.goto(`/contratos/${contractFixture.id}?tab=servicos`)
  await expect(page.getByRole("columnheader", { name: "Descrição", exact: true })).toHaveCount(0)
  const contractServiceRow = page.getByRole("row").filter({ hasText: serviceFixture.name })
  await expect(contractServiceRow.getByText("3 horas", { exact: true })).toBeVisible()
  await expect(contractServiceRow.getByText("120 minutos", { exact: true })).toHaveCount(0)

  await contractServiceRow.click()
  await expect(page.getByRole("dialog").getByText("Cláusula exclusiva salva no contrato.", { exact: true })).toBeVisible()
  await expect(page.getByRole("dialog").getByText(serviceFixture.clauses[0], { exact: true })).toHaveCount(0)
})

test("permite marcar como renovado no perfil do cliente com a permissão adequada", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  let markRenewedRequests = 0
  let contractState = {
    ...contractFixture,
    status: "closed",
    renewalStatus: undefined as "renewed" | undefined,
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

    if (request.method() === "PATCH" && pathname === `/api/v1/contracts/${contractFixture.id}/mark-renewed`) {
      markRenewedRequests += 1
      contractState = { ...contractState, renewalStatus: "renewed" }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          success: true,
          message: "Contrato marcado como renovado.",
          data: contractState,
        }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=contratos`)
  const contractRow = page.getByRole("row").filter({ hasText: contractFixture.contractNumber })
  await contractRow.getByRole("button", { name: /Abrir ações do contrato/ }).click()
  await page.getByRole("menuitem", { name: "Marcar como renovado" }).click()

  const confirmation = page.getByRole("dialog", { name: "Marcar contrato como renovado?" })
  await expect(confirmation).toContainText("deixará de receber alertas de vencimento")
  await confirmation.getByRole("button", { name: "Marcar como renovado" }).click()

  await expect.poll(() => markRenewedRequests).toBe(1)
  await expect(contractRow.getByText("Renovado", { exact: true })).toBeVisible()
  await contractRow.getByRole("button", { name: /Abrir ações do contrato/ }).click()
  await expect(page.getByRole("menuitem", { name: "Marcar como renovado" })).toHaveCount(0)
})

test("oculta marcar como renovado no perfil do cliente sem a permissão adequada", async ({ page }) => {
  await installAuthenticatedSession(page, contractViewerUser)
  await installApiMock(page, contractViewerUser)
  await page.route("**/api/v1/contracts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [{ ...contractFixture, status: "closed" }] }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=contratos`)
  const contractRow = page.getByRole("row").filter({ hasText: contractFixture.contractNumber })
  await contractRow.getByRole("button", { name: /Abrir ações do contrato/ }).click()

  await expect(page.getByRole("menuitem", { name: "Ver Detalhes" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Marcar como renovado" })).toHaveCount(0)
})

test("persiste o pagamento da parcela e sincroniza cliente, contrato e inadimplência", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  const installmentId = "e2e-0001-inst-1"
  let clientState = { ...clientFixture, isDelinquent: true }
  let contractState = {
    ...contractFixture,
    isClientDelinquent: true,
    installmentsCount: 1,
    installments: [{
      id: installmentId,
      number: 1,
      value: 4_200,
      dueDate: "2026-07-01T03:00:00.000Z",
      paidDate: undefined as string | undefined,
      paidValue: undefined as number | undefined,
      status: "overdue" as "pending" | "paid" | "late" | "overdue" | "cancelled",
      paymentMethod: "",
      notes: "",
      createdAt: "2026-07-01T12:00:00.000Z",
    }],
  }
  let installmentPatch: Record<string, unknown> | null = null
  let contractDetailReads = 0

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
      contractDetailReads += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: contractState }),
      })
      return
    }

    if (
      request.method() === "PATCH" &&
      pathname === `/api/v1/contracts/${contractFixture.id}/installments/${installmentId}`
    ) {
      const patch = request.postDataJSON() as Record<string, unknown>
      installmentPatch = patch
      contractState = {
        ...contractState,
        isClientDelinquent: false,
        installments: contractState.installments.map((installment) => ({
          ...installment,
          status: "paid" as const,
          paidDate: String(patch.paidDate),
          paidValue: Number(patch.paidValue),
        })),
      }
      clientState = { ...clientState, isDelinquent: false }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: contractState }),
      })
      return
    }

    await route.fallback()
  })

  await page.route(`**/api/v1/clients/${clientFixture.id}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: clientState }),
    })
  })

  await page.goto(`/contratos/${contractFixture.id}?tab=parcelas`)
  await expect(page.getByText("Vencida", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: clientFixture.companyName }).click()
  await expect(page).toHaveURL(new RegExp(`/clientes/${clientFixture.id}`))
  await expect(page.getByRole("heading", { name: "Perfil do Cliente" })).toBeVisible()

  const clientInstallmentsTab = page.getByRole("tab", { name: /Parcelas/ })
  await clientInstallmentsTab.click()
  await expect(clientInstallmentsTab).toHaveAttribute("data-state", "active")
  await expect(page.getByText("Inadimplente", { exact: true })).toBeVisible()
  const clientInstallmentRow = page.getByRole("row").filter({ hasText: "1/1" })
  await clientInstallmentRow.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Marcar como paga" }).click()

  await expect.poll(() => installmentPatch).toMatchObject({
    status: "paid",
    paidDate: expect.any(String),
  })
  expect(installmentPatch).not.toHaveProperty("paidValue")
  expect(installmentPatch).not.toHaveProperty("value")
  expect(installmentPatch).not.toHaveProperty("dueDate")
  await expect(clientInstallmentRow.getByText("Paga", { exact: true })).toBeVisible()
  await expect(page.getByText("Inadimplente", { exact: true })).toHaveCount(0)

  const clientContractsTab = page.getByRole("tab", { name: /Contratos/ })
  await clientContractsTab.click()
  await expect(clientContractsTab).toHaveAttribute("data-state", "active")
  await page.getByRole("link", { name: /E2E-0001/ }).first().click()
  await expect(page).toHaveURL(new RegExp(`/contratos/${contractFixture.id}`))
  const contractInstallmentsTab = page.getByRole("tab", { name: /Parcelas/ })
  await contractInstallmentsTab.click()
  await expect(contractInstallmentsTab).toHaveAttribute("data-state", "active")

  await expect.poll(() => contractDetailReads).toBeGreaterThanOrEqual(2)
  await expect(page.getByText("Paga", { exact: true })).toBeVisible()
  await expect(page.getByText("Inadimplente", { exact: true })).toHaveCount(0)
})

test("mantém a parcela inalterada quando a atualização falha", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  const installmentId = "e2e-0001-inst-1"
  const overdueContract = {
    ...contractFixture,
    installmentsCount: 1,
    installments: [{
      id: installmentId,
      number: 1,
      value: 4_200,
      dueDate: "2026-07-01T03:00:00.000Z",
      status: "overdue" as const,
      paymentMethod: "",
      notes: "",
      createdAt: "2026-07-01T12:00:00.000Z",
    }],
  }
  let patchAttempts = 0

  await page.route("**/api/v1/contracts**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/contracts") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [overdueContract] }),
      })
      return
    }

    if (
      request.method() === "PATCH" &&
      pathname === `/api/v1/contracts/${contractFixture.id}/installments/${installmentId}`
    ) {
      patchAttempts += 1
      await route.fulfill({
        status: 500,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ message: "Falha simulada ao salvar a parcela." }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=parcelas`)
  const installmentRow = page.getByRole("row").filter({ hasText: "1/1" })
  await expect(installmentRow.getByText("Vencida", { exact: true })).toBeVisible()
  await installmentRow.getByRole("button").click()
  await page.getByRole("menuitem", { name: "Marcar como paga" }).click()

  await expect.poll(() => patchAttempts).toBe(1)
  await expect(page.getByText("Falha simulada ao salvar a parcela.", { exact: true })).toBeVisible()
  await expect(installmentRow.getByText("Vencida", { exact: true })).toBeVisible()
  await expect(installmentRow.getByText("Paga", { exact: true })).toHaveCount(0)
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
  await expect(page.getByText("Contratos vigentes")).toHaveCount(0)
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
