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

test("persiste data, visualização e status na Agenda", async ({ page }) => {
  await page.goto("/agenda?date=2027-09-01&status=rescheduled&view=month&q=Condom%C3%ADnio")

  await expect(page.getByPlaceholder("Buscar cliente, serviço, equipe...")).toHaveValue("Condomínio")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Reagendado")
  await expect(page.getByRole("tab", { name: "Mês" })).toHaveAttribute("data-state", "active")
  await expect(page.getByText("Setembro 2027", { exact: true })).toBeVisible()

  await page.getByRole("tab", { name: "Semana" }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("week")

  await page.reload()
  await expect(page.getByRole("tab", { name: "Semana" })).toHaveAttribute("data-state", "active")
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText("Reagendado")
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2027-09-01")
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
