import { expect, test } from "@playwright/test"

import { employeeFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const DAY = "2026-07-28"

test("abre a Agenda mobile no dia e mantém somente os agendamentos permitidos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const ownAgendaUser = {
    ...E2E_USER,
    id: "user-own-agenda-mobile",
    permissions: ["agenda_own_view"],
    employeeId: employeeFixture.id,
  }
  const ownSchedule = {
    ...scheduleFixture,
    id: "schedule-own-mobile",
    date: DAY,
    time: "08:00",
    status: "in_progress" as const,
    canAttachNa: true,
    additionalEmployees: [{ id: employeeFixture.id, name: employeeFixture.name }],
  }

  await installAuthenticatedSession(page, ownAgendaUser)
  await installApiMock(page, ownAgendaUser)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    if (request.method() === "GET" && new URL(request.url()).pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [ownSchedule] }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/agenda?date=${DAY}`)

  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("day")
  const resourceColumn = page.locator('[data-resource-column="employee"]')
  await expect(resourceColumn).toHaveCount(1)
  const mobileResourceWidthRatio = await page.evaluate(() => {
    const timeline = document.querySelector<HTMLElement>("[data-agenda-timeline-scroll]")
    const resource = document.querySelector<HTMLElement>('[data-resource-column="employee"]')
    if (!timeline || !resource) return 0
    return resource.getBoundingClientRect().width / (timeline.clientWidth - 56)
  })
  expect(mobileResourceWidthRatio).toBeGreaterThan(0.39)
  expect(mobileResourceWidthRatio).toBeLessThan(0.41)
  const dayDetails = page.locator("[data-agenda-day-details]")
  await expect(dayDetails).toBeVisible()
  await expect(dayDetails).not.toHaveAttribute("aria-hidden", "true")
  await expect(dayDetails.getByText(ownSchedule.clientName, { exact: true })).toBeVisible()
  const scheduleButton = page.getByRole("button", { name: new RegExp(ownSchedule.clientName) })
  await expect(scheduleButton).toBeVisible()
  await expect.poll(() => page.locator("[data-agenda-timeline-scroll]").evaluate((element) => element.scrollTop)).toBeGreaterThan(300)
  await scheduleButton.click()
  await expect(page.getByRole("heading", { name: "Anexos do atendimento", exact: true })).toBeVisible()
  const informationButtonBox = await page.getByRole("button", { name: "Ver informações", exact: true }).boundingBox()
  const finishSliderBox = await page.locator('[data-attendance-slider="finish"]').boundingBox()
  expect(informationButtonBox).not.toBeNull()
  expect(finishSliderBox).not.toBeNull()
  expect(informationButtonBox!.height).toBeLessThanOrEqual(40)
  expect(informationButtonBox!.width).toBeGreaterThan(335)
  expect(finishSliderBox!.width).toBeGreaterThan(335)
  expect(informationButtonBox!.y + informationButtonBox!.height).toBeLessThan(finishSliderBox!.y)

  await page.setViewportSize({ width: 1280, height: 720 })
  await expect.poll(async () => {
    const [informationBox, finishBox] = await Promise.all([
      page.getByRole("button", { name: "Ver informações", exact: true }).boundingBox(),
      page.getByRole("button", { name: "Encerrar atendimento", exact: true }).boundingBox(),
    ])
    if (!informationBox || !finishBox) return false
    return informationBox.x + informationBox.width < finishBox.x && Math.abs(informationBox.y - finishBox.y) <= 1
  }).toBe(true)
})
