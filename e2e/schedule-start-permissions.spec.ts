import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const scheduleEditor = {
  ...E2E_USER,
  id: "user-e2e-schedule-editor",
  employeeId: "employee-editor",
  permissionProfileId: "profile-e2e-schedule-editor",
  permissionProfileName: "Edição de agendamentos",
  permissions: ["agenda_view", "agenda_manage"],
  isSystemUser: false,
}

const assignedTechnician = {
  ...E2E_USER,
  id: "user-e2e-assigned-technician",
  name: "Técnico E2E",
  permissionProfileId: "profile-e2e-assigned-technician",
  permissionProfileName: "Técnico",
  permissions: ["agenda_own_view"],
  role: "Técnico",
  isSystemUser: false,
}

function futureCivilDate() {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString().slice(0, 10)
}

function currentCivilDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

test("editor inicia atendimento futuro de outro responsável", async ({ page }) => {
  const date = futureCivilDate()
  let futureSchedule = {
    ...scheduleFixture,
    date,
    status: scheduleFixture.status as "scheduled" | "in_progress",
    canStartAttendance: false,
  }

  await installAuthenticatedSession(page, scheduleEditor)
  await installApiMock(page, scheduleEditor)
  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() === "PATCH" &&
      url.pathname === `/api/v1/schedules/${futureSchedule.id}/start`
    ) {
      futureSchedule = { ...futureSchedule, status: "in_progress" as const, canAttachNa: true }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: futureSchedule }),
      })
      return
    }

    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [futureSchedule] }),
    })
  })

  await page.goto(`/agenda?date=${date}&scheduleId=${futureSchedule.id}`)

  await expect(page.getByRole("button", { name: "Iniciar atendimento", exact: true })).toBeEnabled()
  await expect(page.getByText("Atendimento indisponível nesta data", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Iniciar atendimento", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Anexos do atendimento", exact: true })).toBeVisible()
})

test("técnico inicia atendimento de cliente inadimplente após visualizar o aviso", async ({ page }) => {
  let delinquentSchedule = {
    ...scheduleFixture,
    date: currentCivilDate(),
    isClientDelinquent: true,
    status: scheduleFixture.status as "scheduled" | "in_progress",
    canStartAttendance: true,
  }

  await installAuthenticatedSession(page, assignedTechnician)
  await installApiMock(page, assignedTechnician)
  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() === "PATCH" &&
      url.pathname === `/api/v1/schedules/${delinquentSchedule.id}/start`
    ) {
      delinquentSchedule = { ...delinquentSchedule, status: "in_progress" as const, canAttachNa: true }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: delinquentSchedule }),
      })
      return
    }

    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: [delinquentSchedule] }),
    })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/agenda?date=${delinquentSchedule.date}&scheduleId=${delinquentSchedule.id}`)

  await expect(page.getByText("Inadimplente", { exact: true })).toBeVisible()
  await expect(page.getByText("Atenção: este cliente possui parcela vencida. A inadimplência não impede o atendimento.", { exact: true })).toBeVisible()
  const mobileStartSlider = page.locator('[data-attendance-slider="start"]')
  await expect(mobileStartSlider).toBeVisible()
  await expect(mobileStartSlider).not.toHaveClass(/opacity-60/)

  await page.setViewportSize({ width: 1280, height: 720 })
  const startButton = page.getByRole("button", { name: "Iniciar atendimento", exact: true })
  await expect(startButton).toBeEnabled()
  await startButton.click()

  await expect(page.getByRole("heading", { name: "Anexos do atendimento", exact: true })).toBeVisible()
})
