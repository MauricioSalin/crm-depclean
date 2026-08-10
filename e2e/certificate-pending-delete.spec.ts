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
