import { expect, test } from "@playwright/test"
import ExcelJS from "exceljs"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("exporta o planejamento e todas as informações da execução por agendamento", async ({ page }) => {
  test.setTimeout(90_000)

  await page.route("**/api/v1/analytics/reports**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: {
          dashboardStats: {
            completedServices: 1,
            scheduledServices: 0,
            cancelledServices: 0,
            emergencyServices: 0,
            completionRate: 100,
          },
          servicesByPeriodData: [],
          servicesSummaryData: [],
          servicesParticipationData: [],
          serviceClientSummary: [],
          scheduleDetails: [{
            id: "schedule-completed",
            scheduledDate: "2026-08-03",
            scheduledTime: "08:00",
            clientId: "client-e2e",
            clientName: "Condomínio E2E",
            unitId: "unit-e2e",
            unitName: "Matriz",
            contractId: "contract-e2e",
            contractNumber: "LEG-000123",
            serviceIds: ["service-e2e"],
            serviceNames: ["Limpeza de fossa"],
            teamIds: ["team-e2e"],
            teamNames: ["Equipe E2E"],
            employeeIds: ["employee-e2e"],
            employeeNames: ["Funcionário Agendado"],
            estimatedDuration: 480,
            durationValue: 1,
            durationType: "days",
            status: "completed",
            isEmergency: false,
            isManual: false,
            billable: true,
            value: 950,
            completionStartDate: "2026-08-03",
            completionStartTime: "09:00",
            completionEndDate: "2026-08-03",
            completionEndTime: "15:30",
            executionDurationMinutes: 390,
            serviceReport: "Atendimento concluído sem intercorrências.",
            attendanceDriver: { id: "driver-e2e", name: "Motorista E2E" },
            attendanceHelpers: [{ id: "helper-e2e", name: "Ajudante E2E" }],
            attendanceVehiclePlate: "ABC1D23",
            attendanceDisposal: {
              mtrNumber: "001234567890",
              type: "fossa",
              stationId: "tratho-efluentes",
              stationName: "TRATHO EFLUENTES",
              unitPrice: 19,
              quantityM3: 32,
              totalValue: 608,
            },
          }],
          services: [{ id: "service-e2e", name: "Limpeza de fossa", isActive: true }],
        },
      }),
    })
  })
  await page.addInitScript(() => {
    const createObjectUrl = URL.createObjectURL.bind(URL)
    URL.createObjectURL = ((object: Blob | MediaSource) => {
      if (object instanceof Blob && object.type.startsWith("image/svg+xml")) {
        return "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1'%20height='1'%3E%3C/svg%3E"
      }
      return createObjectUrl(object)
    }) as typeof URL.createObjectURL
  })

  await page.goto("/relatorios?tab=services")
  const downloadPromise = Promise.race([
    page.waitForEvent("download"),
    page.waitForEvent("pageerror").then((error) => Promise.reject(error)),
  ])
  await page.getByRole("button", { name: "Gerar relatório" }).click()
  const download = await downloadPromise
  const downloadPath = await download.path()

  expect(downloadPath).toBeTruthy()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(downloadPath!)
  const sheet = workbook.getWorksheet("Dados")
  expect(sheet).toBeTruthy()

  let headerRowNumber = 0
  sheet!.eachRow((row) => {
    if (row.getCell(1).value === "Data agendada") headerRowNumber = row.number
  })
  expect(headerRowNumber).toBeGreaterThan(0)

  const headers = Array.from(sheet!.getRow(headerRowNumber).values as ExcelJS.CellValue[]).slice(1).map(String)
  const values = Array.from(sheet!.getRow(headerRowNumber + 1).values as ExcelJS.CellValue[]).slice(1)
  const exported = Object.fromEntries(headers.map((header, index) => [header, values[index]]))

  expect(exported).toMatchObject({
    "Data agendada": "03/08/2026",
    "Horário agendado": "08:00",
    "Tempo agendado": "1 dia",
    "Início da execução": "03/08/2026 às 09:00",
    "Fim da execução": "03/08/2026 às 15:30",
    "Tempo de execução": "6 horas e 30 minutos",
    Motorista: "Motorista E2E",
    Ajudantes: "Ajudante E2E",
    "Placa do veículo": "ABC1D23",
    "Observações do atendimento": "Atendimento concluído sem intercorrências.",
    "N° de MTR": "001234567890",
    "Tipo de descarte": "Fossa",
    "Quantidade do descarte (m³)": 32,
    "Estação de descarte": "TRATHO EFLUENTES",
    "Valor unitário do descarte": 19,
    "Valor total do descarte": 608,
  })
  expect(headers).not.toContain("Anexos da execução")
})
