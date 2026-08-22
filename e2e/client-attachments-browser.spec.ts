import { expect, test } from "@playwright/test"

import { clientFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const scheduleFolderId = "folder-schedule-schedule-e2e"
const scheduleAttachmentsFolderId = `${scheduleFolderId}-attachments`
const scheduleInformativeFolderId = `${scheduleFolderId}-informative`
const scheduleCertificateFolderId = `${scheduleFolderId}-certificate`

const workspace = {
  folders: [
    { id: "folder-meeting-minutes", parentId: null, name: "Atas", systemKind: "meeting_minutes", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: "folder-bait-stations", parentId: null, name: "Porta Iscas", systemKind: "bait_stations", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: scheduleFolderId, parentId: null, name: "18/08/2026 · Controle de pragas", systemKind: "schedule", scheduledServiceId: "schedule-e2e", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: scheduleAttachmentsFolderId, parentId: scheduleFolderId, name: "Anexos do agendamento", systemKind: "schedule_attachments", scheduledServiceId: "schedule-e2e", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: scheduleInformativeFolderId, parentId: scheduleFolderId, name: "Informativos", systemKind: "informative", scheduledServiceId: "schedule-e2e", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: scheduleCertificateFolderId, parentId: scheduleFolderId, name: "Certificados", systemKind: "certificate", scheduledServiceId: "schedule-e2e", createdAt: "2026-08-18T12:00:00.000Z" },
  ],
  files: [
    {
      id: "contract-contract-e2e",
      clientId: clientFixture.id,
      parentId: null,
      type: "contract",
      title: "Contrato 0001",
      fileName: "contrato.pdf",
      documentUrl: "/api/v1/files/clients/client-e2e/attachments/root/contrato.pdf",
      mimeType: "application/pdf",
      fileSize: 2048,
      source: "contracts",
      uploadedAt: "2026-08-18T12:00:00.000Z",
    },
    {
      id: "schedule-plan-contract-e2e",
      clientId: clientFixture.id,
      parentId: scheduleFolderId,
      scheduledServiceId: "schedule-e2e",
      type: "schedule",
      title: "Cronograma de atendimentos - DEP-2026-001",
      fileName: "cronograma.pdf",
      documentUrl: "/api/v1/files/clients/client-e2e/attachments/cronogramas/cronograma.pdf",
      mimeType: "application/pdf",
      fileSize: 4096,
      source: "contracts",
      uploadedAt: "2026-08-18T12:00:00.000Z",
      metadata: { originKind: "schedule_plan" },
    },
    {
      id: "evidence-e2e",
      clientId: clientFixture.id,
      parentId: scheduleAttachmentsFolderId,
      type: "schedule",
      title: "Evidência E2E",
      fileName: "evidencia.jpg",
      documentUrl: "/api/v1/files/clients/client-e2e/attachments/evidence/evidencia.jpg",
      mimeType: "image/jpeg",
      fileSize: 1024,
      source: "scheduled_services",
      uploadedAt: "2026-08-18T12:00:00.000Z",
    },
    {
      id: "certificate-e2e",
      clientId: clientFixture.id,
      parentId: scheduleCertificateFolderId,
      type: "schedule",
      title: "Certificado E2E",
      fileName: "certificado.pdf",
      documentUrl: "/api/v1/files/clients/client-e2e/attachments/certificate/certificado.pdf",
      mimeType: "application/pdf",
      fileSize: 3072,
      source: "certificates",
      uploadedAt: "2026-08-18T12:00:00.000Z",
    },
  ],
}

const overflowWorkspace = {
  ...workspace,
  folders: [
    ...workspace.folders,
    { id: "folder-cleaning-1", parentId: null, name: "04/06/2027 · Visita de rotina", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: "folder-cleaning-2", parentId: null, name: "04/03/2027 · Visita de rotina", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: "folder-cleaning-3", parentId: null, name: "17/12/2026 · Limpeza de rede", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: "folder-cleaning-4", parentId: null, name: "16/12/2026 · Limpeza de rede", createdAt: "2026-08-18T12:00:00.000Z" },
    { id: "folder-cleaning-5", parentId: null, name: "15/12/2026 · Limpeza de rede", createdAt: "2026-08-18T12:00:00.000Z" },
  ],
}

const longDestinationFolderId = "folder-long-destination"
const longDestinationWorkspace = {
  ...workspace,
  folders: [
    ...workspace.folders,
    {
      id: longDestinationFolderId,
      parentId: scheduleAttachmentsFolderId,
      name: "Documentos complementares da visita técnica e comprovantes enviados pelo cliente",
      createdAt: "2026-08-18T12:00:00.000Z",
    },
  ],
}

const paginationWorkspace = {
  ...workspace,
  folders: [
    ...workspace.folders,
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `folder-pagination-${String(index + 1).padStart(2, "0")}`,
      parentId: null,
      name: `Pasta paginada ${String(index + 1).padStart(2, "0")}`,
      createdAt: "2026-08-18T12:00:00.000Z",
    })),
  ],
}

test("mostra o carregamento no mesmo formato da lista de anexos", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  let releaseWorkspace: (() => void) | undefined
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await new Promise<void>((resolve) => { releaseWorkspace = resolve })
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: workspace }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  const skeletonList = page.locator("[data-attachment-skeleton-list]")
  const skeletonRows = skeletonList.locator("[data-attachment-skeleton-row]")
  await expect(skeletonList).toBeVisible()
  await expect(skeletonRows).toHaveCount(6)
  await expect.poll(() => skeletonRows.first().evaluate((row) => getComputedStyle(row).display)).toBe("flex")
  await expect(skeletonList.locator(".grid")).toHaveCount(0)

  releaseWorkspace?.()
  await expect(skeletonList).toBeHidden()
})

test("mantém o submenu de mover afastado do fim da tela", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: overflowWorkspace }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  const contractActions = page.getByRole("tabpanel", { name: /Anexos/ })
    .getByRole("button", { name: "Ações do arquivo Contrato 0001", exact: true })
  await contractActions.evaluate((button) => {
    button.style.position = "fixed"
    button.style.right = "0"
    button.style.bottom = "0"
    button.style.zIndex = "250"
  })
  await contractActions.click()
  await page.getByRole("menuitem", { name: "Mover", exact: true }).hover()

  const moveSubmenu = page.locator('[data-slot="dropdown-menu-sub-content"]')
  await expect(moveSubmenu).toBeVisible()
  await expect.poll(async () => {
    const submenuBox = await moveSubmenu.boundingBox()
    const viewport = page.viewportSize()
    if (!submenuBox || !viewport) return -1
    return viewport.height - submenuBox.y - submenuBox.height
  }).toBeGreaterThanOrEqual(20)
  await expect(page.getByRole("menuitem", { name: "Anexos", exact: true })).toBeVisible()
})

test("alinha à esquerda os cabeçalhos das modais de anexos no mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: workspace }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  const toolbar = page.getByRole("tabpanel", { name: /Anexos/ }).locator("[data-client-attachments-toolbar]")
  await toolbar.getByRole("button", { name: "Upload", exact: true }).click()
  const uploadDialog = page.getByRole("dialog", { name: "Enviar e classificar arquivos" })
  await expect.poll(() => uploadDialog.locator('[data-slot="dialog-header"]').evaluate((header) => (
    getComputedStyle(header).textAlign
  ))).toBe("left")
  await page.keyboard.press("Escape")
  await expect(uploadDialog).toBeHidden()

  await toolbar.getByRole("button", { name: "Nova pasta", exact: true }).click()
  const folderDialog = page.getByRole("dialog", { name: "Nova pasta" })
  await expect.poll(() => folderDialog.locator('[data-slot="dialog-header"]').evaluate((header) => (
    getComputedStyle(header).textAlign
  ))).toBe("left")
})

test("pagina a lista de anexos e permite alterar a quantidade por página", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: paginationWorkspace }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  const browser = page.getByRole("tabpanel", { name: /Anexos/ })
  const pageSize = browser.getByRole("combobox", { name: "Itens por página", exact: true })
  await expect(pageSize).toHaveText("10")
  await expect(browser.getByText("1-10 de 16", { exact: true })).toBeVisible()
  await expect(browser.locator('[data-workspace-item-id="folder-pagination-07"]')).toBeVisible()
  await expect(browser.locator('[data-workspace-item-id="folder-pagination-08"]')).toHaveCount(0)
  await expect(browser.locator('[data-workspace-item-id="contract-contract-e2e"]')).toHaveCount(0)

  await browser.getByRole("button", { name: "Ir para a próxima página", exact: true }).click()
  await expect(browser.getByText("2 / 2", { exact: true })).toBeVisible()
  await expect(browser.getByText("11-16 de 16", { exact: true })).toBeVisible()
  await expect(browser.locator('[data-workspace-item-id="folder-pagination-08"]')).toBeVisible()
  await expect(browser.locator('[data-workspace-item-id="folder-meeting-minutes"]')).toHaveCount(0)
  await expect(browser.locator('[data-workspace-item-id="contract-contract-e2e"]')).toBeVisible()

  await pageSize.click()
  await page.getByRole("option", { name: "20", exact: true }).dispatchEvent("click")
  await expect(browser.getByText("1 / 1", { exact: true })).toBeVisible()
  await expect(browser.getByText("1-16 de 16", { exact: true })).toBeVisible()
  await expect(browser.locator('[data-workspace-item-id="folder-meeting-minutes"]')).toBeVisible()
  await expect(browser.locator('[data-workspace-item-id="contract-contract-e2e"]')).toBeVisible()
})

test("divide a largura mobile entre nova pasta e upload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: workspace }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  const toolbar = page.getByRole("tabpanel", { name: /Anexos/ }).locator("[data-client-attachments-toolbar]")
  const actions = toolbar.locator("[data-client-attachments-actions]")
  const createFolderButton = actions.getByRole("button", { name: "Nova pasta", exact: true })
  const uploadButton = actions.getByRole("button", { name: "Upload", exact: true })
  await expect(actions).toBeVisible()
  await expect.poll(async () => {
    const toolbarBox = await toolbar.boundingBox()
    const actionsBox = await actions.boundingBox()
    if (!toolbarBox || !actionsBox) return -1
    return Math.round(Math.abs(toolbarBox.width - actionsBox.width))
  }).toBeLessThanOrEqual(1)
  await expect.poll(async () => {
    const createFolderBox = await createFolderButton.boundingBox()
    const uploadBox = await uploadButton.boundingBox()
    if (!createFolderBox || !uploadBox) return -1
    return Math.round(Math.abs(createFolderBox.width - uploadBox.width))
  }).toBeLessThanOrEqual(1)
})

test("expande o tipo do arquivo pela largura da modal no mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: workspace }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  await page.getByRole("tabpanel", { name: /Anexos/ })
    .getByRole("button", { name: "Upload", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Enviar e classificar arquivos" })
  const fileType = dialog.getByRole("combobox").first()
  const destination = dialog.getByLabel("Destino", { exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("Tipo", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Tipo do arquivo", { exact: true })).toHaveCount(0)
  await expect.poll(async () => {
    const fileTypeBox = await fileType.boundingBox()
    const destinationBox = await destination.boundingBox()
    if (!fileTypeBox || !destinationBox) return -1
    return Math.round(Math.max(
      Math.abs(fileTypeBox.x - destinationBox.x),
      Math.abs(fileTypeBox.width - destinationBox.width),
    ))
  }).toBeLessThanOrEqual(1)
})

test("aproxima o destino do tipo do arquivo no desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: workspace }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  await page.getByRole("tabpanel", { name: /Anexos/ })
    .getByRole("button", { name: "Upload", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Enviar e classificar arquivos" })
  const fileType = dialog.getByRole("combobox").first()
  const destination = dialog.getByLabel("Destino", { exact: true })
  await expect(dialog).toBeVisible()
  await expect.poll(async () => {
    const fileTypeBox = await fileType.boundingBox()
    const destinationBox = await destination.boundingBox()
    if (!fileTypeBox || !destinationBox) return -1
    return Math.round(destinationBox.x - fileTypeBox.x - fileTypeBox.width)
  }).toBeGreaterThanOrEqual(10)
  await expect.poll(async () => {
    const fileTypeBox = await fileType.boundingBox()
    const destinationBox = await destination.boundingBox()
    if (!fileTypeBox || !destinationBox) return Number.POSITIVE_INFINITY
    return Math.round(destinationBox.x - fileTypeBox.x - fileTypeBox.width)
  }).toBeLessThanOrEqual(30)
})

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 720 },
]) {
  test(`mostra o final do destino ao abrir a modal no ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await installAuthenticatedSession(page)
    await installApiMock(page)
    await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: longDestinationWorkspace }),
      })
    })

    await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

    const browser = page.getByRole("tabpanel", { name: /Anexos/ })
    await browser.locator(`[data-workspace-item-id="${scheduleFolderId}"]`).click()
    await browser.locator(`[data-workspace-item-id="${scheduleAttachmentsFolderId}"]`).click()
    await browser.locator(`[data-workspace-item-id="${longDestinationFolderId}"]`).click()
    await browser.getByRole("button", { name: "Upload", exact: true }).click()

    const destination = page.getByRole("dialog", { name: "Enviar e classificar arquivos" })
      .getByLabel("Destino", { exact: true })
    await expect(destination).toBeVisible()
    await expect.poll(() => destination.evaluate((input) => ({
      hasOverflow: input.scrollWidth > input.clientWidth,
      isAtEnd: Math.abs(input.scrollWidth - input.clientWidth - input.scrollLeft) <= 1,
    }))).toEqual({ hasOverflow: true, isAtEnd: true })
  })
}

test("abre os destinos de mover acima ou abaixo no mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: overflowWorkspace }),
    })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  const browser = page.getByRole("tabpanel", { name: /Anexos/ })
  await browser.getByRole("button", { name: "Ações do arquivo Contrato 0001", exact: true }).click()
  await page.getByRole("menuitem", { name: "Mover", exact: true }).click()

  const destinationMenu = page.locator('[data-slot="dropdown-menu-content"]:visible').filter({
    has: page.getByRole("menuitem", { name: "Anexos", exact: true }),
  })
  await expect(destinationMenu).toBeVisible()
  await expect(destinationMenu).toHaveAttribute("data-side", /^(top|bottom)$/)
  await expect(page.locator('[data-slot="dropdown-menu-sub-content"]:visible')).toHaveCount(0)
  await expect.poll(async () => {
    const menuBox = await destinationMenu.boundingBox()
    const viewport = page.viewportSize()
    if (!menuBox || !viewport) return -1
    return Math.round(Math.min(menuBox.x, viewport.width - menuBox.x - menuBox.width))
  }).toBeGreaterThanOrEqual(20)
})

test("navega nas pastas e abre o upload classificado também por arrastar arquivo", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  const fileMoves: Array<Record<string, unknown>> = []
  const folderMoves: Array<Record<string, unknown>> = []
  const folderCreates: Array<Record<string, unknown>> = []
  const uploadBodies: string[] = []
  let holdNextUpload = false
  let releaseUpload: (() => void) | undefined
  let holdNextDelete = false
  let releaseDelete: (() => void) | undefined
  let fileDeletes = 0
  let fileDownloads = 0
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/workspace`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: workspace }),
    })
  })
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/files/*`, async (route) => {
    if (route.request().method() === "DELETE") {
      fileDeletes += 1
      if (holdNextDelete) {
        holdNextDelete = false
        await new Promise<void>((resolve) => { releaseDelete = resolve })
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: {} }),
      })
      return
    }
    fileMoves.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/folders/*`, async (route) => {
    folderMoves.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments/folders`, async (route) => {
    folderCreates.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
  await page.route(`**/api/v1/clients/${clientFixture.id}/attachments`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback()
      return
    }
    uploadBodies.push(route.request().postData() ?? "")
    if (holdNextUpload) {
      holdNextUpload = false
      await new Promise<void>((resolve) => { releaseUpload = resolve })
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
  await page.route("**/api/v1/files/clients/client-e2e/attachments/root/contrato.pdf", async (route) => {
    fileDownloads += 1
    await route.fulfill({ status: 200, contentType: "application/pdf", body: "PDF E2E" })
  })

  await page.goto(`/clientes/${clientFixture.id}?tab=anexos`)

  const browser = page.getByRole("tabpanel", { name: /Anexos/ })
  await expect(browser.getByText("Central de anexos", { exact: true })).toHaveCount(0)
  const toolbar = browser.locator("[data-client-attachments-toolbar]")
  await expect(toolbar.getByPlaceholder("Pesquisar em todas as pastas...")).toBeVisible()
  await expect(toolbar.getByRole("combobox")).toContainText("Todos os tipos")
  await expect(toolbar.getByRole("button", { name: "Nova pasta" })).toBeVisible()
  await expect(toolbar.getByRole("button", { name: "Upload" })).toBeVisible()
  await expect.poll(() => toolbar.evaluate((element) => getComputedStyle(element).flexDirection)).toBe("row")
  await expect(browser.getByRole("button", { name: "Atas Pasta · 0 arquivos", exact: true })).toBeVisible()
  await expect(browser.getByRole("button", { name: "Porta Iscas Pasta · 0 arquivos", exact: true })).toBeVisible()
  await expect(browser.getByText("Checklists", { exact: true })).toHaveCount(0)
  await expect(browser.getByText("Contrato 0001", { exact: true })).toBeVisible()
  const breadcrumb = browser.locator("[data-client-attachments-breadcrumb]")
  const backButton = breadcrumb.getByRole("button", { name: "Voltar na navegação de pastas", exact: true })
  const forwardButton = breadcrumb.getByRole("button", { name: "Avançar na navegação de pastas", exact: true })
  await expect(backButton).toBeDisabled()
  await expect(forwardButton).toBeDisabled()
  await expect(breadcrumb.getByText("...", { exact: true })).toHaveCount(0)

  const atasDropTarget = browser.locator('[data-folder-drop-target="folder-meeting-minutes"]')
  const contractItem = browser.locator('[data-workspace-item-id="contract-contract-e2e"]')
  await expect.poll(() => contractItem.evaluate((item) => getComputedStyle(item).cursor)).toBe("pointer")
  const scrollDragTransfer = await page.evaluateHandle(() => new DataTransfer())
  await contractItem.dispatchEvent("dragstart", { dataTransfer: scrollDragTransfer })
  await page.evaluate(() => {
    document.documentElement.style.minHeight = "2400px"
    document.body.style.minHeight = "2400px"
    window.scrollTo(0, 600)
  })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(500)
  await page.dispatchEvent("body", "dragover", { clientY: 2, dataTransfer: scrollDragTransfer })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(500)
  await contractItem.dispatchEvent("dragend", { dataTransfer: scrollDragTransfer })
  await page.evaluate(() => {
    document.documentElement.style.minHeight = ""
    document.body.style.minHeight = ""
    window.scrollTo(0, 0)
  })
  const itemDownloadPromise = page.waitForEvent("download")
  await contractItem.getByText("Contrato 0001", { exact: true }).click()
  const itemDownload = await itemDownloadPromise
  expect(itemDownload.suggestedFilename()).toBe("Contrato 0001")
  await expect.poll(() => fileDownloads).toBe(1)
  const iconDownloadPromise = page.waitForEvent("download")
  await contractItem.getByTitle("Baixar arquivo").click()
  const iconDownload = await iconDownloadPromise
  expect(iconDownload.suggestedFilename()).toBe("Contrato 0001")
  await expect.poll(() => fileDownloads).toBe(2)

  await browser.getByRole("button", { name: "Ações do arquivo Contrato 0001", exact: true }).click()
  await page.getByRole("menuitem", { name: "Mover", exact: true }).hover()
  await expect(page.locator('[data-slot="dropdown-menu-sub-content"]')).toBeVisible()
  await expect.poll(() => page.locator('[data-slot="dropdown-menu-sub-content"]').evaluate((submenu) => (
    submenu.closest('[data-slot="dropdown-menu-content"]') === null
  ))).toBe(true)
  await expect(page.getByRole("menuitem", { name: "Anexos", exact: true })).toBeVisible()
  for (const folderName of ["Atas", "Porta Iscas", "18/08/2026 · Controle de pragas"]) {
    await expect(page.getByRole("menuitem", { name: folderName, exact: true })).toBeVisible()
  }
  await page.getByRole("menuitem", { name: "Atas", exact: true }).click()
  await expect.poll(() => fileMoves).toEqual([{ parentId: "folder-meeting-minutes" }])
  await expect(toolbar.getByRole("button", { name: "Upload" })).toBeEnabled()
  fileMoves.length = 0

  await contractItem.getByText("Contrato 0001", { exact: true }).dragTo(atasDropTarget)
  await expect.poll(() => fileMoves).toEqual([{ parentId: "folder-meeting-minutes" }])
  await expect(toolbar.getByRole("button", { name: "Upload" })).toBeEnabled()

  await browser.getByRole("button", { name: "Ações da pasta Porta Iscas", exact: true }).click()
  await page.getByRole("menuitem", { name: "Mover", exact: true }).hover()
  await expect(page.getByRole("menuitem", { name: "Anexos", exact: true })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Porta Iscas", exact: true })).toHaveCount(0)
  await page.getByRole("menuitem", { name: "Atas", exact: true }).dispatchEvent("click")
  await expect.poll(() => folderMoves).toEqual([{ parentId: "folder-meeting-minutes" }])
  await expect(toolbar.getByRole("button", { name: "Upload" })).toBeEnabled()
  folderMoves.length = 0

  await browser.locator('[data-workspace-item-id="folder-bait-stations"]').getByText("Porta Iscas", { exact: true }).dragTo(atasDropTarget)
  await expect.poll(() => folderMoves).toEqual([{ parentId: "folder-meeting-minutes" }])
  await expect(toolbar.getByRole("button", { name: "Upload" })).toBeEnabled()

  await browser.getByRole("button", { name: "Ações do arquivo Contrato 0001", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const editDialog = page.getByRole("dialog", { name: "Editar arquivo" })
  await expect(editDialog.getByText("Mover para", { exact: true })).toHaveCount(0)
  await editDialog.getByRole("button", { name: "Cancelar", exact: true }).click()

  await browser.getByRole("button", { name: "Ações do arquivo Contrato 0001", exact: true }).click()
  await page.getByRole("menuitem", { name: "Remover", exact: true }).click()
  const deleteDialog = page.getByRole("dialog", { name: "Remover arquivo" })
  holdNextDelete = true
  await deleteDialog.getByRole("button", { name: "Remover", exact: true }).click()
  await expect(deleteDialog).toBeHidden({ timeout: 500 })
  await expect(browser.getByText("Processando arquivos com segurança...", { exact: true })).toBeVisible()
  await expect.poll(() => typeof releaseDelete).toBe("function")
  releaseDelete?.()
  await expect.poll(() => fileDeletes).toBe(1)
  await expect(browser.getByText("Processando arquivos com segurança...", { exact: true })).toBeHidden()

  await browser.getByRole("button", { name: "18/08/2026 · Controle de pragas Pasta do agendamento · 3 arquivos", exact: true }).click()
  await expect(backButton).toBeEnabled()
  await expect(forwardButton).toBeDisabled()
  await expect(browser.getByRole("button", { name: "Anexos do agendamento Pasta · 1 arquivo", exact: true })).toBeVisible()
  await expect(browser.getByRole("button", { name: "Informativos Pasta · 0 arquivos", exact: true })).toBeVisible()
  await expect(browser.getByRole("button", { name: "Certificados Pasta · 1 arquivo", exact: true })).toBeVisible()
  await expect(browser.getByText("Cronograma de atendimentos - DEP-2026-001", { exact: true })).toBeVisible()
  await expect(browser.getByText("Certificado E2E", { exact: true })).toHaveCount(0)
  await expect(browser.getByText("NAs", { exact: true })).toHaveCount(0)
  await expect(browser.getByText("Evidências", { exact: true })).toHaveCount(0)
  await expect(browser.getByText("Checklists", { exact: true })).toHaveCount(0)
  await browser.getByRole("button", { name: "Certificados Pasta · 1 arquivo", exact: true }).click()
  await expect(browser.getByText("Certificado E2E", { exact: true })).toBeVisible()
  await expect(browser.getByText("Cronograma de atendimentos - DEP-2026-001", { exact: true })).toHaveCount(0)
  await backButton.click()
  await browser.getByRole("button", { name: "Anexos do agendamento Pasta · 1 arquivo", exact: true }).click()
  await expect(browser.getByText("Agendamento", { exact: true })).toHaveCount(1)
  await expect(browser.getByText("Certificado E2E", { exact: true })).toHaveCount(0)
  await expect.poll(async () => breadcrumb.locator("[data-breadcrumb-item]").evaluateAll((items) => (
    items.every((item) => getComputedStyle(item).cursor === "pointer")
  ))).toBe(true)

  await backButton.click()
  await expect(browser.getByRole("button", { name: "Anexos do agendamento Pasta · 1 arquivo", exact: true })).toBeVisible()
  await expect(forwardButton).toBeEnabled()
  await forwardButton.click()
  await expect(browser.getByText("Agendamento", { exact: true })).toHaveCount(1)

  await toolbar.getByRole("button", { name: "Upload" }).click()
  const scheduledUploadDialog = page.getByRole("dialog", { name: "Enviar e classificar arquivos" })
  await expect(scheduledUploadDialog.getByRole("combobox").first()).toContainText("Agendamento")
  await expect(scheduledUploadDialog.getByRole("combobox")).toHaveCount(1)
  await expect(scheduledUploadDialog.getByLabel("Destino", { exact: true })).toHaveValue(
    "Anexos / 18/08/2026 · Controle de pragas / Anexos do agendamento",
  )
  await scheduledUploadDialog.locator('input[type="file"]').setInputFiles({
    name: "novo-anexo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("PDF E2E"),
  })
  await expect.poll(() => scheduledUploadDialog.locator("[data-upload-file-list]").evaluate((element) => (
    getComputedStyle(element).borderTopWidth
  ))).toBe("0px")
  await expect.poll(() => scheduledUploadDialog.getByRole("button", { name: "Remover novo-anexo.pdf" }).evaluate((element) => (
    getComputedStyle(element).cursor
  ))).toBe("pointer")
  holdNextUpload = true
  await scheduledUploadDialog.getByRole("button", { name: "Enviar arquivos", exact: true }).click()
  await expect(scheduledUploadDialog).toBeHidden()
  await expect(browser.getByText("Processando arquivos com segurança...", { exact: true })).toBeVisible()
  await expect.poll(() => typeof releaseUpload).toBe("function")
  releaseUpload?.()
  await expect.poll(() => uploadBodies.length).toBe(1)
  await expect(browser.getByText("Processando arquivos com segurança...", { exact: true })).toBeHidden()
  expect(uploadBodies[0]).toContain(scheduleAttachmentsFolderId)
  expect(uploadBodies[0]).toContain("schedule-e2e")

  await toolbar.getByRole("button", { name: "Nova pasta", exact: true }).click()
  const createFolderDialog = page.getByRole("dialog", { name: "Nova pasta" })
  await expect(createFolderDialog.getByLabel("Destino")).toHaveValue(
    "Anexos / 18/08/2026 · Controle de pragas / Anexos do agendamento",
  )
  await createFolderDialog.getByLabel("Nome").fill("Documentos extras")
  await createFolderDialog.getByRole("button", { name: "Criar pasta", exact: true }).click()
  await expect.poll(() => folderCreates).toEqual([{
    name: "Documentos extras",
    parentId: scheduleAttachmentsFolderId,
  }])

  await breadcrumb.locator("[data-breadcrumb-item]").first().click()
  await expect(backButton).toBeEnabled()
  await expect(forwardButton).toBeDisabled()
  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(["conteúdo da ata"], "ata-condominio.pdf", { type: "application/pdf" }))
    return transfer
  })
  await browser.locator("[data-client-attachments-dropzone]").dispatchEvent("drop", { dataTransfer })

  const dialog = page.getByRole("dialog", { name: "Enviar e classificar arquivos" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("ata-condominio.pdf", { exact: true })).toBeVisible()
  await expect(dialog.getByLabel("Destino", { exact: true })).toHaveValue("Anexos")
  await dialog.getByRole("combobox").first().click()
  for (const label of ["Contrato", "Agendamento", "Ata", "Porta Iscas", "Checklist", "Outro"]) {
    await expect(page.getByRole("option", { name: label, exact: true })).toBeVisible()
  }
  await page.getByRole("option", { name: "Checklist", exact: true }).click()
  await dialog.getByRole("button", { name: "Enviar arquivos", exact: true }).click()
  await expect.poll(() => uploadBodies.length).toBe(2)
  expect(uploadBodies[1]).toContain('name="type"\r\n\r\nchecklist')
  expect(uploadBodies[1]).not.toContain('name="parentId"')
})
