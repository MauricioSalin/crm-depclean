import { expect, test, type Page, type Route } from "@playwright/test"

import {
  employeeFixture,
  installApiMock,
  scheduleFixture,
  serviceFixture,
} from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const FIXED_NOW = new Date("2026-07-28T12:00:00.000Z")
const API_TIMESTAMP = FIXED_NOW.toISOString()
const eduardo = { ...employeeFixture, name: "Eduardo" }

const longSchedule = {
  ...scheduleFixture,
  id: "schedule-long",
  contractId: "",
  contractServiceId: "",
  contractServiceIds: [],
  isManual: true,
  clientName: "Condomínio Longo",
  teams: [],
  additionalEmployees: [],
  date: "2026-08-13",
  time: "09:00",
  duration: 480,
  durationValue: 8,
  durationType: "hours",
}

const eduardoSchedule = {
  ...scheduleFixture,
  id: "schedule-eduardo",
  contractId: "",
  contractServiceId: "",
  contractServiceIds: [],
  isManual: true,
  clientName: "Condomínio Eduardo",
  teams: [],
  additionalEmployees: [{ id: eduardo.id, name: eduardo.name }],
  date: "2026-08-13",
  time: "10:00",
  duration: 120,
  durationValue: 2,
  durationType: "hours",
}

const previousDayThirteenHoursSchedule = {
  ...scheduleFixture,
  id: "schedule-previous-day-thirteen-hours",
  contractId: "",
  contractServiceId: "",
  contractServiceIds: [],
  isManual: true,
  clientName: "Condomínio Ubiratan",
  teams: [],
  additionalEmployees: [{ id: eduardo.id, name: eduardo.name }],
  date: "2026-08-13",
  time: "08:00",
  duration: 13 * 60,
  durationValue: 13,
  durationType: "hours" as const,
}

const nextDaySchedule = {
  ...scheduleFixture,
  id: "schedule-next-day-free",
  contractId: "",
  contractServiceId: "",
  contractServiceIds: [],
  isManual: true,
  clientName: "Condomínio Flamboyan",
  teams: [],
  additionalEmployees: [],
  date: "2026-08-14",
  time: "08:00",
  duration: 8 * 60,
  durationValue: 8,
  durationType: "hours" as const,
}

const brokenHoursSchedule = {
  ...scheduleFixture,
  id: "schedule-broken-hours",
  clientName: "Condomínio Nova Primavera II",
  date: "2028-12-04",
  time: "08:00",
  duration: 110,
  durationValue: 110 / 60,
  durationType: "hours" as const,
}

const multiDaySchedule = {
  ...scheduleFixture,
  id: "schedule-multi-day-limit",
  contractId: "",
  contractServiceId: "",
  contractServiceIds: [],
  isManual: true,
  clientName: "Condomínio com atendimento de três dias",
  serviceTypeName: "Limpeza de rede",
  date: "2026-08-06",
  time: "12:00",
  duration: 3 * 8 * 60,
  durationValue: 3,
  durationType: "days" as const,
}

const saturdayLimitSchedule = {
  ...scheduleFixture,
  id: "schedule-saturday-limit",
  contractId: "",
  contractServiceId: "",
  contractServiceIds: [],
  isManual: true,
  clientName: "Condomínio atendido no sábado",
  serviceTypeId: multiDaySchedule.serviceTypeId,
  serviceTypeIds: [multiDaySchedule.serviceTypeId],
  serviceTypeName: "Limpeza de rede",
  teams: [],
  additionalEmployees: [],
  date: "2026-08-08",
  time: "08:00",
  duration: 60,
  durationValue: 1,
  durationType: "hours" as const,
}

function success(data: unknown) {
  return {
    success: true,
    message: "Operação de teste concluída.",
    data,
    meta: { version: "e2e", timestamp: API_TIMESTAMP },
  }
}

async function fulfill(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(success(data)),
  })
}

async function installTechnicianConflictMock(page: Page) {
  let savedPayload: Record<string, unknown> | null = null
  let savedLongSchedule: Omit<typeof longSchedule, "additionalEmployees"> & {
    additionalEmployees: Array<{ id: string; name: string }>
  } = longSchedule
  let patchCount = 0

  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace("/api/v1", "")
    if (request.method() === "GET" && path === "/schedules") {
      await fulfill(route, [savedLongSchedule, eduardoSchedule])
      return
    }
    if (request.method() === "PATCH" && path === `/schedules/${longSchedule.id}`) {
      patchCount += 1
      savedPayload = request.postDataJSON()
      savedLongSchedule = {
        ...longSchedule,
        additionalEmployees: [{ id: eduardo.id, name: eduardo.name }],
      }
      await fulfill(route, savedLongSchedule)
      return
    }
    await route.fallback()
  })

  await page.route("**/api/v1/employees**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (route.request().method() === "GET" && path === "/employees") {
      await fulfill(route, [eduardo])
      return
    }
    await route.fallback()
  })

  return {
    getSavedPayload: () => savedPayload,
    getPatchCount: () => patchCount,
  }
}

async function installBrokenHoursMock(page: Page) {
  let savedPayload: Record<string, unknown> | null = null
  let persistedSchedule = {
    ...brokenHoursSchedule,
    durationType: brokenHoursSchedule.durationType as "minutes" | "hours" | "shift" | "days",
  }

  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace("/api/v1", "")

    if (request.method() === "GET" && path === "/schedules") {
      await fulfill(route, [persistedSchedule])
      return
    }

    if (request.method() === "PATCH" && path === `/schedules/${brokenHoursSchedule.id}`) {
      const payload = request.postDataJSON() as Record<string, unknown>
      savedPayload = payload
      persistedSchedule = {
        ...persistedSchedule,
        duration: Number(payload.estimatedDuration),
        durationValue: Number(payload.durationValue),
        durationType: String(payload.durationType) as typeof persistedSchedule.durationType,
      }
      await fulfill(route, persistedSchedule)
      return
    }

    await route.fallback()
  })

  return {
    getSavedPayload: () => savedPayload,
  }
}

async function installPreviousDayHoursMock(page: Page) {
  let savedPayload: Record<string, unknown> | null = null

  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace("/api/v1", "")

    if (request.method() === "GET" && path === "/schedules") {
      await fulfill(route, [previousDayThirteenHoursSchedule, nextDaySchedule])
      return
    }

    if (request.method() === "PATCH" && path === `/schedules/${nextDaySchedule.id}`) {
      savedPayload = request.postDataJSON() as Record<string, unknown>
      await fulfill(route, {
        ...nextDaySchedule,
        additionalEmployees: [{ id: eduardo.id, name: eduardo.name }],
      })
      return
    }

    await route.fallback()
  })

  await page.route("**/api/v1/employees**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (route.request().method() === "GET" && path === "/employees") {
      await fulfill(route, [eduardo])
      return
    }
    await route.fallback()
  })

  return { getSavedPayload: () => savedPayload }
}

async function installMultiDayLimitMock(page: Page) {
  let savedPayload: Record<string, unknown> | null = null

  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace("/api/v1", "")
    if (request.method() === "GET" && path === "/schedules") {
      await fulfill(route, [multiDaySchedule, saturdayLimitSchedule])
      return
    }
    if (request.method() === "PATCH" && path === `/schedules/${multiDaySchedule.id}`) {
      savedPayload = request.postDataJSON() as Record<string, unknown>
      await fulfill(route, multiDaySchedule)
      return
    }
    await route.fallback()
  })

  await page.route("**/api/v1/services**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace("/api/v1", "")
    if (request.method() === "GET" && path === "/services") {
      await fulfill(route, [{
        ...serviceFixture,
        id: multiDaySchedule.serviceTypeId,
        name: "Limpeza de rede",
        dailyScheduleLimitHours: 8,
      }])
      return
    }
    await route.fallback()
  })

  return { getSavedPayload: () => savedPayload }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("mantém a duração configurada em horas na listagem de agendamentos", async ({ page }) => {
  await installTechnicianConflictMock(page)

  await page.goto("/agendamentos")
  const scheduleRow = page.getByRole("row").filter({ hasText: longSchedule.clientName })
  await expect(scheduleRow.getByText(longSchedule.serviceTypeName, { exact: true })).toBeVisible()
  await expect(scheduleRow.getByText("8 horas", { exact: true })).toBeVisible()
  await expect(scheduleRow.locator('[data-slot="badge"]').filter({ hasText: longSchedule.serviceTypeName })).toHaveCount(0)
  await expect(scheduleRow.getByRole("button", { name: `Ver serviços de ${longSchedule.clientName}` })).toHaveCount(0)
})

test("edita horas quebradas em minutos e mantém horas e minutos na lista", async ({ page }) => {
  const mock = await installBrokenHoursMock(page)

  await page.goto("/agendamentos")
  const scheduleRow = page.getByRole("row").filter({ hasText: brokenHoursSchedule.clientName })
  await expect(scheduleRow.getByText("1 hora e 50 minutos", { exact: true })).toBeVisible()

  await scheduleRow.getByRole("button", {
    name: `Abrir ações do agendamento de ${brokenHoursSchedule.clientName}`,
  }).click()
  await page.getByRole("menuitem", { name: "Editar" }).click()

  const editDialog = page.getByRole("dialog", { name: "Editar atendimento recorrente" })
  const durationType = editDialog.getByText("Tipo de Duração", { exact: true }).locator("..").getByRole("combobox")
  const durationInput = editDialog.getByText("Duração", { exact: true }).locator("..").locator("input")
  await expect(durationType).toContainText("Minutos")
  await expect(durationInput).toHaveValue("110")
  await durationInput.pressSequentially(",")
  await expect(durationInput).toHaveValue("110")

  await editDialog.getByRole("button", { name: "Salvar", exact: true }).click()

  await expect.poll(() => mock.getSavedPayload()).toMatchObject({
    estimatedDuration: 110,
    durationValue: 110,
    durationType: "minutes",
  })
  await expect(editDialog).toBeHidden()
  await expect(scheduleRow.getByText("1 hora e 50 minutos", { exact: true })).toBeVisible()
})

test("edita três dias de quinta a segunda sem considerar o sábado no limite", async ({ page }) => {
  const mock = await installMultiDayLimitMock(page)

  await page.goto("/agendamentos")
  const scheduleRow = page.getByRole("row").filter({ hasText: multiDaySchedule.clientName })
  await scheduleRow.getByRole("button", {
    name: `Abrir ações do agendamento de ${multiDaySchedule.clientName}`,
  }).click()
  await page.getByRole("menuitem", { name: "Editar" }).click()

  const editDialog = page.getByRole("dialog", { name: "Editar atendimento avulso" })
  await editDialog.getByRole("button", { name: "Salvar", exact: true }).click()

  await expect.poll(() => mock.getSavedPayload()).toMatchObject({
    estimatedDuration: 3 * 8 * 60,
    durationValue: 3,
    durationType: "days",
  })
  await expect(page.getByText(/limite de .* horas.*ultrapassado/i)).toHaveCount(0)

  await page.goto("/agenda?date=2026-08-06&view=month")
  const calendarEventLabel = `${multiDaySchedule.clientName} - ${multiDaySchedule.serviceTypeName}`
  await expect(page.getByText("12:00 (3 dias)", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: `6 ${calendarEventLabel}`, exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: `7 ${calendarEventLabel}`, exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: `8 ${calendarEventLabel}`, exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: `10 ${calendarEventLabel}`, exact: true })).toBeVisible()

  await page.goto("/agenda?date=2026-08-06&view=week")
  const occurrences = page.getByRole("button").filter({ hasText: multiDaySchedule.clientName })
  await expect(occurrences).toHaveCount(2)
  await occurrences.nth(1).hover()
  await expect(occurrences.nth(0).locator('[data-schedule-reference="1/3"]')).toBeVisible()
  await expect(occurrences.nth(1).locator('[data-schedule-reference="2/3"]')).toBeVisible()

  await page.goto("/agenda?date=2026-08-10&view=week")
  const finalOccurrence = page.getByRole("button").filter({ hasText: multiDaySchedule.clientName })
  await expect(finalOccurrence).toHaveCount(1)
  await finalOccurrence.hover()
  await expect(finalOccurrence.locator('[data-schedule-reference="3/3"]')).toBeVisible()
})

test("bloqueia com toast ao vincular técnico com sobreposição de horário", async ({ page }) => {
  const mock = await installTechnicianConflictMock(page)

  await page.goto("/agendamentos")
  const scheduleRow = page.getByRole("row").filter({ hasText: longSchedule.clientName })
  await scheduleRow.getByRole("button", { name: `Abrir ações do agendamento de ${longSchedule.clientName}` }).click()
  await page.getByRole("menuitem", { name: "Editar" }).click()

  const editDialog = page.getByRole("dialog", { name: "Editar atendimento avulso" })
  await editDialog.getByRole("combobox", { name: "Buscar e adicionar funcionários" }).click()
  await page.getByRole("option", { name: /Eduardo/ }).click()
  await page.keyboard.press("Escape")
  await editDialog.getByRole("button", { name: "Salvar", exact: true }).click()

  await expect(page.getByText("O funcionário selecionado não tem disponibilidade para este agendamento.")).toBeVisible()
  await expect(page.getByRole("dialog", { name: "Conflito de horário" })).toHaveCount(0)
  await expect(editDialog).toBeVisible()
  expect(mock.getSavedPayload()).toBeNull()
  expect(mock.getPatchCount()).toBe(0)
})

test("permite vincular técnico no dia seguinte após agendamento manual de treze horas", async ({ page }) => {
  const mock = await installPreviousDayHoursMock(page)

  await page.goto("/agenda?date=2026-08-13&view=week")
  await expect(page.getByText("08:00 (13 horas)", { exact: true })).toBeVisible()

  await page.goto("/agenda?date=2026-08-14&view=week")
  await expect(page.getByText("08:00 (8 horas)", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /Condomínio Flamboyan 08:00 - 16:00/ }).click()
  await page.getByRole("button", { name: "Editar agendamento" }).click()

  const editDialog = page.getByRole("dialog", { name: "Editar atendimento avulso" })
  await editDialog.getByRole("combobox", { name: "Buscar e adicionar funcionários" }).click()
  await page.getByRole("option", { name: /Eduardo/ }).click()
  await page.keyboard.press("Escape")
  await editDialog.getByRole("button", { name: "Salvar", exact: true }).click()

  await expect.poll(() => mock.getSavedPayload()).toMatchObject({
    additionalEmployeeIds: [eduardo.id],
    estimatedDuration: 8 * 60,
    durationValue: 8,
    durationType: "hours",
  })
  await expect(page.getByRole("dialog", { name: "Conflito de horário" })).toHaveCount(0)
  await expect(editDialog).toBeHidden()
})
