import { expect, test } from "@playwright/test"
import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

for (const entry of ["agenda", "agendamentos"]) {
  test(`o lápis abre e salva a execução parcial em ${entry} mantendo o dia e o status`, async ({ page }) => {
    await installAuthenticatedSession(page)
    await installApiMock(page)
    let current = {
      ...scheduleFixture, id: "porto-gravatai-day-2", clientName: "Condomínio Porto Gravataí",
      status: "partially_completed", date: "2026-11-24", time: "08:00",
      completionStartDate: "2026-11-24", completionStartTime: "09:35",
      completionEndDate: "2026-11-24", completionEndTime: "16:10", executionDurationMinutes: 395,
      naAttachments: [], naDocumentUrl: "", attendanceDisposal: null, attendanceVehiclePlate: "",
      multiDayGroupId: "porto-gravatai", multiDayIndex: 2, multiDayTotal: 2,
    }
    const writes: unknown[] = []
    await page.route("**/api/v1/schedules**", async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname
      const send = (data: unknown) => route.fulfill({ json: { success: true, data } })
      if (request.method() === "PATCH" && pathname.endsWith(`/${current.id}/complete`)) {
        const payload = request.postDataJSON()
        writes.push(payload)
        current = { ...current, completionEndTime: payload.endTime }
        return send(current)
      }
      if (pathname.endsWith("/schedules") || pathname.endsWith("/history")) return send([current])
      if (pathname.endsWith(`/${current.id}`)) return send({ ...current, visits: [current] })
      return route.fallback()
    })
    await page.goto(`/${entry}?date=2026-11-24&view=week&scheduleId=${current.id}`)
    if (entry === "agendamentos") await page.getByRole("row").filter({ hasText: current.clientName }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Editar execução do atendimento", exact: true }).click()
    await expect(dialog.getByText("Editar execução do atendimento", { exact: true })).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Salvar", exact: true })).toBeEnabled()
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0]).toMatchObject({ startDate: "2026-11-24", startTime: "09:35", endDate: "2026-11-24", endTime: "16:10" })
    expect(writes[0]).not.toHaveProperty("partialReason")
    await expect(dialog).toHaveCount(0)
  })
}

test("a execução até 21h ocupa somente o dia 24 na agenda", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  const schedule = { ...scheduleFixture, id: "saint-germain", status: "completed", date: "2026-11-24", time: "19:50", completionStartDate: "2026-11-24", completionStartTime: "19:48", completionEndDate: "2026-11-24", completionEndTime: "21:00", executionDurationMinutes: 72 }
  await page.route("**/api/v1/schedules**", route => route.fulfill({ json: { success: true, data: [schedule] } }))
  await page.goto("/agenda?date=2026-11-24&view=week")
  const event = page.locator('[data-schedule-id="saint-germain"]')
  await expect(event).toHaveCount(1)
  await expect(event).toContainText("19:48 - 21:00")
})
