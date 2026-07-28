import { expect, test, type Page, type Route } from "@playwright/test"

import {
  contractFixture,
  installApiMock,
  scheduleFixture,
  serviceFixture,
  teamFixture,
} from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

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

async function installSchedulePlanMock(page: Page) {
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
      date: string
      time: string
      durationValue: number
      durationType: string
    }>
  } | null = null

  await page.route("**/api/v1/contracts/contract-e2e/schedule-plan", async (route) => {
    if (route.request().method() === "PATCH") {
      savedPayload = route.request().postDataJSON()
      const savedItems = savedPayload!.items.map((payloadItem) => {
        const source = planItems.find((item) => item.id === payloadItem.id) ??
          planItems.find((item) => item.contractServiceId === payloadItem.contractServiceId) ??
          planItems[0]
        return {
          ...source,
          id: payloadItem.id,
          contractServiceId: payloadItem.contractServiceId,
          contractServiceIds: [payloadItem.contractServiceId],
          date: payloadItem.date,
          time: payloadItem.time,
          durationValue: payloadItem.durationValue,
          durationType: payloadItem.durationType,
        }
      })
      await fulfill(route, {
        items: savedItems,
        generatedItems: planItems,
        anchorDate: "2026-07-31",
        endDate: "2027-07-28",
        isSaved: true,
        savedAt: API_TIMESTAMP,
        isPublished: false,
      })
      return
    }

    await fulfill(route, {
      items: planItems,
      generatedItems: planItems,
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
    await fulfill(route, [occupiedSchedule, limitSchedule, resourceConflictSchedule])
  })

  await page.route("**/api/v1/services**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (route.request().method() !== "GET" || path !== "/services") {
      await route.fallback()
      return
    }
    await fulfill(route, [
      { ...serviceFixture, name: "Limpeza de rede", dailyScheduleLimit: 1 },
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

test("libera data para linha sem responsável e permite excluí-la do plano", async ({ page }) => {
  const schedulePlanMock = await installSchedulePlanMock(page)

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Agendamentos", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Agendamentos previstos" })
  await expect(dialog.getByRole("columnheader", { name: "Local" })).toHaveCount(0)
  const networkRow = dialog.locator('[data-schedule-id="schedule-plan-network"]')
  await networkRow.getByRole("button", { name: "14/08/2026" }).click()

  const augustTwelfth = page.getByRole("button", { name: /12 de agosto de 2026/i })
  await augustTwelfth.locator("..").hover()
  await expect(page.getByRole("tooltip")).toHaveText("Limite atingido")

  const augustThirteenth = page.getByRole("button", { name: /13 de agosto de 2026/i })
  await expect(augustThirteenth).toBeEnabled()
  await augustThirteenth.click()
  await expect(networkRow.getByRole("button", { name: "13/08/2026" })).toBeVisible()

  const inspectionRow = dialog.locator('[data-schedule-id="schedule-plan-inspection"]')
  await inspectionRow.getByRole("button", { name: "14/09/2026" }).click()
  const septemberFifteenth = page.getByRole("button", { name: /15 de setembro de 2026/i })
  await septemberFifteenth.locator("..").hover()
  await expect(page.getByRole("tooltip")).toHaveText("Horário indisponível")
  await page.keyboard.press("Escape")

  const deleteInspectionButton = inspectionRow.getByRole("button", { name: "Excluir Inspeção preventiva do plano" })
  await expect(deleteInspectionButton).toHaveText("")
  await deleteInspectionButton.click()
  await expect(inspectionRow).toHaveCount(0)

  await dialog.getByRole("button", { name: "Salvar agendamentos" }).click()
  await expect.poll(() => schedulePlanMock.getSavedPayload()).toEqual({
    items: [{
      id: "schedule-plan-network",
      contractServiceId: "contract-service-e2e",
      date: "2026-08-13",
      time: "08:00",
      durationValue: 120,
      durationType: "minutes",
    }],
  })
})

test("adiciona uma ocorrência sem data e permite configurá-la antes de salvar", async ({ page }) => {
  const schedulePlanMock = await installSchedulePlanMock(page)

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Agendamentos", exact: true }).click()

  const dialog = page.getByRole("dialog", { name: "Agendamentos previstos" })
  const networkRow = dialog.locator('[data-schedule-id="schedule-plan-network"]')
  await networkRow.getByRole("combobox", { name: "Serviço de Limpeza de rede" }).click()
  await page.getByRole("option", { name: "Inspeção preventiva" }).click()
  await expect(networkRow.getByRole("combobox", { name: "Serviço de Inspeção preventiva" })).toBeVisible()

  await dialog.getByRole("button", { name: "Adicionar novo" }).click()
  const addedRow = dialog.locator('[data-schedule-id^="sched-added-"]')
  await expect(addedRow).toBeVisible()
  await expect(addedRow.getByRole("button", { name: "Selecionar data" })).toBeVisible()
  await expect(addedRow.getByText("-", { exact: true })).toBeVisible()
  await expect(page.getByText("Não há horário disponível hoje para o serviço selecionado.")).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: "Exportar" })).toBeDisabled()
  await expect(dialog.getByRole("button", { name: "Salvar agendamentos" })).toBeDisabled()

  await addedRow.getByRole("combobox", { name: "Serviço de Limpeza de rede" }).click()
  await page.getByRole("option", { name: "Inspeção preventiva" }).click()
  await expect(addedRow.getByRole("textbox", { name: "Duração de Inspeção preventiva" })).toHaveValue("1")

  await addedRow.getByRole("button", { name: "Selecionar data" }).click()
  await page.getByRole("button", { name: /29 de julho de 2026/i }).click()
  await expect(addedRow.getByRole("button", { name: "29/07/2026" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Exportar" })).toBeEnabled()
  await expect(dialog.getByRole("button", { name: "Salvar agendamentos" })).toBeEnabled()

  await dialog.getByRole("button", { name: "Salvar agendamentos" }).click()
  await expect.poll(() => schedulePlanMock.getSavedPayload()).not.toBeNull()

  const savedItems = schedulePlanMock.getSavedPayload()!.items
  expect(savedItems.find((item) => item.id === "schedule-plan-network")).toMatchObject({
    contractServiceId: inspectionContractService.id,
    durationValue: 1,
    durationType: "hours",
  })
  expect(savedItems.find((item) => item.id.startsWith("sched-added-"))).toMatchObject({
    contractServiceId: inspectionContractService.id,
    date: "2026-07-29",
    time: "08:00",
    durationValue: 1,
    durationType: "hours",
  })
})
