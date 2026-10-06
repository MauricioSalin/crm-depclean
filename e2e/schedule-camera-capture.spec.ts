import { expect, test } from "@playwright/test"
import { installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import type { ScheduleNaAttachmentRecord } from "@/lib/api/schedules"

test.use({
  userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  viewport: { width: 390, height: 844 },
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
})

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.addInitScript(() => {
    const media = navigator.mediaDevices
    const original = media.getUserMedia.bind(media)
    const streams: MediaStream[] = []
    Object.assign(window, { cameraTestStreams: streams })
    media.getUserMedia = async (constraints) => {
      const stream = await original(constraints)
      streams.push(stream)
      return stream
    }
  })
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
  let schedule = { ...scheduleFixture, date, status: "in_progress" as const, completionStartDate: date,
    completionStartTime: "08:00", naAttachments: [] as ScheduleNaAttachmentRecord[] }
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === "GET" && path.endsWith("/schedules")) {
      await route.fulfill({ json: { success: true, data: [schedule] } }); return
    }
    if (request.method() === "POST" && path.endsWith(`/schedules/${schedule.id}/na`)) {
      const body = request.postDataBuffer()!
      expect(body.includes(Buffer.from("foto-atendimento-"))).toBe(true)
      const filename = /filename="([^"]+)"/.exec(body.toString("latin1"))![1]
      schedule = { ...schedule, naAttachments: [...schedule.naAttachments, {
        fileName: filename, fileSize: body.length, mimeType: "image/jpeg", documentUrl: `/files/${filename}`,
      }] }
      await route.fulfill({ json: { success: true, data: schedule } }); return
    }
    await route.fallback()
  })
  await page.goto(`/agenda?date=${date}`)
  await page.getByRole("button", { name: /Condomínio E2E/ }).first().click()
})

test("fotografa dentro do atendimento e libera a câmera após enviar e cancelar", async ({ page }) => {
  let externalChooserCount = 0
  page.on("filechooser", () => externalChooserCount++)
  await page.getByRole("button", { name: "Usar câmera", exact: true }).click()
  const camera = page.getByRole("dialog", { name: "Câmera do atendimento" })
  await expect(camera.getByRole("button", { name: "Tirar foto", exact: true })).toBeEnabled()
  expect(await camera.locator("video").evaluate((video: HTMLVideoElement) => Math.max(video.videoWidth, video.videoHeight))).toBeLessThanOrEqual(2200)
  await camera.getByRole("button", { name: "Tirar foto", exact: true }).click()
  await expect(page.getByText("Anexo salvo no agendamento.", { exact: true })).toBeVisible()
  await expect(page.getByText("1 anexo", { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).cameraTestStreams.every((stream: MediaStream) => stream.getTracks().every((track) => track.readyState === "ended")))).toBe(true)
  await page.getByRole("button", { name: "Usar câmera", exact: true }).click()
  await expect(camera.getByRole("button", { name: "Tirar foto", exact: true })).toBeEnabled()
  await camera.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).cameraTestStreams.every((stream: MediaStream) => stream.getTracks().every((track) => track.readyState === "ended")))).toBe(true)
  expect(externalChooserCount).toBe(0)
})

test("explica permissão negada e permite repetir sem sair do atendimento", async ({ page }) => {
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    let attempts = 0
    navigator.mediaDevices.getUserMedia = (constraints) => ++attempts === 1
      ? Promise.reject(new DOMException("Denied", "NotAllowedError")) : original(constraints)
  })
  await page.getByRole("button", { name: "Usar câmera", exact: true }).click()
  const camera = page.getByRole("dialog", { name: "Câmera do atendimento" })
  await expect(camera.getByRole("alert")).toContainText("Permita o acesso à câmera")
  await camera.getByRole("button", { name: "Tentar novamente", exact: true }).click()
  await expect(camera.getByRole("button", { name: "Tirar foto", exact: true })).toBeEnabled()
  await camera.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Anexos do atendimento" })).toBeVisible()
})

test("libera também uma câmera autorizada depois que o diálogo já fechou", async ({ page }) => {
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints)
      await new Promise<void>((resolve) => { (window as any).releaseCameraRequest = resolve })
      return stream
    }
  })
  await page.getByRole("button", { name: "Usar câmera", exact: true }).click()
  await expect.poll(() => page.evaluate(() => typeof (window as any).releaseCameraRequest)).toBe("function")
  await page.getByRole("dialog", { name: "Câmera do atendimento" }).getByRole("button", { name: "Cancelar", exact: true }).click()
  await page.evaluate(() => (window as any).releaseCameraRequest())
  await expect.poll(() => page.evaluate(() => (window as any).cameraTestStreams.every((stream: MediaStream) => stream.getTracks().every((track) => track.readyState === "ended")))).toBe(true)
})
