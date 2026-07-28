import { expect, test } from "@playwright/test"

const email = process.env.E2E_LIVE_EMAIL
const password = process.env.E2E_LIVE_PASSWORD
const liveEnabled = Boolean(email && password)

test.describe("smoke read-only contra ambiente real", () => {
  test.skip(!liveEnabled, "Defina E2E_LIVE_EMAIL e E2E_LIVE_PASSWORD para habilitar.")

  test("autentica e percorre as telas principais sem mutações", async ({ page }) => {
    const pageErrors: string[] = []
    page.on("pageerror", (error) => pageErrors.push(error.message))

    await page.goto("/login")
    await page.getByLabel("E-mail ou CPF").first().fill(email ?? "")
    await page.getByRole("button", { name: "Avançar" }).click()
    await page.getByRole("textbox", { name: "Senha" }).fill(password ?? "")
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/)

    for (const path of ["/", "/clientes", "/contratos", "/servicos", "/agenda", "/agendamentos"]) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" })
      expect(response?.status(), `status HTTP de ${path}`).toBeLessThan(400)
      await expect(page.locator("main")).toBeVisible()
    }

    expect(pageErrors).toEqual([])
  })
})
