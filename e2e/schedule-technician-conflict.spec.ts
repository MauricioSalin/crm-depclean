import { expect, test, type Page, type Route } from "@playwright/test"

import {
  employeeFixture,
  installApiMock,
  scheduleFixture,
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

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("confirma em modal ao vincular técnico com sobreposição de horário", async ({ page }) => {
  const mock = await installTechnicianConflictMock(page)

  await page.goto("/agendamentos")
  const scheduleRow = page.getByRole("row").filter({ hasText: longSchedule.clientName })
  await scheduleRow.getByRole("button", { name: `Abrir ações do agendamento de ${longSchedule.clientName}` }).click()
  await page.getByRole("menuitem", { name: "Editar" }).click()

  const editDialog = page.getByRole("dialog", { name: "Editar atendimento avulso" })
  await editDialog.getByRole("combobox", { name: "Buscar e adicionar funcionários" }).click()
  await page.getByRole("option", { name: /Eduardo/ }).click()
  await editDialog.getByRole("button", { name: "Salvar", exact: true }).click()

  const conflictDialog = page.getByRole("dialog", { name: "Conflito de horário" })
  await expect(conflictDialog).toContainText("Eduardo terá um conflito de horário. Deseja continuar?")
  await expect(conflictDialog.getByRole("button", { name: "Cancelar" })).toBeVisible()
  const continueButton = conflictDialog.getByRole("button", { name: "Continuar", exact: true })
  await expect(continueButton).toHaveClass(/bg-primary/)
  await continueButton.click()

  await expect.poll(() => mock.getSavedPayload()).toMatchObject({
    additionalEmployeeIds: [eduardo.id],
    allowConflict: true,
  })
  await expect(editDialog).toBeHidden()

  await scheduleRow.getByRole("button", { name: `Abrir ações do agendamento de ${longSchedule.clientName}` }).click()
  await page.getByRole("menuitem", { name: "Editar" }).click()

  await expect(editDialog.getByText(eduardo.name, { exact: true })).toBeVisible()
  expect(mock.getPatchCount()).toBe(1)
})
