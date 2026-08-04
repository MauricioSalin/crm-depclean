import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

function todayKey() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-")
}

const completionEmployees = [
  { id: "employee-driver", name: "Motorista E2E", role: "Motorista", status: "active" },
  { id: "employee-helper-1", name: "Ajudante Um", role: "Auxiliar", status: "active" },
  { id: "employee-helper-2", name: "Ajudante Dois", role: "Auxiliar", status: "active" },
] as const

test("conclui o atendimento com motorista opcional, ajudantes e observações", async ({ page }) => {
  const date = todayKey()
  let inProgressSchedule = {
    ...scheduleFixture,
    date,
    status: "in_progress" as const,
    completionStartDate: date,
    completionStartTime: "08:00",
    naAttachments: [
      { fileName: "na-remover.pdf", documentUrl: "/files/na-remover.pdf" },
      { fileName: "na-manter.pdf", documentUrl: "/files/na-manter.pdf" },
    ],
    attendanceDriver: null,
    attendanceHelpers: [],
  }
  let completionPayload: Record<string, unknown> | null = null
  let deletedNaDocumentUrl = ""

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (request.method() === "GET" && path.endsWith("/schedules/completion-employees")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: completionEmployees }),
      })
      return
    }

    if (request.method() === "GET" && path.endsWith("/schedules")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [inProgressSchedule] }),
      })
      return
    }

    if (request.method() === "DELETE" && path.endsWith(`/schedules/${inProgressSchedule.id}/na`)) {
      deletedNaDocumentUrl = url.searchParams.get("documentUrl") ?? ""
      inProgressSchedule = {
        ...inProgressSchedule,
        naAttachments: inProgressSchedule.naAttachments.filter(
          (attachment) => attachment.documentUrl !== deletedNaDocumentUrl,
        ),
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: inProgressSchedule }),
      })
      return
    }

    if (request.method() === "PATCH" && path.endsWith(`/schedules/${inProgressSchedule.id}/complete`)) {
      completionPayload = request.postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          success: true,
          data: {
            ...inProgressSchedule,
            ...completionPayload,
            status: "completed",
            attendanceDriver: null,
            attendanceHelpers: [
              { id: "employee-helper-1", name: "Ajudante Um" },
              { id: "employee-helper-2", name: "Ajudante Dois" },
            ],
          },
        }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/agenda?date=${date}`)
  await page.getByRole("button", { name: /Condomínio E2E/ }).click()

  await expect(page.getByRole("heading", { name: "NAs do atendimento" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Visualizar na-remover.pdf" })).toBeVisible()
  await expect(page.getByText("Abrir", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Remover na-remover.pdf" }).click()
  const removeDialog = page.getByRole("alertdialog", { name: "Remover NA?" })
  await expect(removeDialog).toBeVisible()
  await removeDialog.getByRole("button", { name: "Remover NA", exact: true }).click()
  await expect.poll(() => deletedNaDocumentUrl).toBe("/files/na-remover.pdf")
  await expect(page.getByText("na-remover.pdf", { exact: true })).toHaveCount(0)
  await expect(page.getByText("na-manter.pdf", { exact: true })).toBeVisible()
  await expect(page.getByText("1 anexo", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ver informações", exact: true }).click()
  const detailsDialog = page.getByRole("dialog", { name: new RegExp(inProgressSchedule.clientName) })
  await expect(detailsDialog.getByText(inProgressSchedule.serviceTypeName, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Voltar para NAs do atendimento" }).click()
  await expect(page.getByRole("heading", { name: "NAs do atendimento" })).toBeVisible()
  await page.getByRole("button", { name: "Encerrar atendimento", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Encerrar atendimento" })).toBeVisible()

  await page.getByLabel("Horário de início *").fill("08:00")
  await page.getByLabel("Horário de fim *").fill("10:30")
  await page.getByRole("combobox", { name: "Selecione o motorista" }).click()
  await expect(page.getByRole("option", { name: "Motorista E2E", exact: true })).toBeVisible()
  await expect(page.getByRole("option", { name: /Motorista E2E.*Motorista/ })).toHaveCount(0)
  await page.keyboard.press("Escape")

  await page.getByRole("combobox", { name: "Selecionar ajudantes" }).click()
  await page.getByRole("option", { name: "Ajudante Um", exact: true }).click()
  await page.getByRole("option", { name: "Ajudante Dois", exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByText("Você pode selecionar mais de um ajudante.")).toHaveCount(0)
  await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Ajudante Um" })).toHaveClass(/bg-secondary/)
  await page.getByLabel("Observações").fill("Atendimento concluído sem intercorrências.")

  await page.getByRole("button", { name: "Confirmar encerramento" }).click()
  await expect.poll(() => completionPayload).not.toBeNull()
  expect(completionPayload).toMatchObject({
    startDate: date,
    startTime: "08:00",
    endDate: date,
    endTime: "10:30",
    driverEmployeeId: "",
    helperEmployeeIds: ["employee-helper-1", "employee-helper-2"],
    serviceReport: "Atendimento concluído sem intercorrências.",
  })
})

test("mostra os dados concluídos e baixa o resumo pelo botão Exportar", async ({ page }) => {
  const date = "2026-08-04"
  const completedSchedule = {
    ...scheduleFixture,
    date,
    time: "07:15",
    status: "completed" as const,
    completionStartDate: "2026-08-03",
    completionStartTime: "08:00",
    completionEndDate: "2026-08-03",
    completionEndTime: "10:30",
    serviceReport: "Atendimento concluído sem intercorrências.",
    attendanceDriver: { id: "employee-driver", name: "Motorista E2E" },
    attendanceHelpers: [
      { id: "employee-helper-1", name: "Ajudante Um" },
      { id: "employee-helper-2", name: "Ajudante Dois" },
    ],
  }
  const completedScheduleWithoutNotes = {
    ...completedSchedule,
    id: "schedule-completed-without-notes",
    clientName: "Cliente sem observações do atendimento",
    serviceReport: "",
  }

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (request.method() === "GET" && path.endsWith(`/schedules/${completedSchedule.id}/summary-pdf`)) {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="resumo-agendamento-e2e-${date}.pdf"`,
          "Access-Control-Expose-Headers": "Content-Disposition",
        },
        body: Buffer.from("%PDF-1.4\n%%EOF\n"),
      })
      return
    }

    const requestedSchedule = [completedSchedule, completedScheduleWithoutNotes]
      .find((schedule) => path.endsWith(`/schedules/${schedule.id}`))
    if (request.method() === "GET" && requestedSchedule) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: requestedSchedule }),
      })
      return
    }

    if (request.method() === "GET" && path.endsWith("/schedules")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [completedSchedule, completedScheduleWithoutNotes] }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/agenda?date=${date}&scheduleId=${completedSchedule.id}`)

  const detailsDialog = page.getByRole("dialog", { name: new RegExp(completedSchedule.clientName) })
  const detailCards = detailsDialog.locator("[data-schedule-detail-card]")
  await expect(detailCards.nth(0)).toHaveAttribute("data-schedule-detail-card", "execution")
  await expect(detailCards.nth(1)).toHaveAttribute("data-schedule-detail-card", "service")
  const executionCard = detailsDialog.locator('[data-schedule-detail-card="execution"]')
  await expect(executionCard).toContainText(
    "03/08/2026 às 08:00 até 03/08/2026 às 10:30",
  )
  const executionNotes = executionCard.locator("[data-schedule-execution-notes]")
  await expect(executionNotes).toHaveCSS("border-top-width", "0px")
  await expect(executionNotes).toContainText("Observações do atendimento")
  await expect(executionNotes).toContainText(
    "Atendimento concluído sem intercorrências.",
  )
  await expect(detailsDialog.locator('[data-schedule-detail-card="scheduled-date"]')).toContainText("04/08/2026")
  await expect(detailsDialog.locator('[data-schedule-detail-card="scheduled-time"]')).toContainText("07:15 • 120 minutos")
  await expect(page.getByText("Motorista E2E", { exact: true })).toBeVisible()
  await expect(page.getByText("Ajudante Um • Ajudante Dois", { exact: true })).toBeVisible()
  await expect(page.getByText("Atendimento concluído sem intercorrências.", { exact: true })).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Exportar", exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(`resumo-agendamento-e2e-${date}.pdf`)

  await page.goto(`/agenda?date=${date}&scheduleId=${completedScheduleWithoutNotes.id}`)
  const emptyNotesDialog = page.getByRole("dialog", { name: new RegExp(completedScheduleWithoutNotes.clientName) })
  const emptyExecutionNotes = emptyNotesDialog.locator("[data-schedule-execution-notes]")
  await expect(emptyExecutionNotes).toContainText("Observações do atendimento")
  await expect(emptyExecutionNotes).toContainText("Nenhuma observação registrada.")
})
