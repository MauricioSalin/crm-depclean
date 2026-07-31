import { expect, test, type Locator, type Page } from "@playwright/test"

import { employeeFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

async function expectSameTextColor(reference: Locator, action: Locator) {
  await expect(reference).toBeVisible()
  await expect(action).toBeVisible()

  const referenceColor = await reference.evaluate((element) => getComputedStyle(element).color)
  const actionColor = await action.evaluate((element) => getComputedStyle(element).color)
  expect(actionColor).toBe(referenceColor)
}

async function assertMenuActionColor(
  page: Page,
  options: {
    path: string
    triggerName: string | RegExp
    referenceName: string
  },
) {
  await page.goto(options.path)
  await page.getByRole("button", { name: options.triggerName, exact: typeof options.triggerName === "string" }).first().click()

  await expectSameTextColor(
    page.getByRole("menuitem", { name: options.referenceName, exact: true }),
    page.getByRole("menuitem", { name: "Excluir", exact: true }),
  )
  await page.keyboard.press("Escape")
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("ações de excluir usam a mesma cor das demais ações nos menus", async ({ page }) => {
  await page.route("**/api/v1/employees**", async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() !== "GET"
      || url.pathname !== "/api/v1/employees"
      || !url.searchParams.has("page")
    ) {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [{ ...employeeFixture, id: "employee-color-e2e", isSystemUser: false }],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      }),
    })
  })
  await page.route("**/api/v1/schedules**", async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== "GET" || url.pathname !== "/api/v1/schedules") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [{ ...scheduleFixture, contractId: "", isManual: true }],
      }),
    })
  })

  await assertMenuActionColor(page, {
    path: "/funcionarios",
    triggerName: "Ações do funcionário",
    referenceName: "Editar",
  })
  await assertMenuActionColor(page, {
    path: "/agendamentos",
    triggerName: /Abrir ações do agendamento/,
    referenceName: "Editar",
  })
  await assertMenuActionColor(page, {
    path: "/equipes",
    triggerName: "Ações da equipe",
    referenceName: "Editar",
  })
  await assertMenuActionColor(page, {
    path: "/servicos",
    triggerName: "Ações do serviço",
    referenceName: "Editar",
  })
})

test("ações de excluir nos formulários são ghost, vermelhas e sem borda", async ({ page }) => {
  for (const form of [
    { path: "/clientes/client-e2e/editar", dialogTitle: "Excluir cliente" },
    { path: "/contratos/contract-e2e/editar", dialogTitle: "Excluir contrato" },
  ]) {
    await page.goto(form.path)

    const deleteButton = page.getByRole("button", { name: "Excluir", exact: true })
    await expect(deleteButton).toBeVisible()
    await expect(deleteButton).toHaveClass(/text-destructive/)
    await expect(deleteButton).toHaveClass(/hover:bg-destructive\/10/)

    const styles = await deleteButton.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        borderTopWidth: computed.borderTopWidth,
        borderRightWidth: computed.borderRightWidth,
        borderBottomWidth: computed.borderBottomWidth,
        borderLeftWidth: computed.borderLeftWidth,
      }
    })

    expect(styles).toEqual({
      borderTopWidth: "0px",
      borderRightWidth: "0px",
      borderBottomWidth: "0px",
      borderLeftWidth: "0px",
    })

    await deleteButton.click()
    await expect(page.getByRole("heading", { name: form.dialogTitle, exact: true })).toBeVisible()
    await page.keyboard.press("Escape")
  }
})
