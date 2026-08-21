import { expect, test, type Page } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const controlRoutes = [
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

type ButtonTarget = {
  name: string
  occurrence: number
  index?: number
}

async function listEnabledButtons(page: Page): Promise<ButtonTarget[]> {
  const buttons = page.getByRole("button")
  const targets: ButtonTarget[] = []
  const occurrences = new Map<string, number>()

  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index)
    if (!(await button.isVisible()) || !(await button.isEnabled())) continue
    if (await button.getAttribute("data-nextjs-dev-tools-button")) continue

    const snapshot = await button.ariaSnapshot()
    const match = snapshot.match(/^- button "([^"]+)"/m)
    if (!match) continue

    const name = match[1]
    if (
      name.startsWith("Novo agendamento em ") &&
      targets.some((target) => target.name.startsWith("Novo agendamento em "))
    ) {
      continue
    }
    const occurrence = occurrences.get(name) ?? 0
    occurrences.set(name, occurrence + 1)
    targets.push({ name, occurrence, index })
  }

  return targets
}

async function listEnabledComboboxes(page: Page): Promise<ButtonTarget[]> {
  const comboboxes = page.getByRole("combobox")
  const targets: ButtonTarget[] = []
  const occurrences = new Map<string, number>()

  for (let index = 0; index < await comboboxes.count(); index += 1) {
    const combobox = comboboxes.nth(index)
    if (!(await combobox.isVisible()) || !(await combobox.isEnabled())) continue

    const snapshot = await combobox.ariaSnapshot()
    const name = snapshot
      .split("\n", 1)[0]
      .replace(/^- combobox/, "")
      .replace(/\s*\[[^\]]+\]/g, "")
      .replace(/^:\s*/, "")
      .trim()
      .replace(/^"|"$/g, "")
    if (!name) continue

    const occurrence = occurrences.get(name) ?? 0
    occurrences.set(name, occurrence + 1)
    targets.push({ name, occurrence, index })
  }

  return targets
}

test.beforeEach(async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

for (const path of controlRoutes) {
  test(`${path} executa as ações inicialmente disponíveis sem erro`, async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    await page.goto(path)
    await expect(page.locator("main")).toBeVisible()
    await page.waitForTimeout(250)

    const targets = await listEnabledButtons(page)
    const comboboxTargets = await listEnabledComboboxes(page)
    expect(targets.length, `Nenhum botão habilitado foi encontrado em ${path}.`).toBeGreaterThan(0)

    const exercised: ButtonTarget[] = []
    const obstructed: ButtonTarget[] = []
    const comboboxesExercised: ButtonTarget[] = []
    for (const target of targets) {
      const pageErrors: string[] = []
      const onPageError = (error: Error) => pageErrors.push(error.message)

      await page.goto(path)
      await expect(page.locator("main")).toBeVisible()
      await page.waitForTimeout(150)
      page.on("pageerror", onPageError)

      const button = page.getByRole("button", { name: target.name, exact: true }).nth(target.occurrence)
      if ((await button.isVisible()) && (await button.isEnabled())) {
        try {
          await button.click({ trial: true, timeout: 1_000 })
        } catch {
          obstructed.push(target)
          page.off("pageerror", onPageError)
          continue
        }

        await button.click({ timeout: 5_000 })
        await page.waitForTimeout(150)
        exercised.push(target)
      }

      page.off("pageerror", onPageError)
      expect(pageErrors, `Erro ao acionar "${target.name}" em ${path}.`).toEqual([])
    }

    for (const target of comboboxTargets) {
      const pageErrors: string[] = []
      const onPageError = (error: Error) => pageErrors.push(error.message)

      await page.goto(path)
      await expect(page.locator("main")).toBeVisible()
      await page.waitForTimeout(150)
      page.on("pageerror", onPageError)

      const combobox = page.getByRole("combobox").nth(target.index ?? target.occurrence)
      if ((await combobox.isVisible()) && (await combobox.isEnabled())) {
        await combobox.click({ timeout: 5_000 })
        await page.keyboard.press("Escape")
        await page.waitForTimeout(100)
        comboboxesExercised.push(target)
      }

      page.off("pageerror", onPageError)
      expect(pageErrors, `Erro ao abrir a seleção "${target.name}" em ${path}.`).toEqual([])
    }

    await testInfo.attach("botoes-exercitados.json", {
      body: Buffer.from(JSON.stringify({
        path,
        buttons: { exercised, obstructed },
        comboboxes: { exercised: comboboxesExercised },
      }, null, 2)),
      contentType: "application/json",
    })
    expect(exercised.length + obstructed.length).toBe(targets.length)
    expect(comboboxesExercised.length).toBe(comboboxTargets.length)
  })
}
