import { expect, test } from "@playwright/test"
import { clientFixture, contractFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import { getScheduleDailyServiceCapacityViolation } from "../lib/schedule-availability"
import type { ScheduleRecord } from "../lib/api/schedules"

for (const occupied of ["2026-11-20", "2026-11-25"]) {
  test(`P2 revisão: capacidade do reagendamento usa o dia real e não ${occupied === "2026-11-20" ? "um dia intermediário" : "ignora o dia adicional"}`, () => {
    const first = { ...scheduleFixture, id: "review-group", date: "2026-11-12", time: "08:00", duration: 480, durationValue: 1, durationType: "days", multiDayGroupId: "review-group", multiDayIndex: 1, multiDayTotal: 2, multiDayDates: ["2026-11-12", "2026-11-18"], multiDayTimes: ["08:00", "13:00"] } as ScheduleRecord
    const busy = { ...first, id: "external-busy", date: occupied, multiDayGroupId: "", multiDayIndex: 1, multiDayTotal: 1, multiDayDates: [], multiDayTimes: [] }
    const violation = getScheduleDailyServiceCapacityViolation({ schedules: [first, busy], schedule: first, date: "2026-11-19", time: "08:00", serviceTypes: [{ id: first.serviceTypeId, dailyScheduleLimitHours: 8 }] })
    if (occupied === "2026-11-20") expect(violation).toBeNull()
    else expect(violation?.date).toBe("2026-11-25")
  })
}

for (const surface of ["client-services", "client-agenda", "contract-agenda"]) {
  test(`P2 revisão: Concluído Parcial aparece em ${surface}`, async ({ page }) => {
    await installAuthenticatedSession(page)
    await installApiMock(page)
    const partial = { ...scheduleFixture, status: "partially_completed", executionDurationMinutes: 120 }
    await page.route(`**/api/v1/clients/${clientFixture.id}/services`, route => route.fulfill({ json: { success: true, data: [partial] } }))
    await page.route("**/api/v1/schedules**", async route => {
      if (route.request().method() === "GET" && new URL(route.request().url()).pathname.endsWith("/schedules")) return route.fulfill({ json: { success: true, data: [partial] } })
      await route.fallback()
    })
    await page.goto(surface === "contract-agenda" ? `/contratos/${contractFixture.id}` : `/clientes/${clientFixture.id}`)
    await page.getByRole("tab", { name: surface === "client-services" ? /^Serviços/ : /^Agenda/ }).click()
    await expect(page.getByRole("tabpanel").getByText("Concluído Parcial", { exact: true })).toBeVisible()
    await expect(page.getByRole("tabpanel").getByText("partially_completed", { exact: true })).toHaveCount(0)
  })
}
