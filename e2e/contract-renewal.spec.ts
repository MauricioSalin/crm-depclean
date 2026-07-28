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
