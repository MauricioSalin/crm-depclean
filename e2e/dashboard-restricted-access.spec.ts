import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

test("sem dashboard_view mostra somente os widgets operacionais com o escopo da agenda", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-28T12:00:00.000Z"))

  const restrictedUser = {
    ...E2E_USER,
    id: "user-dashboard-own-agenda",
    permissions: ["agenda_own_view"],
  }
  const ownInProgressSchedule = {
    ...scheduleFixture,
    id: "schedule-dashboard-own",
    clientName: "Cliente permitido no dashboard",
    date: "2026-07-28",
    time: "09:30",
    status: "in_progress" as const,
    naAttachments: [{ fileName: "na-dashboard.pdf", documentUrl: "/files/na-dashboard.pdf" }],
  }
  const ownScheduledSchedule = {
    ...scheduleFixture,
    id: "schedule-dashboard-startable",
    clientName: "Cliente agendado permitido no dashboard",
    date: "2026-07-28",
    time: "11:00",
    status: "scheduled" as const,
    canStartAttendance: true,
  }
  let dashboardAnalyticsRequests = 0

  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/analytics/dashboard") {
      dashboardAnalyticsRequests += 1
    }
  })

  await installAuthenticatedSession(page, restrictedUser)
  await installApiMock(page, restrictedUser)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [ownInProgressSchedule, ownScheduledSchedule] }),
      })
      return
    }

    const requestedSchedule = [ownInProgressSchedule, ownScheduledSchedule]
      .find((schedule) => pathname === `/api/v1/schedules/${schedule.id}`)
    if (request.method() === "GET" && requestedSchedule) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: requestedSchedule }),
      })
      return
    }

    if (request.method() === "PATCH" && pathname === `/api/v1/schedules/${ownScheduledSchedule.id}/start`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          success: true,
          data: { ...ownScheduledSchedule, status: "in_progress", canAttachNa: true },
        }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Atendimentos em tempo real", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Próximos Serviços", exact: true })).toBeVisible()
  await expect(page.getByText(ownInProgressSchedule.clientName, { exact: true })).toHaveCount(2)
  await expect(page.getByRole("heading", { name: "Contratos por status", exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Renovações de Contratos", exact: true })).toHaveCount(0)
  await expect(page.getByRole("tab")).toHaveCount(0)
  expect(dashboardAnalyticsRequests).toBe(0)

  const liveWidget = page.locator('[data-dashboard-widget="live-services"]')
  await liveWidget.getByRole("button", { name: `Abrir agendamento de ${ownInProgressSchedule.clientName}` }).click()
  await expect(page).toHaveURL("/")
  const naHeading = page.getByRole("heading", { name: "NAs do atendimento", exact: true })
  const naBackButton = page.getByRole("button", { name: "Voltar", exact: true })
  await expect(naHeading).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(naBackButton).toHaveClass(/text-foreground/)
  await expect.poll(async () => {
    const [headingBox, backButtonBox] = await Promise.all([
      naHeading.boundingBox(),
      naBackButton.boundingBox(),
    ])
    if (!headingBox || !backButtonBox) return -1
    return headingBox.y - backButtonBox.y - backButtonBox.height
  }).toBeGreaterThanOrEqual(8)
  const informationButtonBox = await page.getByRole("button", { name: "Ver informações", exact: true }).boundingBox()
  const finishSliderBox = await page.locator('[data-attendance-slider="finish"]').boundingBox()
  expect(informationButtonBox).not.toBeNull()
  expect(finishSliderBox).not.toBeNull()
  expect(informationButtonBox!.x + informationButtonBox!.width).toBeLessThan(finishSliderBox!.x)
  expect(Math.abs(informationButtonBox!.y - finishSliderBox!.y)).toBeLessThanOrEqual(1)
  await expect(page.getByRole("button", { name: "Editar agendamento", exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.getByRole("button", { name: "Encerrar atendimento", exact: true })).toBeEnabled()

  await page.keyboard.press("Escape")
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toHaveCount(0)
  const upcomingWidget = page.locator('[data-dashboard-widget="upcoming-services"]')
  await upcomingWidget.getByRole("button", { name: `Abrir agendamento de ${ownScheduledSchedule.clientName}` }).click()
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("dialog", { name: new RegExp(ownScheduledSchedule.clientName) })).toBeVisible()
  await page.getByRole("button", { name: "Iniciar atendimento", exact: true }).click()
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()
})

test("editor abre o formulário pela tela de NAs do dashboard sem trocar de página", async ({ page }) => {
  const editorUser = {
    ...E2E_USER,
    id: "user-dashboard-schedule-editor",
    permissions: ["dashboard_view", "agenda_view", "agenda_manage"],
  }
  const editableSchedule = {
    ...scheduleFixture,
    id: "schedule-dashboard-editable",
    clientName: "Cliente editável no dashboard",
    contractId: null,
    contractServiceId: null,
    contractServiceIds: [],
    isManual: true,
    status: "in_progress" as const,
    canAttachNa: true,
  }

  await installAuthenticatedSession(page, editorUser)
  await installApiMock(page, editorUser)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [editableSchedule] }),
      })
      return
    }

    if (request.method() === "GET" && pathname === `/api/v1/schedules/${editableSchedule.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: editableSchedule }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/")
  const liveWidget = page.locator('[data-dashboard-widget="live-services"]')
  await liveWidget.getByRole("button", { name: `Abrir agendamento de ${editableSchedule.clientName}` }).click()
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()

  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { name: "Editar atendimento avulso", exact: true })).toBeVisible()
})
