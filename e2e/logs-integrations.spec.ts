import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("exibe historico de WhatsApp e ClickSign com estados operacionais", async ({ page }) => {
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
              status: "pending",
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
                deliveryStatus: "queued",
              },
              createdAt: "2026-07-28T18:00:00.000Z",
            },
            {
              id: "log-clicksign-webhook-1",
              type: "receive",
              typeLabel: "Recebimento",
              status: "success",
              module: "clicksign",
              moduleLabel: "ClickSign",
              title: "Webhook ClickSign: sign",
              description: "Evento recebido da ClickSign com estado processed.",
              failureReason: "",
              method: "POST",
              path: "/integrations/clicksign/webhooks",
              statusCode: 200,
              durationMs: 0,
              actorUserId: "",
              actorEmployeeId: "",
              actorName: "ClickSign",
              actorEmail: "",
              clientId: "client-e2e",
              clientName: "Condomínio E2E",
              targetEmployeeId: "",
              targetEmployeeName: "",
              entityType: "contract",
              entityId: "contract-e2e",
              entityName: "contract-e2e",
              metadata: { eventName: "sign", processingStatus: "processed" },
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
  await expect(page.getByText("Webhook ClickSign: sign").first()).toBeVisible()
  await expect(page.getByText("Pendente", { exact: true }).first()).toBeVisible()

  await page.getByText("Assinatura pendente").first().click()
  await expect(page.getByText(/Seu contrato está pronto para assinatura/)).toBeVisible()
})
