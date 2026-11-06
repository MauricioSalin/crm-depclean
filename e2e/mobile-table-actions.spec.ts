import { expect, test } from "@playwright/test"
import { installApiMock } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test("a coluna de ações acompanha a rolagem lateral da tabela no celular", async ({ page }) => {
  const user = { ...E2E_USER, permissionProfileId: "profile-admin" }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  await page.goto("/configuracoes?section=empresa")

  const container = page.locator('[data-slot="table-container"]').filter({ has: page.getByRole("columnheader", { name: /Placa/ }) })
  const action = container.getByRole("button", { name: "Ações de ABC1D23", exact: true })
  await expect(action).toBeVisible()
  await container.scrollIntoViewIfNeeded()
  expect(await container.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)

  const bounds = (await container.boundingBox())!
  const before = (await action.boundingBox())!
  expect(before.x + before.width).toBeGreaterThan(bounds.x + bounds.width)

  await container.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  await expect.poll(async () => {
    const position = (await action.boundingBox())!
    return position.x >= bounds.x && position.x + position.width <= bounds.x + bounds.width + 1
  }).toBe(true)
  const rightInset = await action.evaluate((button) => {
    const cell = button.closest("td")!
    return cell.getBoundingClientRect().right - button.getBoundingClientRect().right
      - parseFloat(getComputedStyle(cell).paddingRight)
  })
  expect(rightInset).toBeCloseTo(0)
  await action.tap()
  await expect(page.getByRole("menuitem", { name: "Editar", exact: true })).toBeVisible()
})
