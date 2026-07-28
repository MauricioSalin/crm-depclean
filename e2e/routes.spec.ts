import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

type RouteCase = {
  path: string
  heading?: string
}

const authenticatedRoutes: RouteCase[] = [
  { path: "/", heading: "Dashboard" },
  { path: "/agenda", heading: "Agenda" },
  { path: "/agendamentos", heading: "Agendamentos" },
  { path: "/agendamentos/schedule-e2e" },
  { path: "/ajuda", heading: "Ajuda" },
  { path: "/certificados", heading: "Certificados" },
  { path: "/certificados/schedule-e2e", heading: "Gerar Certificado" },
  { path: "/clientes", heading: "Clientes" },
  { path: "/clientes/client-e2e", heading: "Perfil do Cliente" },
  { path: "/clientes/client-e2e/editar", heading: "Editar Cliente" },
  { path: "/clientes/novo", heading: "Novo Cliente" },
  { path: "/configuracoes", heading: "Configurações" },
  { path: "/contratos", heading: "Contratos" },
  { path: "/contratos/contract-e2e", heading: "Detalhes do Contrato" },
  { path: "/contratos/contract-e2e/editar", heading: "Editar Contrato" },
  { path: "/contratos/novo", heading: "Novo Contrato" },
  { path: "/custos-operacionais", heading: "Custos Operacionais" },
  { path: "/depai", heading: "DepAI" },
  { path: "/equipes", heading: "Equipes" },
  { path: "/financeiro" },
  { path: "/funcionarios", heading: "Funcionários" },
  { path: "/logs", heading: "Logs do Sistema" },
  { path: "/notificacoes", heading: "Notificações" },
  { path: "/perfil", heading: "Meu Perfil" },
  { path: "/relatorios", heading: "Relatórios" },
  { path: "/servicos", heading: "Serviços" },
  { path: "/servicos/service-e2e/editar", heading: "Editar Serviço" },
  { path: "/servicos/novo", heading: "Novo Serviço" },
  { path: "/templates", heading: "Templates" },
]

test.describe("integridade das rotas autenticadas", () => {
  test.beforeEach(async ({ page }) => {
    await installAuthenticatedSession(page)
    await installApiMock(page)
  })

  for (const routeCase of authenticatedRoutes) {
    test(`${routeCase.path} carrega sem falha de execução`, async ({ page }) => {
      const pageErrors: string[] = []
      page.on("pageerror", (error) => pageErrors.push(error.message))

      const response = await page.goto(routeCase.path, { waitUntil: "domcontentloaded" })

      expect(response?.status(), `status HTTP de ${routeCase.path}`).toBeLessThan(400)
      await expect(page.locator("main")).toBeVisible()
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/)

      if (routeCase.heading) {
        await expect(
          page.getByRole("heading", { name: routeCase.heading, exact: true }).first(),
        ).toBeVisible()
      }

      await page.waitForTimeout(250)
      expect(pageErrors, `erros JavaScript em ${routeCase.path}`).toEqual([])
    })
  }
})

test.describe("rotas públicas", () => {
  test.beforeEach(async ({ page }) => {
    await installApiMock(page)
  })

  test("/login permanece acessível sem sessão", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /bem-vindo/i })).toBeVisible()
    await expect(page.getByLabel("E-mail ou CPF").first()).toBeVisible()
  })

  test("/resetar-senha permanece acessível sem sessão", async ({ page }) => {
    await page.goto("/resetar-senha")
    await expect(page.locator("main")).toBeVisible()
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
  })

  test("/assinatura permanece pública e monta a área da Clicksign", async ({ page }) => {
    await page.route("https://cdn-public-library.clicksign.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.Clicksign = class {
            mount() {}
            unmount() {}
            on() {}
          }
        `,
      })
    })
    await page.goto("/assinatura/signer-e2e")
    await expect(page.getByRole("heading", { name: "Assinatura digital" })).toBeVisible()
    await expect(page.locator("#clicksign-widget")).toBeVisible()
  })
})
