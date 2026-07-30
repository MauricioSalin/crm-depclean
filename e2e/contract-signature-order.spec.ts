import { expect, test } from "@playwright/test"

import { contractFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("exibe os novos contratos na ordem testemunha, cliente e assinante", async ({ page }) => {
  await page.route("**/api/v1/contracts/contract-e2e", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        message: "Contrato carregado.",
        data: {
          ...contractFixture,
          clicksign: {
            envelopeId: "envelope-new-flow",
            documentKey: "document-new-flow",
            documentId: "document-new-flow",
            webhookId: "webhook-1",
            status: "running",
            signatureFlow: "witness_client_internal",
            signers: [
              {
                signerId: "witness-1",
                requestId: "request-witness-1",
                name: "Testemunha Teste",
                email: "testemunha@example.com",
                role: "Testemunha",
                status: "pending",
                signUrl: "https://app.clicksign.com/notarial/widget/signatures/witness-1/redirect",
              },
              {
                signerId: "client-1",
                requestId: "request-client-1",
                name: "Cliente Teste",
                email: "cliente@example.com",
                role: "Proprietário",
                status: "pending",
                signUrl: "https://app.clicksign.com/notarial/widget/signatures/client-1/redirect",
              },
              {
                signerId: "internal-1",
                requestId: "request-internal-1",
                name: "Assinante Depclean",
                email: "assinante@example.com",
                role: "Depclean",
                status: "pending",
                signUrl: "https://app.clicksign.com/notarial/widget/signatures/internal-1/redirect",
              },
            ],
          },
        },
        meta: { version: "e2e", timestamp: new Date().toISOString() },
      }),
    })
  })

  await page.goto("/contratos/contract-e2e")

  const clicksignCard = page.getByRole("heading", { name: "ClickSign" }).locator("..").locator("..")
  const signerRows = clicksignCard.getByRole("row")

  await expect(signerRows.nth(1)).toContainText("Testemunha Teste")
  await expect(signerRows.nth(1)).toContainText("Pendente")
  await expect(signerRows.nth(2)).toContainText("Cliente Teste")
  await expect(signerRows.nth(2)).toContainText("Aguardando testemunha")
  await expect(signerRows.nth(3)).toContainText("Assinante Depclean")
  await expect(signerRows.nth(3)).toContainText("Aguardando cliente")
})
