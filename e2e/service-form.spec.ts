import { expect, test, type Page } from "@playwright/test"

import { installApiMock, serviceFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

type ServicePayload = {
  name?: string
  description?: string
  defaultRecurrence?: string
  dailyScheduleLimit?: number | null
  dailyScheduleLimitHours?: number | null
  clauses?: string[]
}

async function captureServiceMutation(page: Page, options: { legacyEmptyRecurrence?: boolean; legacyDailyLimit?: number } = {}) {
  let payload: ServicePayload | undefined
  let currentService: Omit<typeof serviceFixture, "dailyScheduleLimit" | "dailyScheduleLimitHours"> & {
    dailyScheduleLimit: number | null
    dailyScheduleLimitHours: number | null
  } = options.legacyEmptyRecurrence
    ? { ...serviceFixture, defaultRecurrence: "" }
    : { ...serviceFixture }
  if (options.legacyDailyLimit) currentService.dailyScheduleLimit = options.legacyDailyLimit

  await page.route("**/api/v1/services/service-e2e", async (route) => {
    const request = route.request()

    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: currentService,
        }),
      })
      return
    }

    if (request.method() === "PATCH") {
      payload = request.postDataJSON() as ServicePayload
      currentService = { ...currentService, ...payload }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: currentService,
        }),
      })
      return
    }

    await route.fallback()
  })

  return {
    getPayload: () => payload,
    getService: () => currentService,
  }
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("exibe o check no lugar do lápis e salva a cláusula confirmada", async ({ page }) => {
  const { getPayload } = await captureServiceMutation(page)
  await page.goto("/servicos/service-e2e/editar")

  const clauseRow = page.getByTestId("service-clause-0")
  const editButton = page.getByRole("button", { name: "Editar cláusula" }).first()
  await editButton.click()

  const clauseEditor = clauseRow.getByRole("textbox")
  await clauseEditor.fill("Cláusula alterada e confirmada.")

  const confirmButton = clauseRow.getByRole("button", { name: "Salvar edição da cláusula" })
  await expect(confirmButton).toBeVisible()
  await confirmButton.click()
  await expect(clauseRow).toContainText("Cláusula alterada e confirmada.")

  await page.getByRole("button", { name: "Salvar Alterações" }).click()
  await expect.poll(() => getPayload()?.clauses).toEqual(["Cláusula alterada e confirmada."])
})

test("salvar o serviço inclui a cláusula ainda em edição e não exige recorrência", async ({ page }) => {
  const { getPayload } = await captureServiceMutation(page, { legacyEmptyRecurrence: true })
  await page.goto("/servicos/service-e2e/editar")

  const clauseRow = page.getByTestId("service-clause-0")
  const editButton = page.getByRole("button", { name: "Editar cláusula" }).first()
  await editButton.click()
  await clauseRow.getByRole("textbox").fill("Cláusula salva diretamente pelo formulário.")

  await page.getByRole("button", { name: "Salvar Alterações" }).click()

  await expect(page.getByText("Recorrência obrigatória")).toHaveCount(0)
  await expect.poll(() => getPayload()).toMatchObject({
    defaultRecurrence: "monthly",
    clauses: ["Cláusula salva diretamente pelo formulário."],
  })
})

test("na criação, somente o nome impede o envio do serviço", async ({ page }) => {
  let payload: ServicePayload | undefined
  await page.route("**/api/v1/services", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback()
      return
    }

    payload = route.request().postDataJSON() as ServicePayload
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { ...serviceFixture, ...payload },
      }),
    })
  })

  await page.goto("/servicos/novo")
  await page.getByRole("button", { name: "Cadastrar Serviço" }).click()
  await expect(page.getByText("Nome obrigatório")).toBeVisible()
  expect(payload).toBeUndefined()

  await page.getByLabel("Nome do Serviço").fill("Serviço mínimo E2E")
  await page.getByRole("button", { name: "Cadastrar Serviço" }).click()

  await expect.poll(() => payload?.name).toBe("Serviço mínimo E2E")
  await expect(page.getByText("Recorrência obrigatória")).toHaveCount(0)
})

test("reabre a edição com os dados atualizados sem precisar recarregar a página", async ({ page }) => {
  const { getService } = await captureServiceMutation(page)
  const updatedDescription = "Descrição atualizada sem F5."

  await page.goto("/servicos/service-e2e/editar")
  await page.getByLabel("Descrição").fill(updatedDescription)
  await page.getByRole("button", { name: "Salvar Alterações" }).click()

  await expect(page).toHaveURL(/\/servicos$/)
  await expect.poll(() => getService().description).toBe(updatedDescription)

  await page.getByRole("button", { name: "Ações do serviço", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar" }).click()

  await expect(page).toHaveURL(/\/servicos\/service-e2e\/editar$/)
  await expect(page.getByLabel("Descrição")).toHaveValue(updatedDescription)
})

test("mantém a duração padrão inteira e permite fracionar somente o limite diário", async ({ page }) => {
  const { getPayload } = await captureServiceMutation(page, { legacyDailyLimit: 1 })

  await page.goto("/servicos/service-e2e/editar")
  const durationInput = page.getByLabel("Duração Padrão")
  await expect(durationInput).toHaveValue(String(serviceFixture.defaultDuration))
  const initialDuration = await durationInput.inputValue()
  await durationInput.pressSequentially(",")
  await expect(durationInput).toHaveValue(initialDuration)

  const limitInput = page.getByLabel("Limite do serviço por dia")
  await expect(limitInput).toHaveValue("8")
  await limitInput.fill("7,5")

  await page.getByRole("button", { name: "Salvar Alterações" }).click()
  await expect.poll(() => getPayload()?.dailyScheduleLimitHours).toBe(7.5)
})
