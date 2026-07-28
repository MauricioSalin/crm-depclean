import { expect, test, type Page } from "@playwright/test"

import { contractFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const FIXED_NOW = new Date("2026-07-28T12:00:00.000Z")

async function installContractMock(
  page: Page,
  overrides: Record<string, unknown>,
) {
  const contract = {
    ...contractFixture,
    ...overrides,
  }

  await page.route("**/api/v1/contracts**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (path !== "/contracts" && path !== `/contracts/${contract.id}`) {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Contrato de teste carregado.",
        data: path === "/contracts" ? [contract] : contract,
        meta: { version: "e2e", timestamp: FIXED_NOW.toISOString() },
      }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("exibe Renovar a partir de um mês antes do fim da vigência", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    startDate: "2025-08-28",
    endDate: "2026-08-28",
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  const renewLink = page.getByRole("link", { name: "Renovar", exact: true })
  await expect(renewLink).toBeVisible()
  await expect(renewLink).toHaveAttribute("href", /\/contratos\/novo\?renewFrom=contract-e2e/)
})

test("não exibe Renovar antes da janela de um mês", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    startDate: "2025-08-28",
    endDate: "2026-08-29",
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  await expect(page.getByRole("link", { name: "Renovar", exact: true })).toHaveCount(0)
})

test("mantém Renovar disponível após o vencimento", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    startDate: "2025-08-28",
    endDate: "2026-07-27",
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  await expect(page.getByRole("link", { name: "Renovar", exact: true })).toBeVisible()
})

test("abre o documento correto no ClickSign em vez do envelope", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    clicksign: {
      envelopeId: "a57ca141-7165-4b7d-a136-01d7ea00eb23",
      documentKey: "cd01f2bf-7030-446f-9c02-b3c96c80245d",
      documentId: "cd01f2bf-7030-446f-9c02-b3c96c80245d",
      folderId: "49449970",
      webhookId: "",
      status: "closed",
      signers: [],
    },
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  await expect(page.getByRole("link", { name: "ClickSign", exact: true })).toHaveAttribute(
    "href",
    "https://app.clicksign.com/accounts/379383/folders/49449970/documents/cd01f2bf-7030-446f-9c02-b3c96c80245d",
  )
})

test("mostra sucesso imediato no envio ClickSign e restaura a acao quando falha", async ({ page }) => {
  await installContractMock(page, {
    status: "draft",
    clicksign: undefined,
  })

  let markRequestStarted: (() => void) | undefined
  let releaseResponse: (() => void) | undefined
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve
  })
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })

  await page.route(`**/api/v1/clicksign/contracts/${contractFixture.id}/send`, async (route) => {
    markRequestStarted?.()
    await responseGate
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Falha de teste ao enviar para a ClickSign.",
        error: "Bad Gateway",
        statusCode: 502,
      }),
    })
  })

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Enviar ClickSign" }).click()
  await requestStarted

  await expect(page.getByText("O envio para assinatura no ClickSign foi iniciado em segundo plano.")).toBeVisible()

  releaseResponse?.()

  await expect(page.getByText("Falha de teste ao enviar para a ClickSign.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Enviar ClickSign" })).toBeEnabled()
})

test("mostra sucesso imediato ao enviar agendamentos e preserva o plano quando falha", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    signedAt: FIXED_NOW.toISOString(),
    automationCreateSchedules: true,
    automationSchedulePlanSavedAt: FIXED_NOW.toISOString(),
    automationSchedulePlanPublishedAt: undefined,
    clicksign: {
      envelopeId: "envelope-e2e",
      documentId: "document-e2e",
      documentKey: "document-e2e",
      status: "closed",
      signers: [],
    },
  })

  let markRequestStarted: (() => void) | undefined
  let releaseResponse: (() => void) | undefined
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve
  })
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })

  await page.route(`**/api/v1/contracts/${contractFixture.id}/schedule-plan/publish`, async (route) => {
    markRequestStarted?.()
    await responseGate
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Falha de teste ao publicar os agendamentos.",
        error: "Bad Gateway",
        statusCode: 502,
      }),
    })
  })

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Enviar agendamentos" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Enviar agendamentos" }).click()
  await requestStarted

  await expect(page.getByText("A publicação e os alertas estão sendo processados em segundo plano.")).toBeVisible()

  releaseResponse?.()

  await expect(page.getByText("Falha de teste ao publicar os agendamentos.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Enviar agendamentos" })).toBeEnabled()
})

test("exibe hífen sem ícone para equipe não definida no perfil do contrato", async ({ page }) => {
  await installContractMock(page, {
    services: contractFixture.services.map((service) => ({
      ...service,
      teamIds: [],
      additionalEmployeeIds: [],
    })),
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  const emptyAssignment = page.getByText("-", { exact: true }).first()
  await expect(emptyAssignment).toBeVisible()
  await expect(emptyAssignment.locator("xpath=ancestor::td[1]").locator("svg")).toHaveCount(0)
})
