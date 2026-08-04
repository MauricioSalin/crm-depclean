import { expect, test } from "@playwright/test"

import { contractFixture, installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("mantém a badge de agendamentos próxima ao número do contrato", async ({ page }) => {
  await page.route("**/api/v1/contracts/contract-e2e", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        success: true,
        message: "Contrato carregado.",
        data: {
          ...contractFixture,
          status: "closed",
          isAwaitingSchedules: true,
        },
        meta: { version: "e2e", timestamp: new Date().toISOString() },
      }),
    })
  })

  await page.goto("/contratos/contract-e2e")

  const contractNumber = page.getByRole("heading", { name: contractFixture.contractNumber })
  const awaitingSchedules = page.getByText("Aguardando agendamentos", { exact: true })

  await expect(contractNumber).toBeVisible()
  await expect(awaitingSchedules).toBeVisible()

  const contractNumberBox = await contractNumber.boundingBox()
  const awaitingSchedulesBox = await awaitingSchedules.boundingBox()

  expect(contractNumberBox).not.toBeNull()
  expect(awaitingSchedulesBox).not.toBeNull()
  expect(awaitingSchedulesBox!.x - (contractNumberBox!.x + contractNumberBox!.width)).toBeLessThanOrEqual(16)
})
