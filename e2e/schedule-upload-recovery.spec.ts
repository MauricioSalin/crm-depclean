import { expect, test } from "@playwright/test"
import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import type { ScheduleNaAttachmentRecord } from "@/lib/api/schedules"

for (const pagePath of ["/agenda", "/agendamentos", "/"]) {
for (const savedBeforeError of [false, true]) {
  test(`recupera upload parcial sem reenviar anexos salvos (${pagePath}, ${savedBeforeError ? "resposta perdida" : "interrompido"})`, async ({ page }) => {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
    let schedule = { ...scheduleFixture, date, status: "in_progress" as const, completionStartDate: date,
      completionStartTime: "08:00", naAttachments: [] as ScheduleNaAttachmentRecord[] }
    const attempts: string[] = []
    const files = ["primeiro.pdf", "segundo.pdf", "terceiro.pdf"].map((name) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(name) }))
    await installAuthenticatedSession(page)
    await installApiMock(page)
    await page.route("**/api/v1/schedules**", async (route) => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname
      if (request.method() === "GET" && (pathname.endsWith("/schedules") || pathname.endsWith(`/schedules/${schedule.id}`))) {
        await route.fulfill({ json: { success: true, data: pathname.endsWith("/schedules") ? [schedule] : schedule } })
        return
      }
      if (request.method() === "POST" && pathname.endsWith(`/schedules/${schedule.id}/na`)) {
        const file = files.find((item) => request.postDataBuffer()?.includes(Buffer.from(item.name)))!
        attempts.push(file.name)
        const fail = file.name === "segundo.pdf" && attempts.length === 2
        if (!fail || savedBeforeError) {
          schedule = { ...schedule, naAttachments: [...schedule.naAttachments, {
            fileName: file.name, fileSize: file.buffer.length, mimeType: file.mimeType, documentUrl: `/files/${file.name}`,
          }] }
        }
        if (!fail) return route.fulfill({ json: { success: true, data: schedule } })
        await route.fulfill(savedBeforeError
          ? { status: 500, json: { message: "Premature close" } }
          : { status: 400, json: { message: "O envio foi interrompido. Confira sua conexão e tente enviar novamente." } })
        return
      }
      await route.fallback()
    })
    await page.goto(`${pagePath}?date=${date}`)
    if (pagePath === "/agendamentos") {
      await page.getByRole("row").filter({ hasText: "Condomínio E2E" }).click()
    } else if (pagePath === "/") {
      await page.getByRole("region", { name: "Hoje", exact: true }).getByRole("button", { name: /Condomínio E2E/ }).click()
    } else {
      await page.getByRole("button", { name: /Condomínio E2E/ }).click()
    }
    await page.getByTestId("schedule-attachment-file-input").setInputFiles(files)
    await expect(page.getByRole("button", { name: "Reenviar pendentes", exact: true })).toBeVisible()
    await expect(page.getByText("O envio foi interrompido. Confira sua conexão e tente enviar novamente.", { exact: true })).toBeVisible()
    expect(attempts).toEqual(["primeiro.pdf", "segundo.pdf"])
    await page.getByRole("button", { name: "Reenviar pendentes", exact: true }).click()
    await expect(page.getByRole("button", { name: "Reenviar pendentes", exact: true })).toHaveCount(0)
    await expect(page.getByText("3 anexos", { exact: true })).toBeVisible()
    expect(attempts).toEqual(savedBeforeError
      ? ["primeiro.pdf", "segundo.pdf", "terceiro.pdf"]
      : ["primeiro.pdf", "segundo.pdf", "segundo.pdf", "terceiro.pdf"])
  })
}
}

test("libera a baixa quando o upload fica sem resposta", async ({ page }) => {
  await page.clock.install()
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
  let schedule = { ...scheduleFixture, date, status: "in_progress" as const, completionStartDate: date,
    completionStartTime: "08:00", naAttachments: [] as ScheduleNaAttachmentRecord[] }
  let attempts = 0
  let releaseFirstUpload: () => void = () => undefined
  const stalled = new Promise<void>((resolve) => { releaseFirstUpload = resolve })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === "GET" && (pathname.endsWith("/schedules") || pathname.endsWith(`/schedules/${schedule.id}`))) {
      return route.fulfill({ json: { success: true, data: pathname.endsWith("/schedules") ? [schedule] : schedule } })
    }
    if (request.method() === "POST" && pathname.endsWith("/na")) {
      attempts += 1
      if (attempts === 1) {
        await stalled
        return route.abort().catch(() => undefined)
      }
      schedule = { ...schedule, naAttachments: [{ fileName: "evidencia.pdf", documentUrl: "/files/evidencia.pdf" }] }
      return route.fulfill({ json: { success: true, data: schedule } })
    }
    return route.fallback()
  })

  try {
    await page.goto(`/agenda?date=${date}`)
    await page.getByRole("button", { name: /Condomínio E2E/ }).click()
    await page.getByTestId("schedule-attachment-file-input").setInputFiles({ name: "evidencia.pdf", mimeType: "application/pdf", buffer: Buffer.from("evidencia") })
    await expect.poll(() => attempts).toBe(1)
    await page.clock.fastForward(61_000)
    await expect(page.getByText("O envio ficou sem resposta. Confira sua conexão e tente enviar novamente.", { exact: true })).toBeVisible()
    const retry = page.getByRole("button", { name: "Reenviar pendentes", exact: true })
    await expect(retry).toBeEnabled()
    expect(attempts).toBe(1)
    await retry.click()
    await expect(page.getByText("Salva no agendamento", { exact: true })).toBeVisible()
    expect(attempts).toBe(2)
  } finally {
    releaseFirstUpload()
  }
})
