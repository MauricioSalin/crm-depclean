import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("seleciona mês e ano e abre a primeira semana do período", async ({ page }) => {
  await page.goto("/agenda")
  await expect(page.locator("main")).toBeVisible()

  const periodButton = page.getByRole("button", { name: /Selecionar mês e ano:/ })
  await expect(periodButton).toHaveCSS("cursor", "pointer")
  await expect(periodButton).toHaveClass(/data-\[state=open\]:bg-muted\/70/)
  await periodButton.click()
  await expect(periodButton).toHaveAttribute("data-state", "open")

  const yearPicker = page.getByRole("combobox", { name: "Ano", exact: true })
  await expect(yearPicker).toHaveCSS("cursor", "pointer")
  await yearPicker.click()
  const yearOption = page.getByRole("option", { name: "2027", exact: true })
  await expect(yearOption).toHaveCSS("cursor", "pointer")
  await yearOption.click()
  const monthOption = page.getByRole("menu").getByRole("button", { name: "Set", exact: true })
  await expect(monthOption).toHaveCSS("cursor", "pointer")
  await monthOption.click()

  await expect(periodButton).toHaveText("Ago. - Set. 2027")
  await expect(page.getByRole("button", { name: "QUA. 1", exact: true })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2027-09-01")
})

test("seleciona mês e ano pelo título centralizado da visualização mensal", async ({ page }) => {
  await page.goto("/agenda?date=2026-07-28&view=month")

  const periodButton = page.getByRole("button", { name: "Selecionar mês e ano: Julho 2026" })
  await expect(periodButton).toBeVisible()
  await periodButton.click()
  await page.getByRole("combobox", { name: "Ano", exact: true }).click()
  await page.getByRole("option", { name: "2027", exact: true }).click()
  await page.getByRole("menu").getByRole("button", { name: "Set", exact: true }).click()

  await expect(page.getByRole("button", { name: "Selecionar mês e ano: Setembro 2027" })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2027-09-01")
})

test("mantém navegação e paddings de mês alinhados ao padrão semanal", async ({ page }) => {
  await page.goto("/agenda?date=2026-07-28&view=week")

  const weeklyNavigation = page.locator("[data-agenda-period-navigation]")
  await expect(weeklyNavigation).toHaveCSS("height", "56px")
  await expect(weeklyNavigation).toHaveCSS("border-bottom-width", "0px")

  await page.getByRole("tab", { name: "Mês", exact: true }).click()
  const monthCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole("button", { name: /Selecionar mês e ano:/ }) }).first()
  const monthlyNavigation = monthCard.locator("[data-agenda-period-navigation]")
  await expect(monthlyNavigation).toHaveCSS("height", "56px")
  await expect(monthlyNavigation).toHaveCSS("padding-left", "12px")
  await expect(monthCard).toHaveCSS("padding-top", "0px")
  await expect(monthCard).toHaveCSS("row-gap", "0px")
  await expect(monthCard.locator('[data-slot="card-content"]')).toHaveCSS("padding-left", "0px")
  await expect(monthCard.getByRole("button", { name: "Hoje", exact: true })).toBeVisible()
})

test("troca somente o filtro de período conforme a visualização", async ({ page }) => {
  await page.goto("/agenda?date=2026-07-28&view=day&q=Condom%C3%ADnio&status=scheduled&dateFrom=2026-07-01&dateTo=2026-07-31")

  await expect(page.getByRole("button", { name: "Filtrar dia" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveCount(0)
  await expect(page.getByPlaceholder("Buscar cliente, serviço, equipe...")).toHaveValue("Condomínio")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Agendado")
  await expect.poll(() => new URL(page.url()).searchParams.get("dateFrom")).toBeNull()
  await expect.poll(() => new URL(page.url()).searchParams.get("dateTo")).toBeNull()

  await page.getByRole("tab", { name: "Semana", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Data final" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Filtrar dia" })).toHaveCount(0)

  await page.getByRole("tab", { name: "Mês", exact: true }).click()
  const monthFilter = page.getByRole("button", { name: "Filtrar mês e ano: Julho 2026" })
  await expect(monthFilter).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveCount(0)
  await monthFilter.click()
  await page.getByRole("menu").getByRole("button", { name: "Set", exact: true }).click()
  await expect(page.getByRole("button", { name: "Filtrar mês e ano: Setembro 2026" })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2026-09-01")
})

test("desliza o seletor de visualização junto com o filtro de período", async ({ page }) => {
  await page.goto("/agenda?date=2026-07-28&view=day")

  const tabs = page.locator("[data-agenda-view-tabs]")
  const periodFilter = page.locator("[data-agenda-period-filter]")
  const indicator = tabs.locator('[data-slot="tabs-indicator"]')
  await expect(tabs).toBeVisible()
  await expect(periodFilter).toHaveCSS("transition-property", "width")
  await expect(periodFilter).toHaveCSS("transition-duration", "0.5s")
  await expect(indicator).toHaveCSS("transition-duration", "0.5s")

  const dayTabsBox = await tabs.boundingBox()
  expect(dayTabsBox).not.toBeNull()
  const dayIndicatorX = await indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)

  await page.getByRole("tab", { name: "Semana", exact: true }).click()
  await expect(page.getByRole("tab", { name: "Semana", exact: true })).toHaveAttribute("data-state", "active")
  await expect.poll(async () => (await tabs.boundingBox())?.x ?? 0).toBeGreaterThan(dayTabsBox!.x + 75)
  const weekIndicatorX = await indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)
  expect(weekIndicatorX).toBeGreaterThan(dayIndicatorX)

  await page.getByRole("tab", { name: "Mês", exact: true }).click()
  await expect(page.getByRole("tab", { name: "Mês", exact: true })).toHaveAttribute("data-state", "active")
  await expect.poll(async () => (await tabs.boundingBox())?.x ?? 0).toBeLessThan(dayTabsBox!.x + 10)
  const monthIndicatorX = await indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)
  expect(monthIndicatorX).toBeGreaterThan(weekIndicatorX)
})
