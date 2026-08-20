import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

function todayKey() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-")
}

test("editor cancela atendimento em andamento pelo rodapé responsivo", async ({ page }) => {
  const date = todayKey()
  let cancellationRequestCount = 0
  let schedule = {
    ...scheduleFixture,
    id: "schedule-cancel-in-progress",
    date,
    status: "in_progress" as "in_progress" | "rescheduled",
    canAttachNa: true,
  }
  const editor = {
    ...E2E_USER,
    id: "user-schedule-cancel-editor",
    permissions: ["agenda_view", "agenda_manage"],
  }

  await installAuthenticatedSession(page, editor)
  await installApiMock(page, editor)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [schedule] }),
      })
      return
    }

    if (request.method() === "PATCH" && pathname === `/api/v1/schedules/${schedule.id}/cancel-attendance`) {
      cancellationRequestCount += 1
      expect(request.postData()).toBeNull()
      schedule = {
        ...schedule,
        status: "rescheduled",
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: schedule }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/agenda?date=${date}`)
  await page.getByRole("button", { name: new RegExp(schedule.clientName) }).click()
  await expect(page.getByRole("heading", { name: "Anexos do atendimento", exact: true })).toBeVisible()

  const cancelButton = page.getByRole("button", { name: "Cancelar atendimento", exact: true })
  await expect(cancelButton).toHaveClass(/border-red-500/)
  await expect(cancelButton).toHaveClass(/text-red-600/)

  await page.setViewportSize({ width: 390, height: 844 })
  const attachmentsDialog = page.getByRole("dialog", { name: "Anexos do atendimento" })
  await expect.poll(() => attachmentsDialog.locator('[data-slot="dialog-header"]').evaluate((header) => (
    getComputedStyle(header).textAlign
  ))).toBe("left")
  await expect.poll(async () => {
    const [cancelBox, finishBox] = await Promise.all([
      cancelButton.boundingBox(),
      page.locator('[data-attendance-slider="finish"]').boundingBox(),
    ])
    if (!cancelBox || !finishBox) return false
    return cancelBox.width > 340 && cancelBox.y + cancelBox.height < finishBox.y
  }).toBe(true)

  await page.setViewportSize({ width: 1280, height: 720 })
  await expect.poll(async () => {
    const [cancelBox, finishBox] = await Promise.all([
      cancelButton.boundingBox(),
      page.getByRole("button", { name: "Encerrar atendimento", exact: true }).boundingBox(),
    ])
    if (!cancelBox || !finishBox) return false
    return cancelBox.x + cancelBox.width < finishBox.x && Math.abs(cancelBox.y - finishBox.y) <= 1
  }).toBe(true)

  await cancelButton.click()
  const confirmDialog = page.getByRole("dialog", { name: "Cancelar atendimento?" })
  await expect(confirmDialog).toBeVisible()
  await expect(confirmDialog).toContainText("O agendamento não será cancelado.")
  await expect(page.getByLabel("Motivo do cancelamento *")).toHaveCount(0)
  await confirmDialog.getByRole("button", { name: "Cancelar atendimento", exact: true }).click()

  await expect.poll(() => cancellationRequestCount).toBe(1)
  await expect(page.getByText("Atendimento cancelado.", { exact: true })).toBeVisible()
})

test("usuário sem permissão de edição não vê o cancelamento do atendimento", async ({ page }) => {
  const date = todayKey()
  const viewer = {
    ...E2E_USER,
    id: "user-schedule-cancel-viewer",
    permissions: ["agenda_view"],
  }
  const schedule = {
    ...scheduleFixture,
    id: "schedule-cancel-view-only",
    date,
    status: "in_progress" as const,
    canAttachNa: true,
  }

  await installAuthenticatedSession(page, viewer)
  await installApiMock(page, viewer)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [schedule] }),
      })
      return
    }
    await route.fallback()
  })

  await page.goto(`/agenda?date=${date}`)
  await page.getByRole("button", { name: new RegExp(schedule.clientName) }).click()
  await expect(page.getByRole("heading", { name: "Anexos do atendimento", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Cancelar atendimento", exact: true })).toHaveCount(0)
})
