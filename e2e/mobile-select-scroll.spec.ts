import { expect, test, type Locator, type Page } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

async function swipeUp(page: Page, target: Locator) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()

  const client = await page.context().newCDPSession(page)
  const x = box!.x + box!.width / 2
  const startY = box!.y + box!.height - 16
  const endY = box!.y + 20

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  })

  for (let step = 1; step <= 6; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: startY + ((endY - startY) * step) / 6 }],
    })
  }

  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}

async function expectTouchScroll(page: Page, scroller: Locator) {
  await expect(scroller).toBeVisible()
  await expect.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)

  const initialScrollTop = await scroller.evaluate((element) => element.scrollTop)
  await swipeUp(page, scroller)
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(initialScrollTop)
}

test("permite rolar selects, selects pesquisáveis e multiselects no mobile", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)

  const clientTypes = Array.from({ length: 30 }, (_, index) => ({
    id: `client-type-${index + 1}`,
    name: `Tipo de cliente ${String(index + 1).padStart(2, "0")}`,
    color: "bg-blue-500",
  }))

  await page.route("**/api/v1/clients/catalog/types", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: clientTypes }),
    })
  })

  await page.goto("/clientes/novo")
  await page.getByRole("combobox", { name: "Selecione o tipo" }).click()
  await expectTouchScroll(page, page.locator('[data-slot="command-list"]'))
  await page.keyboard.press("Escape")

  const selectableServices = Array.from({ length: 30 }, (_, index) => ({
    id: `selectable-service-${index + 1}`,
    name: `Serviço selecionável ${String(index + 1).padStart(2, "0")}`,
    isActive: true,
    teamIds: [],
    employeeIds: [],
  }))

  await page.route("**/api/v1/services**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (route.request().method() === "GET" && pathname === "/api/v1/services") {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ success: true, data: selectableServices }),
      })
      return
    }
    await route.fallback()
  })

  await page.goto("/agendamentos")
  await page.getByRole("button", { name: "Novo Agendamento" }).click()
  const scheduleDialog = page.getByRole("dialog")
  const servicesCombobox = page.getByRole("combobox").filter({ hasText: "Buscar e adicionar serviços" })
  await servicesCombobox.click()
  const dialogPopoverList = page.locator('[data-slot="command-list"]')
  await expectTouchScroll(page, dialogPopoverList)
  expect(await dialogPopoverList.evaluate((element) => element.closest('[data-slot="dialog-content"]'))).toBeNull()
  await page.keyboard.press("Escape")

  const durationTypeSelect = scheduleDialog.getByText("Tipo de Duração", { exact: true }).locator("..").getByRole("combobox")
  await expect(durationTypeSelect).toHaveCSS("cursor", "pointer")
  await durationTypeSelect.click()
  const dialogSelectContent = page.locator('[data-slot="select-content"]')
  await expect(dialogSelectContent).toBeVisible()
  expect(await dialogSelectContent.evaluate((element) => element.closest('[data-slot="dialog-content"]'))).toBeNull()
  const minutesOption = dialogSelectContent.getByRole("option", { name: "Minutos" })
  await expect(minutesOption).toHaveCSS("cursor", "pointer")
  await minutesOption.click()

  await page.setViewportSize({ width: 390, height: 480 })
  await page.goto("/logs")
  await page.getByRole("button", { name: "Filtros" }).click()
  const moduleFilter = page.getByText("Funcionalidade", { exact: true }).locator("..").getByRole("combobox")
  await moduleFilter.click()
  await expectTouchScroll(page, page.locator("[data-radix-select-viewport]"))
  await page.keyboard.press("Escape")
  await page.setViewportSize({ width: 390, height: 844 })

  const services = Array.from({ length: 30 }, (_, index) => ({
    id: `service-${index + 1}`,
    name: `Serviço ${String(index + 1).padStart(2, "0")}`,
    isActive: true,
  }))

  await page.route("**/api/v1/analytics/reports**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        data: {
          services,
          teams: [],
          employees: [],
          clients: [],
          contracts: [],
          financialEntries: [],
          scheduleDetails: [],
          serviceClientSummary: [],
          monthlyRevenueData: [],
          servicesByPeriodData: [],
          servicesByTeamData: [],
          servicesSummaryData: [],
          servicesParticipationData: [],
        },
      }),
    })
  })

  await page.goto("/relatorios?tab=services")
  await page.getByRole("combobox", { name: "Todos os serviços" }).click()
  await expectTouchScroll(page, page.locator('[data-slot="command-list"]'))
})
