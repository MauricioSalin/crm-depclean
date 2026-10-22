import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"

import { installApiMock } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`exibe o ranking completo até o último síndico e preserva os valores em ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize(viewport)
    await installAuthenticatedSession(page)
    await installApiMock(page)
    const now = "2026-10-22T15:00:00.000Z"
    const content = "## Ranking completo de síndicos\n\n" + Array.from({ length: 74 }, (_, index) => [
      `### ${index + 1} · Síndico de teste ${index + 1}`,
      "",
      "| Condomínio | Contrato | Valor total do contrato | Vigência |",
      "| --- | --- | --- | --- |",
      `| Condomínio de teste ${index + 1} | DEP-${index + 1} | R$ 1.500,00 | ${index % 2 ? "Inativa" : "Ativa"} |`,
      "",
    ].join("\n")).join("\n")
    expect(content.length).toBeGreaterThan(6000)
    let conversation: Record<string, unknown> | undefined
    const requests: Array<{ conversationId: string; message: string; history?: Array<{ content: string }> }> = []
    const messages: Array<Record<string, unknown>> = []
    await page.route("**/api/v1/depai/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { success: true, data: { conversations: conversation ? [conversation] : [] } } })
        return
      }
      const payload = route.request().postDataJSON() as typeof requests[number]
      requests.push(payload)
      if (payload.history?.some((entry) => entry.content.length > 6000)) {
        await route.fulfill({ status: 400, json: { message: ["history.1.content must be shorter than or equal to 6000 characters"] } })
        return
      }
      const followup = requests.length > 1
      const message = { id: `ranking-assistant-${requests.length}`, role: "assistant",
        content: followup ? "Documento reunido por síndico com todos os campos da lista anterior." : content,
        createdAt: now, artifacts: followup ? [{ id: "report", kind: "report", title: "Síndicos e contratos",
          description: "Documento completo por síndico", fileName: "sindicos.pdf", mimeType: "application/pdf", status: "ready" }] : [] }
      messages.push({ id: `ranking-user-${requests.length}`, role: "user", content: payload.message, createdAt: now }, message)
      conversation = {
        id: payload.conversationId, title: "Ranking completo", updatedAt: now,
        messages: [...messages],
      }
      await route.fulfill({ json: { success: true, data: { message, conversation } } })
    })

    await page.goto("/depai")
    const composer = page.getByPlaceholder("Pergunte alguma coisa")
    await composer.fill("Liste todos os síndicos com seus condomínios, contratos ativos e inativos e valores, do maior para o menor número de contratos.")
    await composer.press("Enter")

    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(74)
    const last = page.getByRole("heading", { name: "74 · Síndico de teste 74", exact: true })
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeVisible()
    const lastRow = page.getByRole("row").filter({ hasText: "Condomínio de teste 74" })
    await expect(lastRow).toContainText("R$ 1.500,00")
    await expect(lastRow).toContainText("Inativa")
    await expect(page.getByText("Tente reformular", { exact: false })).toHaveCount(0)
    await page.reload()
    await page.getByRole("button", { name: "Histórico", exact: true }).click()
    await page.getByRole("button", { name: "Ranking completo 2 mensagem(ns)", exact: true }).click()
    await expect(page.getByRole("heading", { name: "74 · Síndico de teste 74", exact: true })).toHaveCount(1)

    await composer.fill("Envie as informações acima em um único documento, separado por síndico, com todos os campos.")
    await composer.press("Enter")
    await expect(page.getByText("Documento reunido por síndico com todos os campos da lista anterior.", { exact: true }).first()).toBeVisible()
    expect(requests).toHaveLength(2)
    expect(requests[1]?.conversationId).toBe(requests[0]?.conversationId)
    expect(requests[1]?.history).toBeUndefined()
    await expect(page.getByRole("heading", { name: "74 · Síndico de teste 74", exact: true })).toHaveCount(1)
    await expect(page.getByText("history.1.content must", { exact: false })).toHaveCount(0)
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Baixar", exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe("sindicos.pdf")
    const downloadedPath = await download.path()
    expect(downloadedPath).not.toBeNull()
    expect((await readFile(downloadedPath!)).subarray(0, 5).toString()).toBe("%PDF-")
  })
}
