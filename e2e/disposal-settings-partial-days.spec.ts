import { expect, test } from "@playwright/test"
import { installApiMock, scheduleFixture, serviceFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"
import type { DisposalType } from "../lib/schedule-disposal"
import { checkScheduleAvailability, getDailyServiceCapacityViolation, getScheduleRescheduleVisitFields } from "../lib/schedule-availability"
import type { ScheduleRecord } from "../lib/api/schedules"

test("gerencia tipos, itens e reajustes em Configurações > Empresa", async ({ page }) => {
  const user = { ...E2E_USER, permissionProfileId: "profile-admin" }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  let types: DisposalType[] = [{ id: "gordura", name: "Gordura", items: [{ id: "bio-c-centram", name: "BIO-C", unitPrice: 90 }] }]
  await page.route("**/api/v1/settings/organization", async (route) => {
    if (route.request().method() === "PATCH") types = route.request().postDataJSON().disposalTypes
    await route.fulfill({ json: { success: true, data: { id: "organization", legalName: "Depclean", cnpj: "", address: {}, phone: "", email: "", financialSettings: { installmentOverdueGraceDays: 5, firstInstallmentOverdueGraceDays: 12 }, disposalTypes: types } } })
  })
  await page.goto("/configuracoes?section=empresa")
  await expect(page.getByRole("row").filter({ hasText: "BIO-C" })).toContainText("90,00")
  await page.getByRole("button", { name: "Ações de BIO-C de Gordura", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  await page.getByLabel("Valor unitário por m³ (R$) *", { exact: true }).fill("95,50")
  await page.getByRole("dialog").getByRole("button", { name: "Salvar", exact: true }).click()
  await expect(page.getByRole("row").filter({ hasText: "BIO-C" })).toContainText("95,50")
  await page.getByRole("button", { name: "Adicionar tipo de descarte", exact: true }).click()
  await page.getByLabel("Nome *", { exact: true }).fill("Lodo")
  await page.getByRole("dialog").getByRole("button", { name: "Salvar", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Adicionar item de descarte", exact: true }).click()
  await page.getByRole("dialog").getByRole("combobox").click()
  await page.getByRole("option", { name: "Lodo", exact: true }).click()
  await page.getByLabel("Nome *", { exact: true }).fill("Estação de teste")
  await page.getByLabel("Valor unitário por m³ (R$) *", { exact: true }).fill("22,75")
  await page.getByRole("dialog").getByRole("button", { name: "Salvar", exact: true }).click()
  const item = page.getByRole("row").filter({ hasText: "Estação de teste" })
  await expect(item).toContainText("Lodo")
  await expect(item).toContainText("22,75")
  await page.reload()
  await expect(item).toContainText("22,75")
  await page.getByRole("button", { name: "Ações de Estação de teste de Lodo", exact: true }).click()
  await page.getByRole("menuitem", { name: "Remover", exact: true }).click()
  await page.getByRole("button", { name: "Remover", exact: true }).click()
  await expect(item).toHaveCount(0)
  await page.getByRole("button", { name: "Ações do tipo Lodo", exact: true }).click()
  await page.getByRole("menuitem", { name: "Remover", exact: true }).click()
  await page.getByRole("button", { name: "Remover", exact: true }).click()
  await expect(page.getByRole("row").filter({ hasText: "Lodo" })).toHaveCount(0)
})

test("edita duas visitas parciais do Bom Princípio e preserva as horas ao reabrir", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  let saved: Record<string, unknown> | null = null
  let main = { ...scheduleFixture, id: "bom", clientName: "Bom Princípio", multiDayGroupId: "bom", multiDayIndex: 1, multiDayTotal: 2, multiDayDates: ["2026-11-09", "2026-11-11"], multiDayTimes: ["08:00", "08:00"], multiDayDurations: [480, 480], date: "2026-11-09", time: "08:00", duration: 480, durationValue: 1, durationType: "days", billable: false, teams: [], additionalEmployees: [] }
  const external = { ...scheduleFixture, id: "existing", clientName: "Outro cliente", date: "2026-11-09", time: "08:00", duration: 720, durationValue: 12, durationType: "hours", teams: [], additionalEmployees: [] }
  await page.route("**/api/v1/services**", async (route) => route.fulfill({ json: { success: true, data: [{ ...serviceFixture, dailyScheduleLimitHours: 16 }] } }))
  await page.route("**/api/v1/schedules**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === "PATCH" && path.endsWith("/bom")) {
      saved = route.request().postDataJSON()
      main = { ...main, multiDayDurations: saved!.multiDayDurations as number[], duration: 240, durationValue: 240, durationType: "minutes" }
      return route.fulfill({ json: { success: true, data: main } })
    }
    if (route.request().method() === "GET" && path.endsWith("/schedules")) return route.fulfill({ json: { success: true, data: [main, external] } })
    return route.fallback()
  })
  await page.goto("/agendamentos")
  const row = page.getByRole("row").filter({ hasText: "Bom Princípio" })
  await row.getByRole("button", { name: "Abrir ações do agendamento de Bom Princípio" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar atendimento recorrente" })
  await expect(dialog.getByLabel("Duração do agendamento", { exact: true })).toHaveAccessibleDescription("dias")
  const firstDayDuration = dialog.getByLabel("Duração do Dia 1", { exact: true })
  const secondDayDuration = dialog.getByLabel("Duração do Dia 2", { exact: true })
  await expect(dialog.getByRole("combobox", { name: "Tipo de duração do Dia 1" })).toHaveText("Horas")
  await expect(dialog.getByRole("combobox", { name: "Tipo de duração do Dia 2" })).toHaveText("Horas")
  await expect(firstDayDuration).not.toHaveAttribute("aria-describedby")
  await expect(secondDayDuration).not.toHaveAttribute("aria-describedby")
  await firstDayDuration.fill("4")
  await secondDayDuration.fill("3")
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => saved).toMatchObject({ multiDayDates: ["2026-11-09", "2026-11-11"], multiDayDurations: [240, 180] })
  await expect(dialog).toBeHidden()
  await row.getByRole("button", { name: "Abrir ações do agendamento de Bom Princípio" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  await expect(firstDayDuration).toHaveValue("4")
  await expect(secondDayDuration).toHaveValue("3")
})

test("divide a duração de uma visita em dois dias usando os campos existentes", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  const anchor = {
    ...scheduleFixture, id: "vivaz-10", clientName: "Vivaz Ecoville", multiDayGroupId: "vivaz",
    multiDayIndex: 2, multiDayTotal: 3, date: "2026-11-10", time: "08:00", duration: 480, durationValue: 1,
    durationType: "days", status: "in_progress", billable: false, teams: [], additionalEmployees: [],
    remainingRecurringVisits: [
      { date: "2026-11-10", time: "08:00", duration: 480 },
      { date: "2026-11-12", time: "08:00", duration: 240 },
    ],
  }
  const later = { ...anchor, id: "vivaz-12", date: "2026-11-12", multiDayIndex: 3, duration: 240, durationType: "hours", durationValue: 4, status: "scheduled" }
  const external = { ...later, id: "external", clientName: "Outro cliente", multiDayGroupId: "", duration: 720, durationValue: 12 }
  let saved: Record<string, unknown> | null = null
  await page.route("**/api/v1/services**", (route) => route.fulfill({ json: { success: true, data: [{ ...serviceFixture, dailyScheduleLimitHours: 16 }] } }))
  await page.route("**/api/v1/schedules**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === "PATCH" && path.endsWith("/vivaz-10")) {
      saved = route.request().postDataJSON()
      return route.fulfill({ json: { success: true, data: anchor } })
    }
    if (route.request().method() === "GET" && path.endsWith("/schedules")) return route.fulfill({ json: { success: true, data: [anchor, later, external] } })
    return route.fallback()
  })
  await page.goto("/agendamentos")
  const row = page.getByRole("row").filter({ hasText: "Vivaz Ecoville" }).filter({ hasText: "10/11/2026" })
  await row.getByRole("button", { name: "Abrir ações do agendamento de Vivaz Ecoville" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar atendimento recorrente" })
  await dialog.getByLabel("Duração do agendamento", { exact: true }).fill("3")
  await dialog.getByRole("combobox", { name: "Tipo de duração do Dia 1" }).click()
  await page.getByRole("option", { name: "Dias", exact: true }).click()
  await dialog.getByLabel("Duração do Dia 1", { exact: true }).fill("2")
  await expect(dialog.getByRole("button", { name: "Dia 2", exact: true })).toHaveText("12/11/2026")
  await expect(dialog.getByRole("button", { name: "Dia 3", exact: true })).toHaveCount(0)
  await expect(dialog.getByLabel("Duração do Dia 2", { exact: true })).toHaveValue("4")
  await dialog.getByLabel("Duração do Dia 2", { exact: true }).fill("8")
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect(page.getByText(/limite de 16 horas.*12\/11\/2026/)).toBeVisible()
  expect(saved).toBeNull()
  await dialog.getByLabel("Duração do Dia 2", { exact: true }).fill("4")
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => saved).toMatchObject({
    multiDayDates: ["2026-11-10", "2026-11-11", "2026-11-12"], multiDayDurations: [480, 480, 240],
  })
})

test("capacidade e técnico consideram somente as horas de cada visita", () => {
  const formData = { multiDayDates: ["2026-11-09", "2026-11-11"], multiDayTimes: ["08:00", "08:00"], multiDayDurations: [240, 180], date: "2026-11-09", time: "08:00", duration: 2, durationType: "days" as const, teamIds: [], employeeIds: ["tecnico"] }
  const afternoon = { ...scheduleFixture, id: "afternoon", date: "2026-11-11", time: "13:00", duration: 240, durationValue: 4, durationType: "hours", additionalEmployees: [{ id: "tecnico", name: "Técnico" }], teams: [] } as unknown as ScheduleRecord
  expect(checkScheduleAvailability({ schedules: [afternoon], teams: [], formData, mode: "manual" }).available).toBe(true)
  expect(checkScheduleAvailability({ schedules: [{ ...afternoon, time: "10:00" }], teams: [], formData, mode: "manual" }).available).toBe(false)
  const existing = { ...afternoon, date: "2026-11-09", time: "08:00", duration: 720, durationValue: 12 }
  const capacity = { schedules: [existing], serviceTypes: [{ id: serviceFixture.id, dailyScheduleLimitHours: 16 }], serviceTypeIds: [serviceFixture.id], ...formData, durationMinutes: 960 }
  expect(getDailyServiceCapacityViolation(capacity)).toBeNull()
  expect(getDailyServiceCapacityViolation({ ...capacity, multiDayDurations: [300, 180] })?.requestedMinutes).toBe(300)
  const main = { ...afternoon, date: formData.date, multiDayIndex: 1, multiDayTotal: 2, multiDayDates: formData.multiDayDates, multiDayTimes: formData.multiDayTimes, multiDayDurations: formData.multiDayDurations }
  const visits = getScheduleRescheduleVisitFields(main, "2026-11-16")
  expect(visits.multiDayDates).toEqual(["2026-11-16", "2026-11-18"])
  expect(checkScheduleAvailability({ schedules: [{ ...afternoon, date: "2026-11-18" }], teams: [], formData: { ...formData, ...visits, date: "2026-11-16" }, mode: "manual" }).available).toBe(true)
})

test("o encerramento carrega um tipo novo e calcula o preço configurado", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  const current = { ...scheduleFixture, date: "2026-11-05", status: "in_progress", completionStartDate: "2026-11-05", completionStartTime: "08:00", naAttachments: [{ fileName: "na.pdf", documentUrl: "/files/na.pdf" }] }
  await page.route("**/api/v1/schedules**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/disposal-catalog")) return route.fulfill({ json: { success: true, data: { types: [{ id: "lodo", name: "Lodo", items: [{ id: "nova", name: "Estação nova", unitPrice: 37.5 }] }] } } })
    if (route.request().method() === "GET" && path.endsWith("/schedules")) return route.fulfill({ json: { success: true, data: [current] } })
    return route.fallback()
  })
  await page.goto("/agenda?date=2026-11-05")
  await page.getByRole("button", { name: /Condomínio E2E/ }).click()
  await page.getByRole("button", { name: "Encerrar atendimento", exact: true }).click()
  await page.getByRole("combobox", { name: "Selecione o tipo de descarte", exact: true }).click()
  await page.getByRole("option", { name: "Lodo", exact: true }).click()
  await page.getByRole("combobox", { name: "Selecione a estação", exact: true }).click()
  await page.getByRole("option", { name: /Estação nova.*37,50/ }).click()
  await page.getByLabel("Quantidade (M³) *", { exact: true }).fill("2,5")
  await expect(page.getByText("Valor: R$ 93,75", { exact: true })).toBeVisible()
})
