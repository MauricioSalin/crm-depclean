import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [scheduleFixture] }),
    })
  })
})

for (const view of ["day", "week"] as const) {
  test(`exibe shimmer na timeline de ${view === "day" ? "dia" : "semana"} sem piscar o estado vazio`, async ({ page }) => {
    await page.goto(`/agenda?date=${scheduleFixture.date}&view=${view}`)

    const loading = page.locator("[data-agenda-timeline-loading]")
    await expect(loading).toBeVisible()
    await expect(loading).toHaveAttribute("aria-label", "Carregando itens da agenda")
    await expect(page.getByText("Nenhum responsável com agendamento neste dia.", { exact: true })).toHaveCount(0)

    await expect(loading).toHaveCount(0)
    await expect(page.locator(`[data-schedule-id="${scheduleFixture.id}"]`).first()).toBeVisible()
  })
}

test("exibe shimmer nos itens do mês enquanto os agendamentos carregam", async ({ page }) => {
  await page.goto(`/agenda?date=${scheduleFixture.date}&view=month`)

  const loadingItems = page.locator("[data-agenda-month-loading]")
  await expect(loadingItems.first()).toBeVisible()
  await expect(loadingItems).toHaveCount(31)

  await expect(loadingItems).toHaveCount(0)
  await expect(page.locator("button").filter({ hasText: String(Number(scheduleFixture.date.slice(8, 10))) }).first()).toBeVisible()
})

test("reflete uma ação imediatamente sem aguardar a revalidação da agenda", async ({ page }) => {
  const cancelledSchedule = {
    ...scheduleFixture,
    status: "cancelled" as const,
    cancellationReason: "Cancelado para validar a atualização imediata.",
  }
  let listRequests = 0

  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === "PATCH" && url.pathname.endsWith(`/${cancelledSchedule.id}/reactivate`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: scheduleFixture }),
      })
      return
    }
    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") return route.fallback()

    listRequests += 1
    if (listRequests > 1) await new Promise((resolve) => setTimeout(resolve, 3_000))
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: [listRequests > 1 ? scheduleFixture : cancelledSchedule],
      }),
    })
  })

  await page.goto(`/agenda?date=${cancelledSchedule.date}`)
  await page.getByRole("button", { name: "Mostrar detalhes do dia" }).click()
  const reactivateButton = page.getByRole("button", { name: "Reativar", exact: true })
  await expect(reactivateButton).toBeVisible()
  const scheduleCard = page
    .getByRole("heading", { name: cancelledSchedule.clientName, exact: true })
    .locator("xpath=ancestor::div[@data-slot='card'][1]")

  await reactivateButton.click()

  await expect(scheduleCard.getByText("Agendado", { exact: true })).toBeVisible({ timeout: 1_000 })
  expect(listRequests).toBeGreaterThan(1)
})

test("mantém os marcadores de sequência sem sombra recortada nos cards estreitos", async ({ page }) => {
  const linkedSchedules = [
    {
      ...scheduleFixture,
      id: "schedule-linked-1",
      multiDayGroupId: "schedule-linked-group",
      multiDayIndex: 1,
      multiDayTotal: 2,
    },
    {
      ...scheduleFixture,
      id: "schedule-linked-2",
      date: "2026-07-29",
      multiDayGroupId: "schedule-linked-group",
      multiDayIndex: 2,
      multiDayTotal: 2,
    },
  ]

  await page.route("**/api/v1/schedules", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: linkedSchedules }),
    })
  })

  await page.goto(`/agenda?date=${scheduleFixture.date}&view=week`)
  const occurrences = page.getByRole("button").filter({ hasText: scheduleFixture.clientName })
  await expect(occurrences).toHaveCount(2)
  await occurrences.nth(1).hover()

  const firstReference = occurrences.nth(0).locator('[data-schedule-reference="1/2"]')
  const secondReference = occurrences.nth(1).locator('[data-schedule-reference="2/2"]')
  await expect(firstReference).toBeVisible()
  await expect(secondReference).toBeVisible()
  await expect(firstReference).toHaveCSS("box-shadow", "none")
  await expect(secondReference).toHaveCSS("box-shadow", "none")
})

test("dias não consecutivos aparecem nas datas e horários próprios com hover do grupo inteiro", async ({ page }) => {
  const dates = ["2026-07-27", "2026-07-29", "2026-07-31"]
  const times = ["08:00", "13:30", "09:00"]
  const schedules = dates.map((date, index) => ({
    ...scheduleFixture, id: `schedule-nonconsecutive-${index + 1}`, date, time: times[index],
    duration: 480, durationType: "days", durationValue: 1,
    multiDayGroupId: "nonconsecutive-group", multiDayIndex: index + 1, multiDayTotal: 3,
    multiDayDates: index === 0 ? dates : [], multiDayTimes: index === 0 ? times : [],
  }))
  const other = { ...scheduleFixture, id: "schedule-independent", date: "2026-07-28", time: "08:00" }
  await page.route("**/api/v1/schedules", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    await route.fulfill({ json: { success: true, data: [...schedules, other] } })
  })
  await page.goto(`/agenda?date=${dates[0]}&view=week`)
  const timeline = page.locator("[data-agenda-timeline-scroll]")
  const occurrences = timeline.locator('button[data-schedule-id^="schedule-nonconsecutive-"]')
  await expect(occurrences).toHaveCount(3)
  const first = timeline.locator('[data-schedule-id="schedule-nonconsecutive-1"]')
  const second = timeline.locator('[data-schedule-id="schedule-nonconsecutive-2"]')
  const third = timeline.locator('[data-schedule-id="schedule-nonconsecutive-3"]')
  const firstBounds = await first.boundingBox()
  const secondBounds = await second.boundingBox()
  const thirdBounds = await third.boundingBox()
  expect(secondBounds!.x).toBeGreaterThan(firstBounds!.x + firstBounds!.width * 1.5)
  expect(thirdBounds!.x).toBeGreaterThan(secondBounds!.x + secondBounds!.width * 1.5)
  expect(await second.evaluate((element) => parseFloat((element as HTMLElement).style.top)))
    .toBeGreaterThan(await first.evaluate((element) => parseFloat((element as HTMLElement).style.top)))
  await second.hover()
  await expect(second).toContainText("13:30 - 21:30")
  for (let index = 0; index < 3; index++) {
    await expect(occurrences.nth(index)).toHaveClass(/(?:^|\s)-translate-y-0\.5(?:\s|$)/)
    await expect(occurrences.nth(index).locator(`[data-schedule-reference="${index + 1}/3"]`)).toBeVisible()
  }
  await expect(timeline.locator('[data-schedule-id="schedule-independent"]')).not.toHaveClass(/(?:^|\s)-translate-y-0\.5(?:\s|$)/)
  await page.locator("[data-agenda-period-navigation]").hover()
  for (let index = 0; index < 3; index++) {
    await expect(occurrences.nth(index)).not.toHaveClass(/(?:^|\s)-translate-y-0\.5(?:\s|$)/)
  }
})
