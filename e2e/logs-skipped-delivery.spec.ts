import { expect, test } from "@playwright/test"
import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

function logFixture(deliveryStatus = "skipped_past_schedule", metadata: Record<string, unknown> = {}) {
  return {
    id: "log-whatsapp-historical", type: "whatsapp", typeLabel: "WhatsApp", status: "error",
    module: "whatsapp", moduleLabel: "WhatsApp", title: "Novo agendamento", description: "Mensagem de teste.",
    failureReason: "", method: "POST", path: "/integrations/whatsapp/messages", statusCode: 502, durationMs: 0,
    actorUserId: "", actorEmployeeId: "", actorName: "Sistema", actorEmail: "", clientId: "client-e2e",
    clientName: "Condomínio de teste", targetEmployeeId: "", targetEmployeeName: "", entityType: "notification",
    entityId: "historical", entityName: "Contato de teste", createdAt: "2026-11-12T20:11:38Z",
    metadata: {
      notificationId: "historical", recipientName: "Contato de teste", recipientPhone: "5551000000000",
      deliveryStatus, deliveryAttempts: 1, whatsappMessageId: "",
      message: "Limpeza de rede para Condomínio de teste em 22/10/2026 às 08:00.", ...metadata,
    },
  }
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`explica bloqueio legado sem falha falsa, HTTP Meta ou marca de envio - ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.route("**/api/v1/logs**", async (route) => route.fulfill({ json: {
      success: true, data: { items: [logFixture()], total: 1, page: 1, limit: 20, totalPages: 1 },
    } }))
    await page.goto("/logs")
    const row = page.getByRole("button", { name: /Novo agendamento/ })
    await expect(row.getByText("Não enviado", { exact: true })).toBeVisible()
    await row.click()
    const dialog = page.getByRole("dialog", { name: "Detalhes do log" })
    await expect(dialog.getByText("Mensagem não enviada", { exact: true })).toBeVisible()
    await expect(dialog.getByText("Envio bloqueado porque a data do agendamento já passou.", { exact: true })).toBeVisible()
    await expect(dialog.getByText("Motivo da falha", { exact: true })).toHaveCount(0)
    await expect(dialog.getByText("Motivo não registrado para este log.", { exact: true })).toHaveCount(0)
    await expect(dialog.getByText("Retorno HTTP do Meta").locator("..")).toContainText("Não acionada")
    await expect(dialog.getByText("502", { exact: true })).toHaveCount(0)
    await expect(dialog.getByText("Processamentos da fila", { exact: true })).toBeVisible()
    await expect(dialog.getByText("Prévia da mensagem", { exact: true })).toBeVisible()
    await expect(dialog.locator('[aria-label^="Mensagem enviada"], [aria-label^="Mensagem entregue"], [aria-label^="Mensagem lida"]')).toHaveCount(0)
    await page.screenshot({ path: `${process.env.LOGS_EVIDENCE_DIR ?? "test-results/logs"}/bloqueio-${viewport.width}.png` })
  })
}

test("preserva falha real, resposta Meta e confirma entrega somente com status correspondente", async ({ page }) => {
  let item = logFixture("failed", { deliveryError: "Parâmetro recusado pela Meta.", providerStatusCode: 400 })
  await page.route("**/api/v1/logs**", async (route) => route.fulfill({ json: {
    success: true, data: { items: [item], total: 1, page: 1, limit: 20, totalPages: 1 },
  } }))
  await page.goto("/logs")
  await page.getByRole("button", { name: /Novo agendamento/ }).click()
  let dialog = page.getByRole("dialog", { name: "Detalhes do log" })
  await expect(dialog.getByText("Motivo da falha", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Parâmetro recusado pela Meta.", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Retorno HTTP do Meta").locator("..")).toContainText("400")
  await expect(dialog.locator('[aria-label^="Mensagem enviada"]')).toHaveCount(0)

  item = { ...logFixture("delivered", {
    whatsappMessageId: "wamid.test", messageMetadata: { whatsappMessages: [{ providerStatusCode: 200 }] },
  }), status: "success" }
  await page.goto("/logs")
  await page.getByRole("button", { name: /Novo agendamento/ }).click()
  dialog = page.getByRole("dialog", { name: "Detalhes do log" })
  await expect(dialog.getByText("Retorno HTTP do Meta").locator("..")).toContainText("200")
  await expect(dialog.locator('[aria-label="Mensagem entregue"]')).toBeVisible()
})

test("filtro inclui Não enviado e solicita o status correto", async ({ page }) => {
  let requestedStatus = ""
  await page.route("**/api/v1/logs**", async (route) => {
    requestedStatus = new URL(route.request().url()).searchParams.get("status") ?? ""
    await route.fulfill({ json: { success: true, data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } } })
  })
  await page.goto("/logs")
  await page.locator("label").filter({ hasText: /^Status$/ }).locator("..").getByRole("combobox").click()
  await page.getByRole("option", { name: "Não enviado", exact: true }).click()
  await expect.poll(() => requestedStatus).toBe("skipped")
})
