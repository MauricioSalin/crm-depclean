import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const sidebarDestinations = [
  ["Dashboard", "/"],
  ["Clientes", "/clientes"],
  ["Contratos", "/contratos"],
  ["Serviços", "/servicos"],
  ["Equipes", "/equipes"],
  ["Funcionários", "/funcionarios"],
  ["Agenda", "/agenda"],
  ["Agendamentos", "/agendamentos"],
  ["Certificados", "/certificados"],
  ["Relatórios", "/relatorios"],
  ["Notificações", "/notificacoes"],
  ["DepAI", "/depai"],
  ["Ajuda", "/ajuda"],
] as const

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

for (const [label, path] of sidebarDestinations) {
  test(`menu ${label} navega para ${path}`, async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: label, exact: true }).first().click()
    await expect(page).toHaveURL(path)
    await expect(page.locator("main")).toBeVisible()
  })
}

test("todos os links visíveis possuem nome acessível", async ({ page }) => {
  await page.goto("/")

  const unnamedLinks = await page.getByRole("link").evaluateAll((links) =>
    links
      .filter((link) => {
        const element = link as HTMLElement
        return element.offsetParent !== null
      })
      .filter((link) => {
        const element = link as HTMLElement
        return !(element.innerText.trim() || element.getAttribute("aria-label") || element.getAttribute("title"))
      })
      .map((link) => (link as HTMLElement).outerHTML.slice(0, 200)),
  )

  expect(unnamedLinks).toEqual([])
})
