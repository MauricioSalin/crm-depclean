import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const pendingCertificate = {
  id: "certificate-pending-delete",
  scheduleId: "schedule-pending-delete",
  clientId: "client-pending-delete",
  clientName: "CONDOMÍNIO PENDENTE E2E",
  unitId: "unit-pending-delete",
  unitName: "Matriz",
  serviceTypeId: "service-pending-delete",
  serviceTypeName: "Dedetização",
  teams: [],
  additionalEmployees: [{ id: "employee-pending-delete", name: "Responsável E2E" }],
  date: "2026-08-04",
  time: "10:53",
  status: "pending" as const,
  naFileName: "na-visita.pdf",
  naFileNames: ["na-visita.pdf"],
  naCount: 1,
  createdAt: "2026-08-04T13:53:00.000Z",
  updatedAt: "2026-08-04T13:53:00.000Z",
}

test("resume os anexos pela quantidade sem exibir o nome do arquivo", async ({ page }) => {
  const multipleAttachmentsCertificate = {
    ...pendingCertificate,
    id: "certificate-multiple-attachments",
    scheduleId: "schedule-multiple-attachments",
    clientName: "CONDOMÍNIO MÚLTIPLOS ANEXOS E2E",
    naFileName: "primeiro-anexo.pdf",
    naFileNames: Array.from({ length: 13 }, (_, index) => `anexo-${index + 1}.pdf`),
    naCount: 13,
  }

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/certificates**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [pendingCertificate, multipleAttachmentsCertificate] }),
    })
  })

  await page.goto("/certificados")

  const expectAttachmentSummaries = async () => {
    await expect(page.getByText("1 anexo", { exact: true })).toBeVisible()
    await expect(page.getByText("13 anexos", { exact: true })).toBeVisible()
    await expect(page.getByText(pendingCertificate.naFileName, { exact: true })).toHaveCount(0)
    await expect(page.getByText(multipleAttachmentsCertificate.naFileName, { exact: true })).toHaveCount(0)
    await expect(page.getByText(/NAs anexadas/i)).toHaveCount(0)
  }

  await expectAttachmentSummaries()
  await page.getByRole("tab", { name: "Visualizar certificados em cartões" }).click()
  await expectAttachmentSummaries()
})

test("alinha à esquerda o cabeçalho da criação de certificado no mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/certificates**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  await page.goto("/certificados")
  await page.getByRole("button", { name: "Criar novo", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Criar certificado avulso" })
  await expect(dialog).toBeVisible()
  await expect.poll(() => dialog.locator('[data-slot="dialog-header"]').evaluate((header) => (
    getComputedStyle(header).textAlign
  ))).toBe("left")
})

test("permite excluir uma solicitação pendente sem remover o botão Emitir", async ({ page }) => {
  let records = [pendingCertificate]
  let deletedUrl = ""

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/certificates**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() === "DELETE") {
      deletedUrl = url.toString()
      records = []
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: null }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: records }),
    })
  })

  await page.goto("/certificados")

  const row = page.getByRole("row").filter({ hasText: pendingCertificate.clientName })
  await expect(row.getByRole("link", { name: "Emitir certificado" })).toBeVisible()
  await row.getByRole("button", { name: "Ações do certificado" }).click()
  await expect(row.getByRole("link", { name: "Emitir certificado" })).toBeVisible()
  await page.getByRole("menuitem", { name: "Excluir" }).click()

  const dialog = page.getByRole("dialog", { name: "Excluir solicitação de certificado" })
  await expect(dialog).toContainText("O agendamento e seus anexos serão mantidos.")
  await dialog.getByRole("button", { name: "Excluir", exact: true }).click()

  await expect(page.getByText("Nenhum certificado encontrado.", { exact: true })).toBeVisible()
  expect(new URL(deletedUrl).searchParams.get("serviceTypeId")).toBe(pendingCertificate.serviceTypeId)
})
