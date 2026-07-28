import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

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
