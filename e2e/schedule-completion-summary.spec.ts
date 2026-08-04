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
  const inProgressSchedule = {
    ...scheduleFixture,
    date,
    status: "in_progress" as const,
    completionStartDate: date,
    completionStartTime: "08:00",
    naAttachments: [{ fileName: "na-e2e.pdf", documentUrl: "/files/na-e2e.pdf" }],
    attendanceDriver: null,
    attendanceHelpers: [],
  }
  let completionPayload: Record<string, unknown> | null = null

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
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Dados do atendimento" })).toBeVisible()

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
  const date = todayKey()
  const completedSchedule = {
    ...scheduleFixture,
    date,
    status: "completed" as const,
    completionStartDate: date,
    completionStartTime: "08:00",
    completionEndDate: date,
    completionEndTime: "10:30",
    serviceReport: "Atendimento concluído sem intercorrências.",
    attendanceDriver: { id: "employee-driver", name: "Motorista E2E" },
    attendanceHelpers: [
      { id: "employee-helper-1", name: "Ajudante Um" },
      { id: "employee-helper-2", name: "Ajudante Dois" },
    ],
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

    if (request.method() === "GET" && path.endsWith(`/schedules/${completedSchedule.id}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: completedSchedule }),
      })
      return
    }

    if (request.method() === "GET" && path.endsWith("/schedules")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [completedSchedule] }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/agenda?date=${date}&scheduleId=${completedSchedule.id}`)

  await expect(page.getByText("Motorista E2E", { exact: true })).toBeVisible()
  await expect(page.getByText("Ajudante Um • Ajudante Dois", { exact: true })).toBeVisible()
  await expect(page.getByText("Atendimento concluído sem intercorrências.", { exact: true })).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Exportar", exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(`resumo-agendamento-e2e-${date}.pdf`)
})
