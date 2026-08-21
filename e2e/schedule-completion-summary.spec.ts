import { expect, test } from "@playwright/test"

import type { ScheduleNaAttachmentRecord } from "@/lib/api/schedules"
import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

function todayKey() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-")
}

const completionEmployees = [
  { id: "employee-driver", name: "Motorista E2E", role: "Motorista", status: "active" },
  { id: "employee-helper-1", name: "Ajudante Um", role: "Auxiliar", status: "active" },
  { id: "employee-helper-2", name: "Ajudante Dois", role: "Auxiliar", status: "active" },
] as const

test("digitaliza uma foto e a anexa ao agendamento", async ({ page }) => {
  const date = todayKey()
  let uploadedScan = false
  const scanSource = {
    name: "nota-de-autorizacao.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
        <rect width="600" height="800" fill="#efefef"/>
        <rect x="30" y="20" width="540" height="760" fill="white" stroke="#111" stroke-width="4"/>
        <text x="70" y="90" font-size="38" font-family="Arial" fill="#111">NOTA DE SERVIÇO</text>
        <path d="M70 140H530M70 200H530M70 260H530M70 320H530" stroke="#222" stroke-width="3"/>
      </svg>
    `),
  }
  let inProgressSchedule = {
    ...scheduleFixture,
    date,
    status: "in_progress" as const,
    completionStartDate: date,
    completionStartTime: "08:00",
    naAttachments: [] as ScheduleNaAttachmentRecord[],
  }

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (request.method() === "GET" && path.endsWith("/schedules")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [inProgressSchedule] }),
      })
      return
    }

    if (request.method() === "POST" && path.endsWith(`/schedules/${inProgressSchedule.id}/na`)) {
      uploadedScan = request.postDataBuffer()?.includes(Buffer.from("documento-digitalizado-")) ?? false
      inProgressSchedule = {
        ...inProgressSchedule,
        naAttachments: [{
          fileName: "documento-digitalizado-e2e.jpg",
          documentUrl: "/files/documento-digitalizado-e2e.jpg",
          mimeType: "image/jpeg",
        }],
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: inProgressSchedule }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/agenda?date=${date}`)
  await page.getByRole("button", { name: /Condomínio E2E/ }).click()
  const nativeChooserPromise = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Digitalizar", exact: true }).click()
  const nativeChooser = await nativeChooserPromise
  expect(await nativeChooser.element().getAttribute("accept")).toBe("image/*")
  expect(await nativeChooser.element().getAttribute("capture")).toBeNull()
  await nativeChooser.setFiles(scanSource)

  const scanner = page.getByRole("dialog", { name: "Digitalizar documento" })
  await expect(scanner).toBeVisible()
  await expect(scanner.locator('input[type="file"]')).not.toHaveAttribute("capture")
  await expect(scanner.getByRole("button", { name: /^Ajustar canto/ })).toHaveCount(4)
  await expect(scanner.getByRole("button", { name: "Modificar foto", exact: true })).toBeVisible()
  await expect(scanner.getByRole("button", { name: "Escolher foto", exact: true })).toHaveCount(0)
  await expect(scanner.getByRole("button", { name: "Tirar outra", exact: true })).toHaveCount(0)

  const modifyChooserPromise = page.waitForEvent("filechooser")
  await scanner.getByRole("button", { name: "Modificar foto", exact: true }).click()
  const modifyChooser = await modifyChooserPromise
  expect(await modifyChooser.element().getAttribute("accept")).toBe("image/*")
  expect(await modifyChooser.element().getAttribute("capture")).toBeNull()
  await modifyChooser.setFiles(scanSource)
  await expect(scanner.getByRole("button", { name: /^Ajustar canto/ })).toHaveCount(4)
  await expect(scanner.getByRole("button", { name: "Documento", exact: true })).toHaveCount(0)
  await expect(scanner.getByRole("button", { name: "Colorido", exact: true })).toHaveCount(0)
  await expect(scanner.getByRole("button", { name: "Original", exact: true })).toHaveCount(0)

  const digitalizeButton = scanner.getByRole("button", { name: "Digitalizar", exact: true })
  await expect(digitalizeButton.locator("svg")).toHaveCount(0)
  await digitalizeButton.click()
  await expect(scanner.getByAltText("Documento digitalizado")).toBeVisible()

  const sendButton = scanner.getByRole("button", { name: "Enviar", exact: true })
  await expect(sendButton.locator("svg")).toHaveCount(0)
  await sendButton.click()

  await expect.poll(() => uploadedScan).toBe(true)
  await expect(page.getByText("documento-digitalizado-e2e.jpg", { exact: true })).toBeVisible()
})

test.describe("digitalização no Android", () => {
  test.use({
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  })

  test("abre câmera, galeria e arquivos pelo menu de Digitalizar", async ({ page }) => {
    const date = todayKey()
    const scanSource = {
      name: "nota-de-autorizacao.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
          <rect width="600" height="800" fill="#efefef"/>
          <rect x="30" y="20" width="540" height="760" fill="white" stroke="#111" stroke-width="4"/>
          <text x="70" y="90" font-size="38" font-family="Arial" fill="#111">NOTA DE SERVIÇO</text>
        </svg>
      `),
    }
    const inProgressSchedule = {
      ...scheduleFixture,
      date,
      status: "in_progress" as const,
      completionStartDate: date,
      completionStartTime: "08:00",
      naAttachments: [] as ScheduleNaAttachmentRecord[],
    }

    await installAuthenticatedSession(page)
    await installApiMock(page)
    await page.route("**/api/v1/schedules**", async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname

      if (request.method() === "GET" && path.endsWith("/schedules")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ success: true, data: [inProgressSchedule] }),
        })
        return
      }

      await route.fallback()
    })

    await page.goto(`/agenda?date=${date}`)
    await page.getByRole("button", { name: /Condomínio E2E/ }).click()

    const scanner = page.getByRole("dialog", { name: "Digitalizar documento" })
    const chooseScannerSource = async (
      option: "Câmera" | "Galeria" | "Arquivos",
      expectedAccept: string | null,
      expectedCapture: string | null,
    ) => {
      const cameraOption = page.getByRole("menuitem", { name: "Câmera", exact: true })
      await expect(cameraOption).toHaveCount(0)
      const digitalizeButton = page.getByRole("button", { name: "Digitalizar", exact: true })
      await expect(digitalizeButton).toBeEnabled()
      await digitalizeButton.click()
      await expect(cameraOption).toBeVisible()
      await expect(page.getByRole("menuitem", { name: "Galeria", exact: true })).toBeVisible()
      await expect(page.getByRole("menuitem", { name: "Arquivos", exact: true })).toBeVisible()

      const chooserPromise = page.waitForEvent("filechooser")
      await page.getByRole("menuitem", { name: option, exact: true }).click()
      const chooser = await chooserPromise
      expect(await chooser.element().getAttribute("accept")).toBe(expectedAccept)
      expect(await chooser.element().getAttribute("capture")).toBe(expectedCapture)
      await chooser.setFiles(scanSource)

      await expect(scanner).toBeVisible()
      await expect(scanner.getByRole("button", { name: /^Ajustar canto/ })).toHaveCount(4)
      await page.keyboard.press("Escape")
      await expect(scanner).toHaveCount(0)
    }

    await chooseScannerSource("Câmera", "image/*", "environment")
    await chooseScannerSource("Galeria", "image/*", null)
    await chooseScannerSource("Arquivos", null, null)
  })
})

test("ultrapassa dez anexos acumulados no agendamento", async ({ page }) => {
  const date = todayKey()
  const files = [
    { name: "evidencia.avif", mimeType: "image/avif", buffer: Buffer.from("foto-avif") },
    { name: "na-assinada.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf-na") },
    {
      name: "relatorio.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("word-relatorio"),
    },
    {
      name: "medicoes.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("excel-medicoes"),
    },
    {
      name: "evidencia-16mb.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(16 * 1024 * 1024),
    },
  ]
  const uploadedFileNames: string[] = []
  const existingAttachments = Array.from({ length: 10 }, (_, index) => ({
    fileName: `anexo-existente-${index + 1}.pdf`,
    documentUrl: `/files/anexo-existente-${index + 1}.pdf`,
    mimeType: "application/pdf",
    fileSize: 1024,
  }))
  let inProgressSchedule = {
    ...scheduleFixture,
    date,
    status: "in_progress" as const,
    completionStartDate: date,
    completionStartTime: "08:00",
    naAttachments: existingAttachments as ScheduleNaAttachmentRecord[],
  }

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (request.method() === "GET" && path.endsWith("/schedules")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [inProgressSchedule] }),
      })
      return
    }

    if (request.method() === "POST" && path.endsWith(`/schedules/${inProgressSchedule.id}/na`)) {
      const body = request.postDataBuffer() ?? Buffer.alloc(0)
      const uploadedFile = files.find((file) => body.includes(Buffer.from(file.name)))
      if (uploadedFile) uploadedFileNames.push(uploadedFile.name)
      inProgressSchedule = {
        ...inProgressSchedule,
        naAttachments: uploadedFile
          ? [...inProgressSchedule.naAttachments, {
              fileName: uploadedFile.name,
              documentUrl: `/files/${uploadedFile.name}`,
              mimeType: uploadedFile.mimeType,
              fileSize: uploadedFile.buffer.byteLength,
            }]
          : inProgressSchedule.naAttachments,
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: inProgressSchedule }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/agenda?date=${date}`)
  await page.getByRole("button", { name: /Condomínio E2E/ }).click()
  await expect(page.getByText("Aceita fotos, PDF, Word e planilhas de até 30 MB. Cada arquivo é salvo imediatamente.")).toBeVisible()

  const fileChooserPromise = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Anexar arquivos", exact: true }).click()
  const fileChooser = await fileChooserPromise
  expect(await fileChooser.element().getAttribute("accept")).toBeNull()
  await fileChooser.setFiles(files)

  await expect.poll(() => uploadedFileNames).toEqual(files.map((file) => file.name))
  await expect(page.getByText("15 anexos", { exact: true })).toBeVisible()
  for (const file of files) {
    await expect(page.getByText(file.name, { exact: true })).toBeVisible()
  }

  const rejectedChooserPromise = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Anexar arquivos", exact: true }).click()
  const rejectedChooser = await rejectedChooserPromise
  await rejectedChooser.setFiles({
    name: "programa.exe",
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("executavel"),
  })
  await expect(page.getByText("Formato não permitido. Anexe fotos, PDF, Word ou planilhas.", { exact: true })).toBeVisible()
  await expect.poll(() => uploadedFileNames).toHaveLength(files.length)
})

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
  let renamedNaPayload: { documentUrl: string; fileName: string } | null = null

  await installAuthenticatedSession(page, {
    ...E2E_USER,
    permissions: E2E_USER.permissions.filter(
      (permission) => !["agenda_manage", "settings_manage"].includes(permission),
    ),
  })
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

    if (request.method() === "PATCH" && path.endsWith(`/schedules/${inProgressSchedule.id}/na`)) {
      const payload = request.postDataJSON() as { documentUrl: string; fileName: string }
      renamedNaPayload = payload
      inProgressSchedule = {
        ...inProgressSchedule,
        naAttachments: inProgressSchedule.naAttachments.map((attachment) => (
          attachment.documentUrl === payload.documentUrl
            ? { ...attachment, fileName: payload.fileName }
            : attachment
        )),
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

  await expect(page.getByRole("heading", { name: "Anexos do atendimento" })).toBeVisible()
  const attachmentsDialog = page.getByRole("dialog", { name: "Anexos do atendimento" })
  await expect(attachmentsDialog).toHaveCSS("width", "576px")
  await expect(attachmentsDialog).toHaveCSS("height", "512px")
  await expect(page.getByText("Adicione NAs e evidências da execução. Cada arquivo é salvo no agendamento assim que for anexado.")).toBeVisible()
  await expect(page.getByText("NAs e evidências", { exact: true })).toBeVisible()
  await expect(page.getByText("Aceita fotos, PDF, Word e planilhas de até 30 MB. Cada arquivo é salvo imediatamente.")).toBeVisible()
  await expect(page.getByText(/concluir o atendimento somente no último dia/i)).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Visualizar na-remover.pdf" })).toBeVisible()
  await expect(page.getByText("Abrir", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Editar nome de na-manter.pdf" }).click()
  const renameDialog = page.getByRole("dialog", { name: "Editar nome do arquivo" })
  await expect(renameDialog).toBeVisible()
  await renameDialog.getByLabel("Novo nome do arquivo").fill("evidencia-assinada.pdf")
  await renameDialog.getByRole("button", { name: "Salvar nome", exact: true }).click()
  await expect.poll(() => renamedNaPayload).toEqual({
    documentUrl: "/files/na-manter.pdf",
    fileName: "evidencia-assinada.pdf",
  })
  await expect(page.getByText("evidencia-assinada.pdf", { exact: true })).toBeVisible()
  await expect(page.getByText("na-manter.pdf", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Remover na-remover.pdf" }).click()
  const removeDialog = page.getByRole("alertdialog", { name: "Remover anexo?" })
  await expect(removeDialog).toBeVisible()
  await removeDialog.getByRole("button", { name: "Remover anexo", exact: true }).click()
  await expect.poll(() => deletedNaDocumentUrl).toBe("/files/na-remover.pdf")
  await expect(page.getByText("na-remover.pdf", { exact: true })).toHaveCount(0)
  await expect(page.getByText("evidencia-assinada.pdf", { exact: true })).toBeVisible()
  await expect(page.getByText("1 anexo", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ver informações", exact: true }).click()
  const detailsDialog = page.getByRole("dialog", { name: new RegExp(inProgressSchedule.clientName) })
  await expect(detailsDialog.getByText(inProgressSchedule.serviceTypeName, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Voltar para anexos do atendimento" }).click()
  await expect(page.getByRole("heading", { name: "Anexos do atendimento" })).toBeVisible()
  const finishAttendanceButton = page.getByRole("button", { name: "Encerrar atendimento", exact: true })
  await expect(finishAttendanceButton.locator("svg")).toHaveCount(0)
  await finishAttendanceButton.click()
  await expect(page.getByRole("heading", { name: "Encerrar atendimento" })).toBeVisible()

  const startDateField = page.getByText("Data de início *", { exact: true }).locator("..").getByRole("button")
  await expect(startDateField).toHaveAttribute("aria-readonly", "true")
  await expect(page.getByLabel("Horário de início *")).toHaveAttribute("readonly", "")
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
  await page.getByLabel("Placa do veículo").fill("abc1d23")
  await page.getByRole("combobox", { name: "Selecione o tipo de descarte" }).click()
  await page.getByRole("option", { name: "Fossa", exact: true }).click()
  await page.getByRole("combobox", { name: "Selecione a estação" }).click()
  await page.getByRole("option", { name: /ACQUA SERVIÇOS DE TRATAMENTO DE EFLUENTES.*R\$ 20,00/ }).click()
  await page.getByLabel("Quantidade (M³) *").fill("2,5")
  const disposalValueBox = page.getByText("Valor: R$ 50,00", { exact: true })
  await expect(disposalValueBox).toBeVisible()
  await expect(disposalValueBox).toHaveCSS("border-top-width", "0px")
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
    vehiclePlate: "ABC1D23",
    disposalType: "fossa",
    disposalStationId: "acqua-servicos",
    disposalQuantityM3: 2.5,
  })
})

test("mostra os dados concluídos e baixa o resumo pelo botão Exportar", async ({ page }) => {
  test.setTimeout(60_000)
  const date = "2026-08-03"
  const completedSchedule = {
    ...scheduleFixture,
    date,
    time: "08:00",
    duration: 8 * 60,
    durationValue: 1,
    durationType: "days" as const,
    status: "completed" as const,
    multiDayGroupId: "schedule-multi-day-group",
    multiDayIndex: 1,
    multiDayTotal: 3,
    completionStartDate: "2026-08-03",
    completionStartTime: "09:00",
    completionEndDate: "2026-08-03",
    completionEndTime: "15:00",
    serviceReport: "Atendimento concluído sem intercorrências.",
    attendanceDriver: { id: "employee-driver", name: "Motorista E2E" },
    attendanceHelpers: [
      { id: "employee-helper-1", name: "Ajudante Um" },
      { id: "employee-helper-2", name: "Ajudante Dois" },
    ],
    attendanceVehiclePlate: "ABC1D23",
    attendanceDisposal: {
      type: "fossa" as const,
      stationId: "acqua-servicos",
      stationName: "ACQUA SERVIÇOS DE TRATAMENTO DE EFLUENTES",
      unitPrice: 20,
      quantityM3: 2.5,
      totalValue: 50,
    },
  }
  const completedScheduleWithoutNotes = {
    ...completedSchedule,
    id: "schedule-completed-without-notes",
    clientName: "Cliente sem observações do atendimento",
    serviceReport: "",
    multiDayGroupId: undefined,
    multiDayIndex: undefined,
    multiDayTotal: undefined,
  }
  const pendingOccurrences = [2, 3].map((index) => ({
    ...scheduleFixture,
    id: `schedule-multi-day-${index}`,
    date: index === 2 ? "2026-08-04" : "2026-08-05",
    time: "08:00",
    duration: 8 * 60,
    durationValue: 1,
    durationType: "days" as const,
    status: "scheduled" as const,
    multiDayGroupId: completedSchedule.multiDayGroupId,
    multiDayIndex: index,
    multiDayTotal: 3,
  }))
  let executionUpdatePayload: Record<string, unknown> | null = null

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (request.method() === "GET" && path.endsWith("/schedules/completion-employees")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: completionEmployees }),
      })
      return
    }

    if (request.method() === "PATCH" && path.endsWith(`/schedules/${completedSchedule.id}/complete`)) {
      executionUpdatePayload = request.postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          success: true,
          data: {
            ...completedSchedule,
            ...executionUpdatePayload,
          },
        }),
      })
      return
    }

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
        body: JSON.stringify({
          success: true,
          data: [completedSchedule, ...pendingOccurrences, completedScheduleWithoutNotes],
        }),
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
  const editExecutionButton = executionCard.getByRole("button", { name: "Editar execução do atendimento" })
  await expect(editExecutionButton).toHaveCSS("width", "24px")
  await expect(editExecutionButton).toHaveCSS("height", "24px")
  await expect(executionCard).toContainText(
    "03/08/2026 às 09:00 até 03/08/2026 às 15:00",
  )
  const executionNotes = executionCard.locator("[data-schedule-execution-notes]")
  await expect(executionNotes).toHaveCSS("border-top-width", "0px")
  await expect(executionNotes).toContainText("Observações do atendimento")
  await expect(executionNotes).toContainText(
    "Atendimento concluído sem intercorrências.",
  )
  await expect(detailsDialog.locator('[data-schedule-detail-card="scheduled-date"]')).toContainText("03/08/2026")
  await expect(detailsDialog.locator('[data-schedule-detail-card="scheduled-time"]')).toContainText("08:00 • 1 dia")
  await expect(page.getByText("Motorista E2E", { exact: true })).toBeVisible()
  await expect(page.getByText("Ajudante Um • Ajudante Dois", { exact: true })).toBeVisible()
  await expect(executionCard).toContainText("ABC1D23")
  await expect(executionCard).toContainText("Fossa")
  await expect(executionCard).toContainText("ACQUA SERVIÇOS DE TRATAMENTO DE EFLUENTES")
  await expect(executionCard).toContainText("2,5 m³")
  const executionDisposal = executionCard.locator("[data-schedule-execution-disposal]")
  const executionDisposalValue = executionDisposal.locator("[data-schedule-execution-disposal-value]")
  await expect(executionDisposalValue.getByText("Valor", { exact: true })).toBeVisible()
  await expect(executionDisposalValue.getByText("R$ 50,00", { exact: true })).toBeVisible()
  await expect(executionDisposalValue).not.toContainText("Valor:")
  await expect(executionDisposal).toHaveCSS("border-top-width", "0px")
  await expect(executionDisposal).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await expect(page.getByText("Atendimento concluído sem intercorrências.", { exact: true })).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Exportar", exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(`resumo-agendamento-e2e-${date}.pdf`)

  await page.setViewportSize({ width: 390, height: 844 })
  await editExecutionButton.click()
  await expect(page.getByRole("heading", { name: "Editar execução do atendimento" })).toBeVisible()
  const startTimeInput = page.getByLabel("Horário de início *")
  await expect(startTimeInput).toHaveValue("09:00")
  await expect(startTimeInput).not.toHaveAttribute("readonly")
  await expect(startTimeInput.locator("xpath=../..")).toHaveCSS("min-width", "0px")
  expect(await startTimeInput.evaluate((input) => {
    const dialog = input.closest('[role="dialog"]')
    let ancestor = input.parentElement

    while (ancestor && ancestor !== dialog) {
      if (ancestor.scrollWidth > ancestor.clientWidth + 1) return false
      ancestor = ancestor.parentElement
    }

    return Boolean(dialog && dialog.scrollWidth <= dialog.clientWidth + 1)
  })).toBe(true)
  await expect(page.getByLabel("Horário de fim *")).toHaveValue("15:00")
  await expect(page.getByRole("combobox", { name: "Selecione o motorista" })).toContainText("Motorista E2E")
  await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Ajudante Um" })).toBeVisible()
  await expect(page.locator('[data-slot="badge"]').filter({ hasText: "Ajudante Dois" })).toBeVisible()
  await expect(page.getByLabel("Observações")).toHaveValue("Atendimento concluído sem intercorrências.")
  await expect(page.getByLabel("Placa do veículo")).toHaveValue("ABC1D23")
  await expect(page.getByText("Valor: R$ 50,00", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Editar anexos", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Anexos do atendimento" })).toBeVisible()
  await page.getByRole("dialog", { name: "Anexos do atendimento" }).getByRole("button", { name: "Voltar", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Editar execução do atendimento" })).toBeVisible()
  await page.getByRole("button", { name: "Editar anexos", exact: true }).click()
  const saveAttachmentsButton = page.getByRole("button", { name: "Salvar", exact: true })
  await expect(saveAttachmentsButton.locator("svg")).toHaveCount(0)
  await saveAttachmentsButton.click()
  await expect(page.getByRole("heading", { name: "Editar execução do atendimento" })).toBeVisible()
  await page.getByLabel("Observações").fill("Execução corrigida pelo usuário.")
  await page.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect.poll(() => executionUpdatePayload).not.toBeNull()
  expect(executionUpdatePayload).toMatchObject({
    startDate: "2026-08-03",
    startTime: "09:00",
    endDate: "2026-08-03",
    endTime: "15:00",
    driverEmployeeId: "employee-driver",
    helperEmployeeIds: ["employee-helper-1", "employee-helper-2"],
    serviceReport: "Execução corrigida pelo usuário.",
    vehiclePlate: "ABC1D23",
    disposalType: "fossa",
    disposalStationId: "acqua-servicos",
    disposalQuantityM3: 2.5,
  })

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto("/agendamentos")
  const completedRow = page.getByRole("row").filter({ hasText: completedSchedule.clientName }).first()
  await expect(completedRow).toContainText("03/08/2026")
  await expect(completedRow).toContainText("09:00")
  await expect(completedRow).toContainText("6 horas")
  await expect(completedRow).not.toContainText("04/08/2026")
  await expect(completedRow).not.toContainText("1 dia")

  await page.goto("/agenda?date=2026-08-03&view=week")
  const completedOccurrence = page.locator(
    `[data-schedule-id="${completedSchedule.id}"][data-schedule-status="completed"]`,
  )
  const secondOccurrence = page.locator(
    `[data-schedule-id="${pendingOccurrences[0]?.id}"][data-schedule-status="scheduled"]`,
  )
  const thirdOccurrence = page.locator(
    `[data-schedule-id="${pendingOccurrences[1]?.id}"][data-schedule-status="scheduled"]`,
  )
  await expect(completedOccurrence).toBeVisible()
  await expect(secondOccurrence).toBeVisible()
  await expect(thirdOccurrence).toBeVisible()
  await expect(completedOccurrence).toContainText("09:00 - 15:00")
  await expect(completedOccurrence).toHaveCSS("opacity", "1")
  await expect(secondOccurrence).toHaveCSS("opacity", "1")
  expect(await completedOccurrence.getAttribute("style")).toContain("6%")
  expect(await secondOccurrence.getAttribute("style")).toContain("10%")
  await secondOccurrence.hover()
  await expect(completedOccurrence.locator('[data-schedule-reference="1/3"]')).toBeVisible()
  await expect(secondOccurrence.locator('[data-schedule-reference="2/3"]')).toBeVisible()
  await expect(thirdOccurrence.locator('[data-schedule-reference="3/3"]')).toBeVisible()
  for (const occurrence of [completedOccurrence, secondOccurrence, thirdOccurrence]) {
    await expect.poll(() => occurrence.evaluate((element) => element.classList.contains("-translate-y-0.5"))).toBe(true)
  }

  await page.goto("/agenda?date=2026-08-03&view=day")
  await expect(page.locator(
    `[data-schedule-id="${completedSchedule.id}"][data-schedule-status="completed"]`,
  ).first()).toContainText("09:00 - 15:00")

  await page.goto("/agenda?date=2026-08-03&view=month")
  await page.locator("button").filter({ hasText: /^3$/ }).click()
  const monthDayDetails = page.locator("[data-agenda-day-details]")
  await expect(monthDayDetails).toContainText(completedSchedule.clientName)
  await expect(monthDayDetails).toContainText("09:00 (6 horas)")

  await page.goto(`/agenda?date=${date}&scheduleId=${completedScheduleWithoutNotes.id}`)
  const emptyNotesDialog = page.getByRole("dialog", { name: new RegExp(completedScheduleWithoutNotes.clientName) })
  const emptyExecutionNotes = emptyNotesDialog.locator("[data-schedule-execution-notes]")
  await expect(emptyExecutionNotes).toContainText("Observações do atendimento")
  await expect(emptyExecutionNotes).toContainText("Nenhuma observação registrada.")

  await page.evaluate(() => {
    const storedUser = JSON.parse(window.localStorage.getItem("depclean.user") || "{}")
    storedUser.permissions = (storedUser.permissions || []).filter(
      (permission: string) => !["agenda_manage_locked", "settings_manage"].includes(permission),
    )
    window.localStorage.setItem("depclean.user", JSON.stringify(storedUser))
    window.dispatchEvent(new Event("depclean:session"))
  })
  const restrictedDetailsDialog = page.getByRole("dialog", { name: new RegExp(completedScheduleWithoutNotes.clientName) })
  const restrictedExecutionCard = restrictedDetailsDialog.locator('[data-schedule-detail-card="execution"]')
  await expect(restrictedExecutionCard.getByRole("button", { name: "Editar execução do atendimento" })).toHaveCount(0)
})

test("mantém o dia concluído no período executado e revela execuções anteriores às seis", async ({ page }) => {
  const groupId = "schedule-early-execution-group"
  const completedOccurrence = {
    ...scheduleFixture,
    id: "schedule-early-execution-1",
    clientName: "Cliente com execução na madrugada",
    date: "2026-08-10",
    time: "08:00",
    duration: 8 * 60,
    durationValue: 1,
    durationType: "days" as const,
    status: "completed" as const,
    multiDayGroupId: groupId,
    multiDayIndex: 1,
    multiDayTotal: 2,
    completionStartDate: "2026-08-10",
    completionStartTime: "01:00",
    completionEndDate: "2026-08-10",
    completionEndTime: "02:00",
  }
  const pendingOccurrence = {
    ...completedOccurrence,
    id: "schedule-early-execution-2",
    date: "2026-08-11",
    status: "scheduled" as const,
    multiDayIndex: 2,
    completionStartDate: undefined,
    completionStartTime: undefined,
    completionEndDate: undefined,
    completionEndTime: undefined,
  }

  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === "GET" && path.endsWith("/schedules")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [completedOccurrence, pendingOccurrence] }),
      })
      return
    }
    await route.fallback()
  })

  await page.goto("/agenda?date=2026-08-10&view=week")

  const completedCard = page.locator(
    `[data-schedule-id="${completedOccurrence.id}"][data-schedule-status="completed"]`,
  )
  const pendingCard = page.locator(
    `[data-schedule-id="${pendingOccurrence.id}"][data-schedule-status="scheduled"]`,
  )
  await expect(completedCard).toContainText("01:00 - 02:00")
  await expect(completedCard).toHaveCSS("opacity", "1")
  expect(await completedCard.getAttribute("style")).toContain("6%")
  await expect(pendingCard).toBeAttached()
  await expect.poll(() => page.locator("[data-agenda-timeline-scroll]").evaluate((element) => element.scrollTop)).toBe(0)
})
