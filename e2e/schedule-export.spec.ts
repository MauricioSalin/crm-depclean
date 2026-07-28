import { expect, test, type Page } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const FIXED_NOW = new Date("2026-07-28T12:00:00.000Z")

async function installScheduleExportMock(page: Page) {
  const exportRequests: URL[] = []

  await page.route("**/api/v1/schedules/export**", async (route) => {
    exportRequests.push(new URL(route.request().url()))
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="agendamentos-filtrados-2026-07-28.xlsx"',
      },
      body: "planilha-e2e",
    })
  })

  return exportRequests
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("exporta somente após confirmação e envia os filtros aplicados", async ({ page }) => {
  const exportRequests = await installScheduleExportMock(page)

  await page.goto("/agendamentos?q=UBIRATAN")
  await page.getByRole("combobox", { name: "Status" }).click()
  await page.getByRole("option", { name: /Agendado/ }).click()

  await page.getByRole("button", { name: "Exportar", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Exportar agendamentos" })
  await expect(dialog).toContainText(
    "O resultado será gerado de acordo com os filtros aplicados na página.",
  )
  expect(exportRequests).toHaveLength(0)

  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(exportRequests).toHaveLength(0)

  await page.getByRole("button", { name: "Exportar", exact: true }).click()
  const downloadPromise = page.waitForEvent("download")
  await page
    .getByRole("dialog", { name: "Exportar agendamentos" })
    .getByRole("button", { name: "Exportar", exact: true })
    .click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe("agendamentos-filtrados-2026-07-28.xlsx")
  expect(exportRequests).toHaveLength(1)
  expect(exportRequests[0].searchParams.get("search")).toBe("UBIRATAN")
  expect(exportRequests[0].searchParams.get("status")).toBe("scheduled")
  expect(exportRequests[0].searchParams.has("page")).toBe(false)
  expect(exportRequests[0].searchParams.has("limit")).toBe(false)
})
