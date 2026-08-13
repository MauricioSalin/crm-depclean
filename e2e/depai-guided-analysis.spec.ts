import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

test("prepara uma análise guiada sem enviar antes da confirmação", async ({ page }) => {
  let chatRequests = 0
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/v1/depai/chat")) {
      chatRequests += 1
    }
  })

  await installAuthenticatedSession(page)
  await installApiMock(page)

  await page.goto("/depai")

  await expect(page.getByRole("heading", { name: "O que você quer analisar?" })).toBeVisible()
  await expect(page.getByText("Somente leitura", { exact: true })).toBeVisible()
  await expect(page.getByText("Dados conforme seu acesso", { exact: true })).toBeVisible()

  const composer = page.getByPlaceholder("Pergunte alguma coisa")
  await page.getByRole("button", { name: "Planejar a agenda: preparar pergunta" }).click()

  await expect(composer).toBeFocused()
  await expect(composer).toHaveValue(/Analise os próximos atendimentos/)
  expect(chatRequests).toBe(0)

  const chatRequest = page.waitForRequest((request) => (
    request.method() === "POST" && request.url().includes("/api/v1/depai/chat")
  ))
  await composer.press("Enter")

  const payload = (await chatRequest).postDataJSON() as { message: string }
  expect(payload.message).toContain("destaque conflitos ou pendências")
  expect(chatRequests).toBe(1)
})

test("mostra somente objetivos compatíveis com as permissões do perfil", async ({ page }) => {
  const restrictedUser = {
    ...E2E_USER,
    permissions: ["depai_access", "agenda_own_view"],
  }

  await installAuthenticatedSession(page, restrictedUser)
  await installApiMock(page, restrictedUser)

  await page.goto("/depai")

  await expect(page.getByRole("button", { name: "Planejar a agenda: preparar pergunta" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Prioridades de hoje: preparar pergunta" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Entender meu acesso: preparar pergunta" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Analisar o financeiro: preparar pergunta" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Revisar clientes e contratos: preparar pergunta" })).toHaveCount(0)
})
