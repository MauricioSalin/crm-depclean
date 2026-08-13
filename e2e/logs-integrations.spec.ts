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
              type: "whatsapp",
              typeLabel: "WhatsApp",
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
                  }, {
                    id: "wamid.document-1",
                    type: "document",
                    status: "delivered",
                    fileName: "informativo.pdf",
                    includedInTemplate: false,
                    providerStatusCode: 200,
                    providerResponse: { messages: [{ id: "wamid.document-1" }] },
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
  const whatsappRow = page.getByRole("button", { name: /Assinatura pendente/ })
  await expect(whatsappRow.getByText("WhatsApp", { exact: true })).toHaveClass(/bg-green-100/)

  const typeFilter = page.locator("label").filter({ hasText: /^Tipo$/ }).locator("..").getByRole("combobox")
  await typeFilter.click()
  await expect(page.getByRole("option", { name: "WhatsApp", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByText("Assinatura pendente").first().click()
  await expect(page.getByText("Seu contrato está pronto para assinatura.", { exact: true })).toBeVisible()
  await expect(page.getByText("5551999999999", { exact: true })).toBeVisible()
  await expect(page.getByText("wamid.message-1", { exact: true })).toBeVisible()
  await expect(page.getByText("delivered", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("informativo.pdf", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Entregue", { exact: true }).last()).toBeVisible()
  const providerResponse = page.getByText("Retorno do WhatsApp", { exact: true }).locator("..")
  await expect(providerResponse).toContainText("recipientId")

  const viewAttachment = page.getByRole("link", { name: "Visualizar informativo.pdf" })
  await expect(viewAttachment).toHaveAttribute("href", /\/api\/v1\/files\/whatsapp\/informativo\.pdf$/)
  await page.getByRole("button", { name: "Baixar informativo.pdf" }).click()
  await expect.poll(() => attachmentDownloads).toBe(1)
  await expect(page.getByText("Anexo baixado.", { exact: true })).toBeVisible()
})

test("simula o template exato e informa quando a mensagem não possui anexos", async ({ page }) => {
  await page.route("**/api/v1/logs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [{
            id: "log-whatsapp-account-access",
            type: "whatsapp",
            typeLabel: "WhatsApp",
            status: "success",
            module: "whatsapp",
            moduleLabel: "WhatsApp",
            title: "Mensagem enviada pelo WhatsApp",
            description: "Mensagem de template para Vitor Costa da Silva.",
            failureReason: "",
            method: "POST",
            path: "/integrations/whatsapp/messages",
            statusCode: 200,
            durationMs: 0,
            actorUserId: "",
            actorEmployeeId: "",
            actorName: "Sistema",
            actorEmail: "",
            clientId: "",
            clientName: "",
            targetEmployeeId: "",
            targetEmployeeName: "",
            entityType: "whatsapp_message",
            entityId: "wamid.account-access",
            entityName: "Vitor Costa da Silva",
            metadata: {
              messageType: "template",
              body: "",
              templateName: "depclean_cadastro_pronto_v2",
              recipientName: "Vitor Costa da Silva",
              recipientPhone: "5551998734023",
              deliveryStatus: "sent",
              messageId: "wamid.account-access",
              includedDocument: false,
              providerStatusCode: 200,
              providerResponse: {
                messages: [{ id: "wamid.account-access" }],
              },
            },
            createdAt: "2026-07-28T20:53:09.180Z",
          }],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      }),
    })
  })

  await page.goto("/logs")
  await page.getByText("Mensagem enviada pelo WhatsApp", { exact: true }).first().click()

  const dialog = page.getByRole("dialog", { name: "Detalhes do log" })
  await expect(dialog.getByText("Envio pelo WhatsApp", { exact: true })).toHaveCount(0)
  await expect(dialog.getByText("Cadastro Depclean", { exact: true })).toBeVisible()
  await expect(dialog).toContainText("Olá, Vitor Costa da Silva.")
  await expect(dialog.getByText("Abrir plataforma", { exact: true })).toBeVisible()
  await expect(dialog.getByText("depclean_cadastro_pronto_v2", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Nenhum anexo foi enviado nesta mensagem.", { exact: true })).toBeVisible()
})

test("mostra o e-mail de agendamentos exatamente como enviado e permite acessar os anexos", async ({ page }) => {
  let attachmentDownloads = 0
  await page.route("**/api/v1/files/clients/client-e2e/schedule-plans/contract-e2e/cronograma.pdf", async (route) => {
    attachmentDownloads += 1
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.4 cronograma de teste"),
    })
  })
  await page.route("**/api/v1/logs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [{
            id: "log-schedule-email-1",
            type: "send",
            typeLabel: "Envio",
            status: "success",
            module: "schedules",
            moduleLabel: "Agendamentos",
            title: "E-mail de agendamentos enviado",
            description: "Cronograma enviado por e-mail para Síndica E2E (sindica@depclean.test).",
            failureReason: "",
            method: "POST",
            path: "/integrations/resend/emails",
            statusCode: 202,
            durationMs: 180,
            actorUserId: "",
            actorEmployeeId: "",
            actorName: "Sistema",
            actorEmail: "",
            clientId: "client-e2e",
            clientName: "Condomínio E2E",
            targetEmployeeId: "",
            targetEmployeeName: "",
            entityType: "schedule_plan_email",
            entityId: "contract-e2e:syndic",
            entityName: "Síndica E2E",
            metadata: {
              channel: "email",
              provider: "resend",
              providerMessageId: "resend-email-e2e",
              deliveryStatus: "accepted",
              senderEmail: "Depclean <atendimento@depclean.test>",
              recipientName: "Síndica E2E",
              recipientEmail: "sindica@depclean.test",
              recipientRole: "síndica",
              subject: "Depclean | Cronograma de atendimentos - DEP-E2E-0001",
              html: "<!doctype html><html><body><h1>Cronograma de atendimentos</h1><p>Olá, Síndica E2E.</p><strong>Limpeza de reservatórios</strong></body></html>",
              text: "Olá, Síndica E2E. Cronograma de atendimentos.",
              contractNumber: "DEP-E2E-0001",
              attachments: [{
                fileName: "cronograma-dep-e2e-0001.pdf",
                mimeType: "application/pdf",
                fileSize: 2048,
                documentUrl: "/api/v1/files/clients/client-e2e/schedule-plans/contract-e2e/cronograma.pdf",
              }],
            },
            createdAt: "2026-08-12T12:00:00.000Z",
          }],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      }),
    })
  })

  await page.goto("/logs?type=send")
  const row = page.getByRole("button", { name: /E-mail de agendamentos enviado/ })
  await expect(row.getByText("Envio", { exact: true })).toBeVisible()
  await row.click()

  const dialog = page.getByRole("dialog", { name: "Detalhes do log" })
  await expect(dialog).toContainText("sindica@depclean.test")
  await expect(dialog).toContainText("Depclean | Cronograma de atendimentos - DEP-E2E-0001")
  await expect(dialog.getByText("cronograma-dep-e2e-0001.pdf", { exact: true })).toBeVisible()
  await expect(dialog.getByText("application/pdf · 2.0 KB", { exact: true })).toBeVisible()

  const emailPreview = dialog.frameLocator('iframe[title="Prévia do e-mail enviado"]')
  await expect(emailPreview.getByRole("heading", { name: "Cronograma de atendimentos" })).toBeVisible()
  await expect(emailPreview.getByText("Olá, Síndica E2E.", { exact: true })).toBeVisible()
  await expect(emailPreview.getByText("Limpeza de reservatórios", { exact: true })).toBeVisible()

  const viewAttachment = dialog.getByRole("link", { name: "Visualizar cronograma-dep-e2e-0001.pdf" })
  await expect(viewAttachment).toHaveAttribute("href", /schedule-plans\/contract-e2e\/cronograma\.pdf$/)
  await dialog.getByRole("button", { name: "Baixar cronograma-dep-e2e-0001.pdf" }).click()
  await expect.poll(() => attachmentDownloads).toBe(1)
  await expect(page.getByText("Anexo baixado.", { exact: true })).toBeVisible()
})
