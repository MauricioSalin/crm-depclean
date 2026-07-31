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
  const servicesChart = page
    .getByText("Serviços por Período", { exact: true })
    .locator("xpath=ancestor::div[@data-slot='card'][1]")

  await expect(activeCard.getByText("90", { exact: true })).toBeVisible()
  await expect(inactiveCard.getByText("3", { exact: true })).toBeVisible()
  await expect(chartHeading).toBeVisible()
  await expect(chart.getByText("98", { exact: true })).toBeVisible()
  await expect(chart.getByText("contratos", { exact: true })).toBeVisible()
  await expect(servicesChart.getByText("0", { exact: true })).toBeVisible()
  await expect(servicesChart.getByText("serviços", { exact: true })).toBeVisible()
  await expect(chart.getByText("Aguardando envio: 1%", { exact: true })).toBeVisible()
  await expect(chart.getByText("Aguardando assinatura: 2%", { exact: true })).toBeVisible()
  await expect(chart.getByText("Assinados: 1%", { exact: true })).toBeVisible()
  await expect(chart.getByText("Vigentes: 92%", { exact: true })).toBeVisible()
  await expect(chart.getByText("Vencidos: 3%", { exact: true })).toBeVisible()
  await expect(chart.getByText("Renovados: 1%", { exact: true })).toBeVisible()
  await expect(chart.getByText("Cancelados", { exact: true })).toHaveCount(0)
  const slices = chart.locator("path.recharts-sector")
  await expect(slices).toHaveCount(6)
  await expect(slices.nth(0)).toHaveAttribute("fill", "#F59E0B")
  await expect(slices.nth(1)).toHaveAttribute("fill", "#3B82F6")
  await expect(slices.nth(2)).toHaveAttribute("fill", "#14B8A6")
  await expect(slices.nth(3)).toHaveAttribute("fill", "var(--primary)")
  await expect(slices.nth(4)).toHaveAttribute("fill", "#EF4444")
  await expect(slices.nth(5)).toHaveAttribute("fill", "#6366F1")
  await expect(chart.getByRole("link", { name: /ver todos/i })).toHaveAttribute("href", "/contratos")
  await expect(page.getByRole("heading", { name: "Clientes por status", exact: true })).toHaveCount(0)
})

test("centraliza o gráfico e posiciona a legenda compacta abaixo sem cortes", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.goto("/")

  const heading = page.getByRole("heading", { name: "Contratos por status", exact: true })
  const card = heading.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
  const chartSurface = card.locator("svg.recharts-surface").first()
  const legendItems = [
    card.getByText("Aguardando envio: 1%", { exact: true }),
    card.getByText("Aguardando assinatura: 2%", { exact: true }),
    card.getByText("Assinados: 1%", { exact: true }),
    card.getByText("Vigentes: 92%", { exact: true }),
    card.getByText("Vencidos: 3%", { exact: true }),
    card.getByText("Renovados: 1%", { exact: true }),
  ]
  const firstLegendItem = legendItems[0]
  const lastLegendItem = legendItems[5]

  await expect(heading).toBeVisible()
  await expect(chartSurface).toBeVisible()
  await Promise.all(legendItems.map((item) => expect(item).toBeVisible()))

  const [cardBox, chartBox, ...legendBoxes] = await Promise.all([
    card.boundingBox(),
    chartSurface.boundingBox(),
    ...legendItems.map((item) => item.locator("xpath=parent::*").boundingBox()),
  ])

  expect(cardBox).not.toBeNull()
  expect(chartBox).not.toBeNull()
  legendBoxes.forEach((box) => expect(box).not.toBeNull())
  expect(chartBox!.width).toBeGreaterThanOrEqual(240)
  expect(chartBox!.width).toBeLessThanOrEqual(260)
  expect(Math.abs((chartBox!.x + chartBox!.width / 2) - (cardBox!.x + cardBox!.width / 2))).toBeLessThanOrEqual(8)
  expect(legendBoxes[0]!.y).toBeGreaterThanOrEqual(chartBox!.y + chartBox!.height)
  expect(Math.abs(legendBoxes[0]!.y - legendBoxes[1]!.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(legendBoxes[1]!.y - legendBoxes[2]!.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(legendBoxes[3]!.y - legendBoxes[4]!.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(legendBoxes[4]!.y - legendBoxes[5]!.y)).toBeLessThanOrEqual(2)
  expect(legendBoxes[3]!.y).toBeGreaterThan(legendBoxes[0]!.y)
  expect(legendBoxes[1]!.x - (legendBoxes[0]!.x + legendBoxes[0]!.width)).toBeLessThanOrEqual(20)
  expect(legendBoxes[2]!.x - (legendBoxes[1]!.x + legendBoxes[1]!.width)).toBeLessThanOrEqual(20)
  expect(legendBoxes[4]!.x - (legendBoxes[3]!.x + legendBoxes[3]!.width)).toBeLessThanOrEqual(20)
  expect(legendBoxes[5]!.x - (legendBoxes[4]!.x + legendBoxes[4]!.width)).toBeLessThanOrEqual(20)

  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(chartSurface).toBeVisible()
  await expect(lastLegendItem).toBeVisible()

  const [narrowCardBox, narrowChartBox, narrowLegendBox] = await Promise.all([
    card.boundingBox(),
    chartSurface.boundingBox(),
    lastLegendItem.boundingBox(),
  ])

  expect(narrowCardBox).not.toBeNull()
  expect(narrowChartBox).not.toBeNull()
  expect(narrowLegendBox).not.toBeNull()
  expect(narrowChartBox!.height).toBeGreaterThanOrEqual(200)
  expect(narrowChartBox!.y).toBeGreaterThanOrEqual(narrowCardBox!.y)
  expect(narrowChartBox!.y + narrowChartBox!.height).toBeLessThanOrEqual(narrowCardBox!.y + narrowCardBox!.height)
  expect(narrowLegendBox!.y + narrowLegendBox!.height).toBeLessThanOrEqual(narrowCardBox!.y + narrowCardBox!.height)
})

test("exibe vencimentos e valor de renovação dos próximos seis meses", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.goto("/")

  const heading = page.getByRole("heading", { name: "Renovações de Contratos", exact: true })
  const chart = heading.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
  const periodPicker = chart.getByRole("button", { name: "Selecionar período das renovações" })
  const quantityTab = chart.getByRole("tab", { name: "Quantidade", exact: true })
  const contractsMetric = chart
    .getByText("6 contratos", { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
  const valueMetric = chart
    .getByText(/R\$\s*27\.600/)
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")

  await expect(heading).toBeVisible()
  await expect(chart.getByText("6 contratos", { exact: true })).toBeVisible()
  await expect(chart.getByText(/R\$\s*27\.600/)).toBeVisible()
  await expect(chart.getByText("Vencimentos nos próximos 6 meses", { exact: true })).toHaveCount(0)
  await expect(chart.getByRole("link", { name: /ver contratos/i })).toHaveCount(0)
  await expect(quantityTab).toHaveAttribute("data-state", "active")

  const [headingBox, periodBox, tabsBox, contractsBox, valueBox, chartBox] = await Promise.all([
    heading.boundingBox(),
    periodPicker.boundingBox(),
    quantityTab.locator("xpath=parent::*").boundingBox(),
    contractsMetric.boundingBox(),
    valueMetric.boundingBox(),
    chart.boundingBox(),
  ])

  expect(headingBox).not.toBeNull()
  expect(periodBox).not.toBeNull()
  expect(tabsBox).not.toBeNull()
  expect(contractsBox).not.toBeNull()
  expect(valueBox).not.toBeNull()
  expect(chartBox).not.toBeNull()
  expect(periodBox!.x).toBeGreaterThan(headingBox!.x + headingBox!.width)
  expect(Math.abs(periodBox!.y - headingBox!.y)).toBeLessThanOrEqual(6)
  expect(tabsBox!.x).toBeGreaterThan(periodBox!.x + periodBox!.width)
  expect(tabsBox!.y).toBeLessThan(contractsBox!.y)
  expect(Math.abs(contractsBox!.width - valueBox!.width)).toBeLessThanOrEqual(2)
  expect(contractsBox!.x).toBeLessThan(valueBox!.x)
  expect(valueBox!.x + valueBox!.width).toBeGreaterThanOrEqual(chartBox!.x + chartBox!.width - 18)

  await chart.getByRole("tab", { name: "Valor", exact: true }).click()
  await expect(chart.getByRole("tab", { name: "Valor", exact: true })).toHaveAttribute("data-state", "active")
  await expect(page.getByRole("heading", { name: "Produtividade das Equipes", exact: true })).toHaveCount(0)

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
