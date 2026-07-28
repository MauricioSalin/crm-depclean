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
    serviceTypeName: "Inspeção preventiva",
    teams: [],
    additionalEmployees: [],
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
  let savedPayload: { items: Array<{ id: string; date: string; time: string }> } | null = null

  await page.route("**/api/v1/contracts/contract-e2e/schedule-plan", async (route) => {
    if (route.request().method() === "PATCH") {
      savedPayload = route.request().postDataJSON()
      const savedItems = savedPayload!.items.map((payloadItem) => {
        const source = planItems.find((item) => item.id === payloadItem.id)!
        return { ...source, date: payloadItem.date, time: payloadItem.time }
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
    await fulfill(route, [occupiedSchedule])
  })

  await page.route("**/api/v1/services**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (route.request().method() !== "GET" || path !== "/services") {
      await route.fallback()
      return
    }
    await fulfill(route, [{ ...serviceFixture, name: "Limpeza de rede", dailyScheduleLimit: 1 }])
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
  const networkRow = dialog.getByRole("row").filter({ hasText: "Limpeza de rede" })
  await networkRow.getByRole("button", { name: "14/08/2026" }).click()

  const augustThirteenth = page.getByRole("button", { name: /13 de agosto de 2026/i })
  await expect(augustThirteenth).toBeEnabled()
  await augustThirteenth.click()
  await expect(networkRow.getByRole("button", { name: "13/08/2026" })).toBeVisible()

  const inspectionRow = dialog.getByRole("row").filter({ hasText: "Inspeção preventiva" })
  await inspectionRow.getByRole("button", { name: "Excluir Inspeção preventiva do plano" }).click()
  await expect(inspectionRow).toHaveCount(0)

  await dialog.getByRole("button", { name: "Salvar agendamentos" }).click()
  await expect.poll(() => schedulePlanMock.getSavedPayload()).toEqual({
    items: [{
      id: "schedule-plan-network",
      date: "2026-08-13",
      time: "08:00",
      durationValue: 120,
      durationType: "minutes",
    }],
  })
})
