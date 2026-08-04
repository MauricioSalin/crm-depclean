import { expect, test } from "@playwright/test"

import { installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

test("visualizar e abrir por link usam NAs quando o atendimento já iniciou", async ({ page }) => {
  const restrictedUser = {
    ...E2E_USER,
    id: "user-schedule-in-progress",
    permissions: ["agenda_own_view"],
  }
  const inProgressSchedule = {
    ...scheduleFixture,
    id: "schedule-in-progress-consistency",
    status: "in_progress" as const,
    canAttachNa: true,
    naAttachments: [{ fileName: "na-consistency.pdf", documentUrl: "/files/na-consistency.pdf" }],
  }

  await installAuthenticatedSession(page, restrictedUser)
  await installApiMock(page, restrictedUser)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [inProgressSchedule] }),
      })
      return
    }

    if (request.method() === "GET" && pathname === `/api/v1/schedules/${inProgressSchedule.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: inProgressSchedule }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/agendamentos")
  await page.getByRole("button", { name: `Abrir ações do agendamento de ${inProgressSchedule.clientName}` }).click()
  await page.getByRole("menuitem", { name: "Visualizar", exact: true }).click()
  const naHeading = page.getByRole("heading", { name: "NAs do atendimento", exact: true })
  const naBackButton = page.getByRole("button", { name: "Voltar", exact: true })
  await expect(naHeading).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(naBackButton).toHaveClass(/text-foreground/)
  await expect.poll(async () => {
    const [headingBox, backButtonBox] = await Promise.all([
      naHeading.boundingBox(),
      naBackButton.boundingBox(),
    ])
    if (!headingBox || !backButtonBox) return -1
    return headingBox.y - backButtonBox.y - backButtonBox.height
  }).toBeGreaterThanOrEqual(8)
  const naDialogBox = await page.getByRole("dialog", { name: "NAs do atendimento" }).boundingBox()
  expect(naDialogBox).not.toBeNull()
  expect(naDialogBox!.width).toBeCloseTo(390, 0)
  expect(naDialogBox!.height).toBeCloseTo(844, 0)
  const informationButtonBox = await page.getByRole("button", { name: "Ver informações", exact: true }).boundingBox()
  const finishSliderBox = await page.locator('[data-attendance-slider="finish"]').boundingBox()
  expect(informationButtonBox).not.toBeNull()
  expect(finishSliderBox).not.toBeNull()
  expect(informationButtonBox!.x + informationButtonBox!.width).toBeLessThan(finishSliderBox!.x)
  expect(Math.abs(informationButtonBox!.y - finishSliderBox!.y)).toBeLessThanOrEqual(1)
  await expect(page.getByRole("button", { name: "Editar agendamento", exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole("button", { name: "Ver informações", exact: true }).click()
  await expect(page.getByRole("dialog", { name: new RegExp(inProgressSchedule.clientName) })).toBeVisible()
  const informationBackButton = page.getByRole("button", { name: "Voltar para NAs do atendimento" })
  await expect(informationBackButton).toHaveClass(/text-foreground/)
  await informationBackButton.click()
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Encerrar atendimento", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Encerrar atendimento", exact: true })).toBeVisible()
  const checkoutBackButton = page.getByRole("button", { name: "Voltar para NAs do atendimento" })
  await expect(checkoutBackButton).toHaveClass(/text-foreground/)
  await checkoutBackButton.click()
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()

  await page.keyboard.press("Escape")
  await page.goto(`/agendamentos/${inProgressSchedule.id}`)
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/\/agendamentos$/)
})

test("editor pode editar atendimento em andamento e usa a ação Concluir", async ({ page }) => {
  const editorUser = {
    ...E2E_USER,
    id: "user-schedule-in-progress-editor",
    permissions: ["agenda_view", "agenda_manage"],
  }
  const inProgressSchedule = {
    ...scheduleFixture,
    id: "schedule-in-progress-editable",
    contractId: null,
    contractServiceId: null,
    contractServiceIds: [],
    isManual: true,
    status: "in_progress" as const,
    canAttachNa: true,
  }

  await installAuthenticatedSession(page, editorUser)
  await installApiMock(page, editorUser)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request()
    if (request.method() === "GET" && new URL(request.url()).pathname === "/api/v1/schedules") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: [inProgressSchedule] }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/agendamentos")
  await page.getByRole("button", { name: `Abrir ações do agendamento de ${inProgressSchedule.clientName}` }).click()

  const editAction = page.getByRole("menuitem", { name: "Editar", exact: true })
  await expect(editAction).toBeEnabled()
  await expect(page.getByRole("menuitem", { name: "Concluir", exact: true })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "NAs e conclusão", exact: true })).toHaveCount(0)

  await page.getByRole("menuitem", { name: "Visualizar", exact: true }).click()
  await expect(page.getByRole("heading", { name: "NAs do atendimento", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Editar atendimento avulso", exact: true })).toBeVisible()

  await page.keyboard.press("Escape")
  await page.goto(`/agenda?scheduleId=${inProgressSchedule.id}`)
  const agendaNaHeading = page.getByRole("heading", { name: "NAs do atendimento", exact: true })
  const agendaBackButton = page.getByRole("button", { name: "Voltar", exact: true })
  await expect(agendaNaHeading).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => {
    const [headingBox, backButtonBox] = await Promise.all([
      agendaNaHeading.boundingBox(),
      agendaBackButton.boundingBox(),
    ])
    if (!headingBox || !backButtonBox) return -1
    return headingBox.y - backButtonBox.y - backButtonBox.height
  }).toBeGreaterThanOrEqual(8)
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Editar atendimento avulso", exact: true })).toBeVisible()
})

test("filtros editáveis mantêm 16px no mobile para evitar o zoom automático do iPhone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installAuthenticatedSession(page, E2E_USER)
  await installApiMock(page, E2E_USER)

  await page.goto("/agendamentos")
  await page.getByRole("button", { name: "Filtros", exact: true }).click()

  const editableFilters = [
    page.getByPlaceholder("Buscar cliente, serviço, equipe..."),
    page.getByLabel("Data inicial"),
    page.getByLabel("Data final"),
  ]

  for (const filter of editableFilters) {
    await expect(filter).toBeVisible()
    const fontSize = await filter.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    expect(fontSize).toBeGreaterThanOrEqual(16)
  }

  const [searchBox, initialDateBox, finalDateBox] = await Promise.all(
    editableFilters.map((filter) => filter.boundingBox()),
  )
  expect(searchBox).not.toBeNull()
  expect(initialDateBox).not.toBeNull()
  expect(finalDateBox).not.toBeNull()
  expect(initialDateBox!.x).toBeCloseTo(searchBox!.x, 0)
  expect(finalDateBox!.x + finalDateBox!.width).toBeCloseTo(searchBox!.x + searchBox!.width, 0)

  await page.getByRole("combobox", { name: "Status" }).click()
  const statusSearch = page.getByPlaceholder("Buscar status...")
  await expect(statusSearch).toBeVisible()
  const statusSearchFontSize = await statusSearch.evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).fontSize)
  ))
  expect(statusSearchFontSize).toBeGreaterThanOrEqual(16)

  await page.setViewportSize({ width: 844, height: 390 })
  for (const filter of [...editableFilters, statusSearch]) {
    const fontSize = await filter.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    expect(fontSize).toBeGreaterThanOrEqual(16)
  }
})
