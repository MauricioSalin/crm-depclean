import { expect, test, type Page, type Route } from "@playwright/test"

import {
  contractFixture,
  installApiMock,
  scheduleFixture,
  serviceFixture,
  teamFixture,
} from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import { getApiErrorMessage } from "../lib/api/errors"

const FIXED_NOW = new Date("2026-07-28T12:00:00.000Z")
const API_TIMESTAMP = FIXED_NOW.toISOString()
const inspectionService = {
  ...serviceFixture,
  id: "service-inspection",
  name: "Inspeção preventiva",
  defaultDuration: 1,
  durationType: "hours",
  defaultRecurrence: "quarterly",
  dailyScheduleLimit: null,
}
const inspectionContractService = {
  ...contractFixture.services[0],
  id: "contract-service-inspection",
  serviceTypeId: inspectionService.id,
  recurrence: "quarterly",
  duration: 1,
  durationType: "hours" as const,
}

const planItems = [
  {
    ...scheduleFixture,
    id: "schedule-plan-network",
    contractId: contractFixture.id,
    serviceTypeName: "Limpeza de rede",
    teams: [],
    additionalEmployees: [],
    date: "2026-08-14",
    time: "08:00",
  },
  {
    ...scheduleFixture,
    id: "schedule-plan-inspection",
    contractId: contractFixture.id,
    contractServiceId: inspectionContractService.id,
    contractServiceIds: [inspectionContractService.id],
    serviceTypeId: inspectionService.id,
    serviceTypeIds: [inspectionService.id],
    serviceTypeName: "Inspeção preventiva",
    duration: 60,
    durationValue: 1,
    durationType: "hours",
    date: "2026-09-14",
    time: "08:00",
  },
]

const occupiedSchedule = {
  ...scheduleFixture,
  id: "schedule-other-contract",
  contractId: "contract-other",
  serviceTypeId: "service-other",
  serviceTypeIds: ["service-other"],
  serviceTypeName: "Outro serviço",
  teams: [{ id: teamFixture.id, name: teamFixture.name, color: teamFixture.color }],
  additionalEmployees: [],
  date: "2026-08-13",
  time: "08:00",
}

const limitSchedule = {
  ...scheduleFixture,
  id: "schedule-service-limit",
  contractId: "contract-limit",
  teams: [],
  additionalEmployees: [],
  date: "2026-08-12",
  time: "08:00",
  duration: 360,
  durationValue: 6,
  durationType: "hours",
}

const overflowLimitSchedule = {
  ...limitSchedule,
  id: "schedule-service-limit-overflow",
  date: "2026-08-11",
  duration: 420,
  durationValue: 7,
}

const resourceConflictSchedule = {
  ...scheduleFixture,
  id: "schedule-resource-conflict",
  contractId: "contract-resource-conflict",
  serviceTypeId: "service-other",
  serviceTypeIds: ["service-other"],
  serviceTypeName: "Outro serviço",
  date: "2026-09-15",
  time: "08:00",
  duration: 540,
  durationValue: 9,
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

async function installSchedulePlanMock(page: Page, schedulePlanItems = planItems) {
  const contract = {
    ...contractFixture,
    status: "closed",
    signedAt: "2026-07-28",
    automationCreateSchedules: true,
    automationSchedulePlanSavedAt: API_TIMESTAMP,
    services: [
      {
        ...contractFixture.services[0],
        serviceTypeId: serviceFixture.id,
      },
      inspectionContractService,
    ],
    clicksign: {
      envelopeId: "envelope-e2e",
      documentKey: "document-e2e",
      documentId: "document-e2e",
      folderId: "folder-e2e",
      webhookId: "",
      status: "closed",
      signers: [],
    },
  }
  let savedPayload: {
    items: Array<{
      id: string
      contractServiceId: string
      contractServiceIds: string[]
      date: string
      time: string
      durationValue: number
      durationType: string
      teamIds: string[]
      additionalEmployeeIds: string[]
    }>
  } | null = null

  await page.route("**/api/v1/contracts/contract-e2e/schedule-plan", async (route) => {
    if (route.request().method() === "PATCH") {
      savedPayload = route.request().postDataJSON()
      const savedItems = savedPayload!.items.map((payloadItem) => {
        const source = schedulePlanItems.find((item) => item.id === payloadItem.id) ??
          schedulePlanItems.find((item) => item.contractServiceId === payloadItem.contractServiceId) ??
          schedulePlanItems[0]
        return {
          ...source,
          id: payloadItem.id,
          contractServiceId: payloadItem.contractServiceId,
          contractServiceIds: payloadItem.contractServiceIds,
          date: payloadItem.date,
          time: payloadItem.time,
          durationValue: payloadItem.durationValue,
          durationType: payloadItem.durationType,
          teams: payloadItem.teamIds.includes(teamFixture.id)
            ? [{ id: teamFixture.id, name: teamFixture.name, color: teamFixture.color }]
            : [],
          additionalEmployees: [],
        }
      })
      await fulfill(route, {
        items: savedItems,
        generatedItems: schedulePlanItems,
        anchorDate: "2026-07-31",
        endDate: "2027-07-28",
        isSaved: true,
        savedAt: API_TIMESTAMP,
        isPublished: false,
      })
      return
    }

    await fulfill(route, {
      items: schedulePlanItems,
      generatedItems: schedulePlanItems,
      anchorDate: "2026-07-31",
      endDate: "2027-07-28",
      isSaved: true,
      savedAt: API_TIMESTAMP,
      isPublished: false,
    })
  })

  await page.route("**/api/v1/contracts**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (path !== "/contracts" && path !== `/contracts/${contract.id}`) {
      await route.fallback()
      return
    }
    await fulfill(route, path === "/contracts" ? [contract] : contract)
  })

  await page.route("**/api/v1/schedules**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (route.request().method() !== "GET" || path !== "/schedules") {
      await route.fallback()
      return
    }
    await fulfill(route, [occupiedSchedule, limitSchedule, overflowLimitSchedule, resourceConflictSchedule])
  })

  await page.route("**/api/v1/services**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (route.request().method() !== "GET" || path !== "/services") {
      await route.fallback()
      return
    }
    await fulfill(route, [
      { ...serviceFixture, name: "Limpeza de rede", dailyScheduleLimitHours: 8 },
      inspectionService,
    ])
  })

  return {
    getSavedPayload: () => savedPayload,
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("resume listas extensas de validação sem despejar detalhes técnicos no toast", () => {
  const fallback = "Não foi possível salvar o plano de agendamentos."
  const message = getApiErrorMessage({
    isAxiosError: true,
    config: { url: "/contracts/contract-e2e/schedule-plan" },
    response: {
      status: 400,
      data: {
        message: [
          "items.0.property contractServiceIds should not exist",
          "items.1.property contractServiceIds should not exist",
        ],
      },
    },
  }, fallback)

  expect(message).toBe(fallback)
})

test("exibe dezesseis horas da automação futura como dois dias", async ({ page }) => {
  await installSchedulePlanMock(page, [{
    ...planItems[0],
    duration: 16 * 60,
    durationValue: 16,
    durationType: "hours",
  }])

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Agendamentos", exact: true }).click()

  const row = page.getByRole("dialog", { name: "Agendamentos previstos" })
    .locator('[data-schedule-id="schedule-plan-network"]')
  await expect(row.getByRole("textbox", { name: "Duração de Limpeza de rede" })).toHaveValue("2")
  await expect(row.locator('[data-slot="select-trigger"]').filter({ hasText: "Dias" })).toBeVisible()
})

test("libera hoje para linha sem responsável e permite excluí-la do plano", async ({ page }) => {
  const schedulePlanMock = await installSchedulePlanMock(page)

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Agendamentos", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Agendamentos previstos" })
  await expect(dialog.getByRole("columnheader", { name: "Local" })).toHaveCount(0)
  const networkRow = dialog.locator('[data-schedule-id="schedule-plan-network"]')
  await networkRow.getByRole("button", { name: "14/08/2026" }).click()

  const augustEleventh = page.getByRole("button", { name: /11 de agosto de 2026/i })
  await augustEleventh.locator("..").hover()
  await expect(page.getByRole("tooltip")).toHaveText("O limite de 8 horas do serviço Limpeza de rede seria ultrapassado em 11/08/2026.")

  await page.locator('[data-slot="calendar"] .rdp-button_previous').click()
  const today = page.getByRole("button", { name: /28 de julho de 2026/i })
  await expect(today).toBeEnabled()
  await today.click()
  await expect(networkRow.getByRole("button", { name: "28/07/2026" })).toBeVisible()

  const inspectionRow = dialog.locator('[data-schedule-id="schedule-plan-inspection"]')
  const deleteInspectionButton = inspectionRow.getByRole("button", { name: "Excluir Inspeção preventiva do plano" })
  await expect(deleteInspectionButton).toHaveText("")
  await deleteInspectionButton.click()
  await expect(inspectionRow).toHaveCount(0)

  await dialog.getByRole("button", { name: "Salvar agendamentos" }).click()
  await expect.poll(() => schedulePlanMock.getSavedPayload()).toEqual({
    items: [{
      id: "schedule-plan-network",
      contractServiceId: "contract-service-e2e",
      contractServiceIds: ["contract-service-e2e"],
      date: "2026-07-28",
      time: "09:00",
      durationValue: 2,
      durationType: "hours",
      teamIds: [],
      additionalEmployeeIds: [],
    }],
  })
})

test("atribui uma equipe a uma ocorrência do plano e persiste a escolha", async ({ page }) => {
  const schedulePlanMock = await installSchedulePlanMock(page)

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Agendamentos", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Agendamentos previstos" })
  await expect(dialog.getByRole("columnheader", { name: "Equipes / Funcionários" })).toBeVisible()
  const networkRow = dialog.locator('[data-schedule-id="schedule-plan-network"]')
  await expect(networkRow.getByText("Nenhum", { exact: true })).toBeVisible()
  await networkRow
    .getByRole("button", { name: "Adicionar equipes e funcionários ao agendamento de Limpeza de rede" })
    .click()

  const assigneeDialog = page.getByRole("dialog", { name: "Editar Equipes e Funcionários" })
  await assigneeDialog.getByRole("combobox", { name: "Equipes do agendamento" }).click()
  await page.getByRole("option", { name: teamFixture.name }).click()
  await page.keyboard.press("Escape")
  await assigneeDialog.getByRole("button", { name: "Concluir" }).click()

  await expect(networkRow.getByText(teamFixture.name, { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "Salvar agendamentos" }).click()
  await expect.poll(() => schedulePlanMock.getSavedPayload()).not.toBeNull()
  expect(schedulePlanMock.getSavedPayload()!.items.find((item) => item.id === "schedule-plan-network")).toMatchObject({
    teamIds: [teamFixture.id],
    additionalEmployeeIds: [],
  })
})

test("edita serviços em badges, monta pacote e configura nova ocorrência", async ({ page }) => {
  const schedulePlanMock = await installSchedulePlanMock(page)

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Agendamentos", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Agendamentos previstos" })
  const networkRow = dialog.locator('[data-schedule-id="schedule-plan-network"]')
  const networkDurationInput = networkRow.getByRole("textbox", { name: "Duração de Limpeza de rede" })
  await networkRow.hover()
  await expect(networkRow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await expect(networkRow.getByRole("button", { name: "14/08/2026" })).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await expect(networkDurationInput).toHaveCSS("background-color", "rgb(255, 255, 255)")
  const initialDuration = await networkDurationInput.inputValue()
  await networkDurationInput.pressSequentially(",")
  await expect(networkDurationInput).toHaveValue(initialDuration)
  for (const trigger of await networkRow.locator('[data-slot="select-trigger"]').all()) {
    await expect(trigger).toHaveCSS("background-color", "rgb(255, 255, 255)")
  }
  await expect(networkRow.locator("td").nth(2).locator("p")).toHaveCount(0)
  const tableServiceBadge = networkRow.locator('[data-slot="badge"]').filter({ hasText: "Limpeza de rede" })
  await expect(tableServiceBadge).toHaveClass(/bg-secondary/)
  await networkRow.getByRole("button", { name: "Editar serviços de Limpeza de rede" }).click()
  const servicesDialog = page.getByRole("dialog", { name: "Editar serviços do agendamento" })
  await expect(servicesDialog.getByRole("combobox", { name: "Serviços do agendamento" })).toHaveCSS("background-color", "rgb(255, 255, 255)")
  const modalServiceBadge = servicesDialog.locator('[data-slot="badge"]').filter({ hasText: "Limpeza de rede" })
  await expect(modalServiceBadge).toHaveClass(/bg-secondary/)
  const totalDuration = servicesDialog.getByText(/Duração total:/)
  await expect(totalDuration).toBeVisible()
  await expect(totalDuration).toHaveCSS("border-top-width", "0px")
  await expect(servicesDialog.getByText(/Duração do pacote:/)).toHaveCount(0)
  await servicesDialog.getByRole("combobox", { name: "Serviços do agendamento" }).click()
  await page.getByRole("option", { name: "Inspeção preventiva" }).click()
  await page.keyboard.press("Escape")
  await servicesDialog.getByRole("button", { name: "Concluir" }).click()
  await expect(networkRow.getByText("Limpeza de rede", { exact: true })).toBeVisible()
  await expect(networkRow.getByText("Inspeção preventiva", { exact: true })).toBeVisible()
  const networkPackageDuration = networkRow.getByRole("textbox", { name: /Duração de/ })
  await expect(networkPackageDuration).toBeEnabled()
  await expect(networkRow.locator("td").nth(2).locator('[data-slot="select-trigger"]')).toBeEnabled()
  await networkPackageDuration.fill("4")
  await networkPackageDuration.press("Tab")
  await expect(networkPackageDuration).toHaveValue("4")

  await dialog.getByRole("button", { name: "Adicionar novo" }).click()
  const addedRow = dialog.locator('[data-schedule-id^="sched-added-"]')
  await expect(addedRow).toBeVisible()
  await expect(addedRow.getByRole("button", { name: "Selecionar data" })).toBeVisible()
  await expect(addedRow.getByText("Nenhum", { exact: true })).toBeVisible()
  await expect(page.getByText("Não há horário disponível hoje para o serviço selecionado.")).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: "Exportar" })).toBeDisabled()
  await expect(dialog.getByRole("button", { name: "Salvar agendamentos" })).toBeDisabled()

  await addedRow.getByRole("button", { name: "Editar serviços de Limpeza de rede" }).click()
  await page.getByRole("dialog", { name: "Editar serviços do agendamento" })
    .getByRole("combobox", { name: "Serviços do agendamento" }).click()
  await page.getByRole("option", { name: "Inspeção preventiva" }).click()
  await page.keyboard.press("Escape")
  await page.getByRole("dialog", { name: "Editar serviços do agendamento" })
    .getByRole("button", { name: "Concluir" }).click()
  const addedPackageDuration = addedRow.getByRole("textbox", { name: /Duração de/ })
  await expect(addedPackageDuration).toBeEnabled()
  await expect(addedRow.locator("td").nth(2).locator('[data-slot="select-trigger"]')).toBeEnabled()
  await addedPackageDuration.fill("5")
  await addedPackageDuration.press("Tab")
  await expect(addedPackageDuration).toHaveValue("5")

  await addedRow.getByRole("button", { name: "Selecionar data" }).click()
  await page.getByRole("button", { name: /29 de julho de 2026/i }).click()
  await expect(addedRow.getByRole("button", { name: "29/07/2026" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Exportar" })).toBeEnabled()
  await expect(dialog.getByRole("button", { name: "Salvar agendamentos" })).toBeEnabled()

  await dialog.getByRole("button", { name: "Salvar agendamentos" }).click()
  await expect.poll(() => schedulePlanMock.getSavedPayload()).not.toBeNull()

  const savedItems = schedulePlanMock.getSavedPayload()!.items
  expect(savedItems.find((item) => item.id === "schedule-plan-network")).toMatchObject({
    contractServiceId: "contract-service-e2e",
    contractServiceIds: ["contract-service-e2e", inspectionContractService.id],
    durationValue: 4,
    durationType: "hours",
  })
  expect(savedItems.find((item) => item.id.startsWith("sched-added-"))).toMatchObject({
    contractServiceId: "contract-service-e2e",
    contractServiceIds: ["contract-service-e2e", inspectionContractService.id],
    date: "2026-07-29",
    time: "08:00",
    durationValue: 5,
    durationType: "hours",
  })
})
