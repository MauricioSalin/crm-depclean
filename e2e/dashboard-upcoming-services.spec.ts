import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test("próximos serviços separa hoje e amanhã com as datas explícitas", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-28T12:00:00.000Z"))
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    if (request.method() !== "GET" || new URL(request.url()).pathname !== "/api/v1/schedules") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: [
          {
            ...scheduleFixture,
            id: "schedule-today",
            date: "2026-07-28",
            time: "09:00",
            serviceTypeName: "Limpeza de rede",
          },
          {
            ...scheduleFixture,
            id: "schedule-tomorrow",
            date: "2026-07-29",
            time: "08:00",
            serviceTypeName: "Limpeza de caixa d'água",
          },
        ],
      }),
    })
  })
  await page.goto("/")

  const today = page.getByRole("region", { name: "Hoje", exact: true })
  const tomorrow = page.getByRole("region", { name: "Amanhã", exact: true })

  await expect(page.getByRole("heading", { name: "Próximos Serviços", exact: true })).toBeVisible()
  await expect(today).toContainText("28/07/2026")
  await expect(today).toContainText("Limpeza de rede")
  await expect(today).toContainText("09:00")
  await expect(tomorrow).toContainText("29/07/2026")
  await expect(tomorrow).toContainText("Limpeza de caixa d'água")
  await expect(tomorrow).toContainText("08:00")
})
