import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test("gráfico de contratos usa os mesmos totais dos indicadores", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.goto("/")

  const activeCard = page
    .getByRole("heading", { name: "Contratos Vigentes", exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
  const inactiveCard = page
    .getByRole("heading", { name: "Contratos Vencidos", exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
  const chartHeading = page.getByRole("heading", { name: "Contratos por status", exact: true })
  const chart = chartHeading.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")

  await expect(activeCard.getByText("90", { exact: true })).toBeVisible()
  await expect(inactiveCard.getByText("3", { exact: true })).toBeVisible()
  await expect(chartHeading).toBeVisible()
  await expect(chart.getByText("98", { exact: true })).toBeVisible()
  await expect(chart.getByText("contratos", { exact: true })).toBeVisible()
  await expect(chart.getByText("90", { exact: true })).toBeVisible()
  await expect(chart.getByText("3", { exact: true })).toBeVisible()
  await expect(chart.getByText("Aguardando envio", { exact: true })).toBeVisible()
  await expect(chart.getByText("Aguardando assinatura", { exact: true })).toBeVisible()
  await expect(chart.getByText("Assinados", { exact: true })).toBeVisible()
  await expect(chart.getByText("Vigentes", { exact: true })).toBeVisible()
  await expect(chart.getByText("Vencidos", { exact: true })).toBeVisible()
  await expect(chart.getByText("Cancelados", { exact: true })).toBeVisible()
  await expect(chart.getByRole("link", { name: /ver todos/i })).toHaveAttribute("href", "/contratos")
  await expect(page.getByRole("heading", { name: "Clientes por status", exact: true })).toHaveCount(0)
})

test("gráfico de contratos permanece inteiro em telas menores", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.goto("/")

  const heading = page.getByRole("heading", { name: "Contratos por status", exact: true })
  const card = heading.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
  const chartSurface = card.locator("svg.recharts-surface").first()
  const lastLegendItem = card.getByText("Cancelados", { exact: true })

  await expect(heading).toBeVisible()
  await expect(chartSurface).toBeVisible()
  await expect(lastLegendItem).toBeVisible()

  const [cardBox, chartBox, legendBox] = await Promise.all([
    card.boundingBox(),
    chartSurface.boundingBox(),
    lastLegendItem.boundingBox(),
  ])

  expect(cardBox).not.toBeNull()
  expect(chartBox).not.toBeNull()
  expect(legendBox).not.toBeNull()
  expect(chartBox!.height).toBeGreaterThanOrEqual(200)
  expect(chartBox!.y).toBeGreaterThanOrEqual(cardBox!.y)
  expect(chartBox!.y + chartBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height)
  expect(legendBox!.y + legendBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height)
})

test("exibe vencimentos e valor de renovação dos próximos seis meses", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.goto("/")

  const heading = page.getByRole("heading", { name: "Renovações de Contratos", exact: true })
  const chart = heading.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")

  await expect(heading).toBeVisible()
  await expect(chart.getByText("6 contratos", { exact: true })).toBeVisible()
  await expect(chart.getByText(/R\$\s*27\.600/)).toBeVisible()
  await expect(chart.getByRole("tab", { name: "Quantidade", exact: true })).toHaveAttribute("data-state", "active")
  await chart.getByRole("tab", { name: "Valor", exact: true }).click()
  await expect(chart.getByRole("tab", { name: "Valor", exact: true })).toHaveAttribute("data-state", "active")
  await expect(chart.getByRole("link", { name: /ver contratos/i })).toHaveAttribute("href", "/contratos")
  await expect(page.getByRole("heading", { name: "Produtividade das Equipes", exact: true })).toHaveCount(0)

  const periodPicker = chart.getByRole("button", { name: "Selecionar período das renovações" })
  await expect(periodPicker).toContainText("6 meses")
  await periodPicker.click()
  await page.getByRole("menuitemradio", { name: "3 meses" }).click()
  await expect(periodPicker).toContainText("3 meses")
  await expect(chart.getByText("3 contratos", { exact: true })).toBeVisible()
  await expect(chart.getByText(/R\$\s*12\.600/)).toBeVisible()
  await expect(chart.getByText("Out/26", { exact: true })).toHaveCount(0)

  await periodPicker.click()
  await page.getByRole("menuitemradio", { name: "1 mês" }).click()
  await expect(periodPicker).toContainText("1 mês")
  await expect(chart.getByText("2 contratos", { exact: true })).toBeVisible()
  await expect(chart.getByText(/R\$\s*8\.400/)).toBeVisible()
  await expect(chart.getByText("Ago/26", { exact: true })).toHaveCount(0)

  await page.getByRole("tab", { name: "60 dias", exact: true }).click()
  await expect(periodPicker).toContainText("1 mês")
  await expect(chart.getByText("2 contratos", { exact: true })).toBeVisible()
})
