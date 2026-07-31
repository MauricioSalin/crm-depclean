import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test("quebra o nome do cliente sem sobrepor o status no mosaico mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installAuthenticatedSession(page)
  await installApiMock(page)

  const longNameSchedule = {
    ...scheduleFixture,
    clientName: "CONDOMÍNIO RESIDENCIAL LOCATELLI EMPREENDIMENTOS",
  }

  await page.route("**/api/v1/schedules**", async (route) => {
    const pathname = new URL(route.request().url()).pathname

    if (route.request().method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [longNameSchedule] }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/agendamentos")

  const card = page.locator('[data-slot="card"]').filter({ hasText: longNameSchedule.clientName })
  const clientName = card.getByText(longNameSchedule.clientName, { exact: true })
  const statusBadge = card.getByText("Agendado", { exact: true })

  await expect(card).toBeVisible()
  await expect(clientName).toBeVisible()
  await expect(statusBadge).toBeVisible()

  const clientNameBox = await clientName.boundingBox()
  const statusBadgeBox = await statusBadge.boundingBox()

  expect(clientNameBox).not.toBeNull()
  expect(statusBadgeBox).not.toBeNull()
  expect(clientNameBox!.height).toBeGreaterThan(20)
  expect(clientNameBox!.x + clientNameBox!.width).toBeLessThanOrEqual(statusBadgeBox!.x)
})
