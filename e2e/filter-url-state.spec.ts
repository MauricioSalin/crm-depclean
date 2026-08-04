import { expect, test } from "@playwright/test"

import { clientTypeFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("persiste período e status completo nos agendamentos", async ({ page }) => {
  await page.goto(
    "/agendamentos?q=Condom%C3%ADnio&status=rescheduled&dateFrom=2026-07-08&dateTo=2026-08-10",
  )

  await expect(page.getByPlaceholder("Buscar cliente, serviço, equipe...")).toHaveValue("Condomínio")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Reagendado")
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveValue("08/07/2026")
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveValue("10/08/2026")

  await page.getByRole("textbox", { name: "Data inicial" }).fill("09/07/2026")
  await expect.poll(() => new URL(page.url()).searchParams.get("dateFrom")).toBe("2026-07-09")
  await expect.poll(() => new URL(page.url()).searchParams.get("dateTo")).toBe("2026-08-10")

  await page.reload()
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveValue("09/07/2026")
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveValue("10/08/2026")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Reagendado")
})

test("aplica limites isolados e impede data final anterior à inicial", async ({ page }) => {
  await page.goto("/agendamentos?dateFrom=2026-07-29")

  const fromInput = page.getByRole("textbox", { name: "Data inicial" })
  const toInput = page.getByRole("textbox", { name: "Data final" })
  const scheduleClient = page.getByText("Condomínio E2E", { exact: true })

  await expect(fromInput).toHaveValue("29/07/2026")
  await expect(toInput).toHaveValue("")
  await expect(page.getByText("Nenhum agendamento encontrado.", { exact: true })).toBeVisible()

  await fromInput.fill("")
  await toInput.fill("28/07/2026")
  await expect(scheduleClient).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get("dateFrom")).toBeNull()
  await expect.poll(() => new URL(page.url()).searchParams.get("dateTo")).toBe("2026-07-28")

  await toInput.fill("27/07/2026")
  await expect(page.getByText("Nenhum agendamento encontrado.", { exact: true })).toBeVisible()

  await fromInput.fill("29/07/2026")
  await expect(toInput).toHaveValue("")
  await toInput.fill("27/07/2026")
  await expect(fromInput).toHaveValue("29/07/2026")
  await expect(toInput).toHaveValue("")
  await expect.poll(() => new URL(page.url()).searchParams.get("dateFrom")).toBe("2026-07-29")
  await expect.poll(() => new URL(page.url()).searchParams.get("dateTo")).toBeNull()
})

test("envia ao Dashboard e aos Relatórios somente o limite preenchido", async ({ page }) => {
  const dashboardRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname.endsWith("/analytics/dashboard")
      && url.searchParams.get("dateFrom") === "2026-07-29"
      && !url.searchParams.has("dateTo")
    )
  })

  await page.goto("/?period=custom&dateFrom=2026-07-29")
  await dashboardRequest
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveValue("29/07/2026")
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveValue("")

  const reportsRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname.endsWith("/analytics/reports")
      && url.searchParams.get("dateTo") === "2026-07-27"
      && !url.searchParams.has("dateFrom")
    )
  })

  await page.goto("/relatorios?tab=services&dateTo=2026-07-27")
  await reportsRequest
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveValue("")
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveValue("27/07/2026")
})

test("persiste data, visualização e status na Agenda", async ({ page }) => {
  await page.goto(
    "/agenda?date=2027-09-01&status=rescheduled&view=month&q=Condom%C3%ADnio&dateFrom=2027-09-01&dateTo=2027-09-30",
  )

  await expect(page.getByPlaceholder("Buscar cliente, serviço, equipe...")).toHaveValue("Condomínio")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Reagendado")
  await expect(page.getByRole("button", { name: "Filtrar mês e ano: Setembro 2027" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).searchParams.get("dateFrom")).toBeNull()
  await expect.poll(() => new URL(page.url()).searchParams.get("dateTo")).toBeNull()
  await expect(page.getByRole("tab", { name: "Mês" })).toHaveAttribute("data-state", "active")
  await expect(page.getByRole("button", { name: "Selecionar mês e ano: Setembro 2027" })).toBeVisible()

  await page.getByRole("tab", { name: "Semana" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("week")

  await page.reload()
  await expect(page.getByRole("tab", { name: "Semana" })).toHaveAttribute("data-state", "active")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Reagendado")
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveValue("")
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveValue("")
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2027-09-01")
})

test("filtra a Agenda pelas mesmas regras de período e Hoje limpa o filtro", async ({ page }) => {
  await page.goto("/agenda?date=2026-07-28&dateFrom=2026-07-28&dateTo=2026-07-28")

  const fromInput = page.getByRole("textbox", { name: "Data inicial" })
  const toInput = page.getByRole("textbox", { name: "Data final" })
  const timelineEvent = page.locator("button").filter({ hasText: "Condomínio E2E" })

  await expect(fromInput).toHaveValue("28/07/2026")
  await expect(toInput).toHaveValue("28/07/2026")
  await expect(timelineEvent).toBeVisible()

  await fromInput.fill("29/07/2026")
  await expect(toInput).toHaveValue("")
  await expect(timelineEvent).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).searchParams.get("dateFrom")).toBe("2026-07-29")
  await expect.poll(() => new URL(page.url()).searchParams.get("dateTo")).toBeNull()

  await toInput.fill("27/07/2026")
  await expect(toInput).toHaveValue("")

  await page.getByRole("button", { name: "Hoje", exact: true }).click()
  await expect(fromInput).toHaveValue("")
  await expect(toInput).toHaveValue("")
  await expect.poll(() => new URL(page.url()).searchParams.get("dateFrom")).toBeNull()
  await expect.poll(() => new URL(page.url()).searchParams.get("dateTo")).toBeNull()
})

test("restaura os filtros das demais páginas do menu", async ({ page }) => {
  await page.goto(`/clientes?type=${clientTypeFixture.id}`)
  await expect(page.getByRole("combobox", { name: "Tipo" })).toContainText(clientTypeFixture.name)

  await page.goto("/funcionarios?status=inactive")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Inativos")

  await page.goto("/certificados?q=Condom%C3%ADnio&status=sent")
  await expect(page.getByPlaceholder("Buscar cliente, serviço, equipe...")).toHaveValue("Condomínio")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Enviados")

  await page.goto(
    "/relatorios?tab=financial&dateFrom=2026-07-01&dateTo=2026-07-31&paymentStatus=cancelled",
  )
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveValue("01/07/2026")
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveValue("31/07/2026")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Canceladas")
  await page.getByRole("button", { name: "Limpar data inicial" }).click()
  await page.getByRole("button", { name: "Limpar data final" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("range")).toBe("all")
  await expect.poll(() => new URL(page.url()).searchParams.get("paymentStatus")).toBe("cancelled")

  await page.goto("/?period=custom&dateFrom=2026-06-01&dateTo=2026-06-30")
  await expect(page.getByRole("tab", { name: "Outro" })).toHaveAttribute("data-state", "active")
  await expect(page.getByRole("textbox", { name: "Data inicial" })).toHaveValue("01/06/2026")
  await expect(page.getByRole("textbox", { name: "Data final" })).toHaveValue("30/06/2026")
})
