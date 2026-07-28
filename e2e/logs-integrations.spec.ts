import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("exibe detalhes e anexo do WhatsApp junto ao envio de contrato da ClickSign", async ({ page }) => {
  let attachmentDownloads = 0
  await page.route("**/api/v1/files/whatsapp/informativo.pdf", async (route) => {
    attachmentDownloads += 1
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.4 arquivo de teste"),
    })
  })
  await page.route("**/api/v1/logs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              id: "log-whatsapp-notif-1",
              type: "send",
              typeLabel: "Envio",
              status: "success",
              module: "whatsapp",
              moduleLabel: "WhatsApp",
              title: "Assinatura pendente",
              description: "Mensagem para Cliente E2E.",
              failureReason: "",
              method: "POST",
              path: "/integrations/whatsapp/messages",
              statusCode: 202,
              durationMs: 0,
              actorUserId: "",
              actorEmployeeId: "",
              actorName: "Sistema",
              actorEmail: "",
              clientId: "client-e2e",
              clientName: "Condomínio E2E",
              targetEmployeeId: "",
              targetEmployeeName: "",
              entityType: "notification",
              entityId: "notif-1",
              entityName: "Cliente E2E",
              metadata: {
                message: "Seu contrato está pronto para assinatura.",
                recipientName: "Cliente E2E",
                recipientPhone: "5551999999999",
                deliveryStatus: "delivered",
                deliveryAttempts: 1,
                whatsappMessageId: "wamid.message-1",
                messageMetadata: {
                  documentUrl: "/api/v1/files/whatsapp/informativo.pdf",
                  documentFileName: "informativo.pdf",
                  documentMimeType: "application/pdf",
                  whatsappMessages: [{
                    id: "wamid.message-1",
                    type: "template",
                    status: "delivered",
                    providerStatusCode: 200,
                    providerResponse: { messages: [{ id: "wamid.message-1" }] },
                  }],
                  whatsappWebhook: {
                    status: "delivered",
                    recipientId: "5551999999999",
                  },
                },
              },
              createdAt: "2026-07-28T18:00:00.000Z",
            },
            {
              id: "log-clicksign-send-1",
              type: "send",
              typeLabel: "Envio",
              status: "success",
              module: "clicksign",
              moduleLabel: "ClickSign",
              title: "Envio em ClickSign",
              description: "Administrador E2E realizou envio de assinatura DEP-E2E-0001 com sucesso.",
              failureReason: "",
              method: "POST",
              path: "/api/v1/clicksign/contracts/contract-e2e/send",
              statusCode: 200,
              durationMs: 180,
              actorUserId: "user-e2e-admin",
              actorEmployeeId: "employee-e2e",
              actorName: "Administrador E2E",
              actorEmail: "e2e@depclean.test",
              clientId: "client-e2e",
              clientName: "Condomínio E2E",
              targetEmployeeId: "",
              targetEmployeeName: "",
              entityType: "contract",
              entityId: "contract-e2e",
              entityName: "DEP-E2E-0001",
              metadata: {},
              createdAt: "2026-07-28T18:01:00.000Z",
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      }),
    })
  })

  await page.goto("/logs")

  await expect(page.getByText("Assinatura pendente").first()).toBeVisible()
  await expect(page.getByText("Envio em ClickSign").first()).toBeVisible()
  await expect(page.getByText("Sucesso", { exact: true }).first()).toBeVisible()

  await page.getByText("Assinatura pendente").first().click()
  await expect(page.getByText("Seu contrato está pronto para assinatura.", { exact: true })).toBeVisible()
  await expect(page.getByText("5551999999999", { exact: true })).toBeVisible()
  await expect(page.getByText("wamid.message-1", { exact: true })).toBeVisible()
  await expect(page.getByText("delivered", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("informativo.pdf", { exact: true })).toBeVisible()
  const providerResponse = page.getByText("Retorno do WhatsApp", { exact: true }).locator("..")
  await expect(providerResponse).toContainText("recipientId")

  const viewAttachment = page.getByRole("link", { name: "Visualizar informativo.pdf" })
  await expect(viewAttachment).toHaveAttribute("href", /\/api\/v1\/files\/whatsapp\/informativo\.pdf$/)
  await page.getByRole("button", { name: "Baixar informativo.pdf" }).click()
  await expect.poll(() => attachmentDownloads).toBe(1)
  await expect(page.getByText("Anexo baixado.", { exact: true })).toBeVisible()
})
