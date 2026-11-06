import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

test("pulling a mobile list from the top refetches its active data", async ({ page }) => {
  let clientListRequests = 0

  page.on("request", (request) => {
    const url = new URL(request.url())
    if (request.method() === "GET" && url.pathname === "/api/v1/clients") {
      clientListRequests += 1
    }
  })

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.goto("/clientes")
  await expect(page.getByText("Condomínio E2E", { exact: true })).toBeVisible()

  const requestsBeforePull = clientListRequests

  await page.locator("main").dispatchEvent("touchstart", {
    touches: [{ identifier: 1, clientX: 180, clientY: 4 }],
    changedTouches: [{ identifier: 1, clientX: 180, clientY: 4 }],
  })
  await page.locator("main").dispatchEvent("touchmove", {
    touches: [{ identifier: 1, clientX: 180, clientY: 150 }],
    changedTouches: [{ identifier: 1, clientX: 180, clientY: 150 }],
  })
  await page.locator("main").dispatchEvent("touchend", {
    touches: [],
    changedTouches: [{ identifier: 1, clientX: 180, clientY: 150 }],
  })

  const refreshIndicator = page.getByTestId("mobile-pull-to-refresh")
  await expect(refreshIndicator).toBeVisible()
  await expect.poll(() => clientListRequests).toBeGreaterThan(requestsBeforePull)
  await expect(refreshIndicator).toBeHidden()
})

test("a touch on a schedule shortcut stays out of pull-to-refresh", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-03T15:00:00Z"))
  const user = { ...E2E_USER, permissions: ["agenda_own_view"] }
  const schedule = { ...scheduleFixture, date: "2026-11-03", status: "in_progress", canAttachNa: true }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  await page.route("**/api/v1/schedules**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (route.request().method() === "GET" && pathname.endsWith("/schedules")) {
      return route.fulfill({ json: { success: true, data: [schedule] } })
    }
    if (route.request().method() === "GET" && pathname.endsWith(`/schedules/${schedule.id}`)) {
      return route.fulfill({ json: { success: true, data: schedule } })
    }
    return route.fallback()
  })
  await page.goto("/")

  const shortcut = page.locator('[data-dashboard-widget="live-services"]').getByRole("button", {
    name: `Abrir agendamento de ${schedule.clientName}`,
  })
  await expect(shortcut).toBeInViewport()
  await shortcut.tap()
  const attachmentsHeading = page.getByRole("heading", { name: "Anexos do atendimento", exact: true })
  await expect(attachmentsHeading).toBeVisible()
  await expect(page).toHaveURL("/")
  await page.keyboard.press("Escape")
  await expect(attachmentsHeading).toHaveCount(0)

  const box = (await shortcut.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const touch = await page.context().newCDPSession(page)
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + 24 }] })
  await expect(page.getByTestId("mobile-pull-to-refresh")).toHaveCount(0)
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await touch.detach()
})
