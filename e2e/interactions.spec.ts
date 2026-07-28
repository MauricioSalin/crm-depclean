import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const interactionRoutes = [
  "/clientes",
  "/clientes/novo",
  "/contratos",
  "/contratos/novo",
  "/servicos",
  "/servicos/novo",
  "/equipes",
  "/funcionarios",
  "/agenda",
  "/agendamentos",
  "/certificados",
  "/relatorios",
  "/configuracoes",
  "/templates",
  "/perfil",
  "/depai",
]

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

for (const path of interactionRoutes) {
  test(`${path} não possui controle visível sem nome acessível`, async ({ page }, testInfo) => {
    await page.goto(path)
    await expect(page.locator("main")).toBeVisible()
    await page.waitForTimeout(300)

    const controls = await page.locator("button, [role=button], [role=combobox], input, textarea, select").evaluateAll(
      (elements) => elements
        .filter((element) => (element as HTMLElement).offsetParent !== null)
        .map((element) => {
          const htmlElement = element as HTMLElement
          const input = element as HTMLInputElement
          const id = htmlElement.id
          const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : ""
          return {
            tag: htmlElement.tagName.toLowerCase(),
            role: htmlElement.getAttribute("role"),
            html: htmlElement.outerHTML.slice(0, 400),
            name: (
              htmlElement.getAttribute("aria-label")
              || htmlElement.getAttribute("title")
              || label
              || input.placeholder
              || htmlElement.textContent
              || ""
            ).trim(),
            disabled: input.disabled || htmlElement.getAttribute("aria-disabled") === "true",
          }
        }),
    )

    await testInfo.attach("controles.json", {
      body: Buffer.from(JSON.stringify({ path, controls }, null, 2)),
      contentType: "application/json",
    })

    const interactiveRoles = ["button", "tab", "combobox", "textbox", "checkbox", "switch", "radio"] as const
    const unnamedControls: Array<{ role: string; snapshot: string; html: string }> = []

    for (const role of interactiveRoles) {
      const elements = page.getByRole(role)
      const count = await elements.count()

      for (let index = 0; index < count; index += 1) {
        const element = elements.nth(index)
        if (!(await element.isVisible())) continue
        if (await element.getAttribute("data-nextjs-dev-tools-button")) continue

        const snapshot = await element.ariaSnapshot()
        const firstLine = snapshot.split("\n", 1)[0]
        const accessibleName = firstLine
          .replace(new RegExp(`^- ${role}`), "")
          .replace(/\s*\[[^\]]+\]/g, "")
          .replace(/^:\s*/, "")
          .trim()
        const hasAccessibleName = accessibleName.length > 0
        if (hasAccessibleName) continue

        unnamedControls.push({
          role,
          snapshot,
          html: await element.evaluate((node) => node.outerHTML.slice(0, 800)),
        })
      }
    }
    expect(
      unnamedControls,
      `controles sem nome acessível em ${path}: ${JSON.stringify(unnamedControls, null, 2)}`,
    ).toEqual([])
  })
}

test("comboboxes visíveis abrem e fecham sem erro", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  await page.goto("/contratos/novo")
  await expect(page.locator("main")).toBeVisible()

  const comboboxes = page.getByRole("combobox")
  const count = await comboboxes.count()
  expect(count).toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const combobox = comboboxes.nth(index)
    if (!(await combobox.isVisible()) || !(await combobox.isEnabled())) continue
    await combobox.click()
    await page.keyboard.press("Escape")
  }

  expect(pageErrors).toEqual([])
})

test("campo de busca de clientes aceita entrada e mantém a página íntegra", async ({ page }) => {
  await page.goto("/clientes")
  const search = page.getByPlaceholder(/buscar|pesquisar/i).first()
  await expect(search).toBeVisible()
  await search.fill("Condomínio E2E")
  await expect(search).toHaveValue("Condomínio E2E")
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible()
})
