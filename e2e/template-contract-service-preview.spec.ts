import { expect, test } from "@playwright/test"
import JSZip from "jszip"
import { readFile } from "node:fs/promises"
import { clientFixture, contractFixture, installApiMock, serviceFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

for (const variant of ["sectionsHtml", "sectionsText", "eightPages"]) {
  const variable = variant === "eightPages" ? "sectionsHtml" : variant
  test(`prévia do contrato omite visita sem cláusulas e numera os serviços reais em ${variant}`, async ({ page }) => {
    test.setTimeout(120_000)
    await installAuthenticatedSession(page)
    await installApiMock(page)
    const template = {
      id: "contract-service-preview", name: "Contrato condomínio", kind: "contract", format: "docx",
      html: "", signerId: "", baseFileName: "contrato.docx", placeholders: [], isActive: true,
      createdAt: "2026-01-01T12:00:00Z", updatedAt: "2026-01-01T12:00:00Z",
    }
    const zip = new JSZip()
    const extraPages = variant === "eightPages" ? Array.from({ length: 7 }, (_, index) =>
      `<w:p><w:r><w:br w:type="page"/><w:t>Página adicional ${index + 2}</w:t></w:r></w:p>` +
      Array.from({ length: 20 }, (_, line) => `<w:p><w:r><w:t>Conteúdo da página ${index + 2}, linha ${line + 1}: preservar todo o documento na exportação.</w:t></w:r></w:p>`).join("")
    ).join("") : ""
    zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Objeto: {{services.summary}}</w:t></w:r></w:p><w:p><w:r><w:t>{{services.${variable}}}</w:t></w:r></w:p>${extraPages}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`)
    const docx = await zip.generateAsync({ type: "nodebuffer" })
    const services = [
      { ...serviceFixture, id: "srv-visita-de-rotina", name: "Visita de rotina", clauses: [] },
      { ...serviceFixture, id: "srv-limpeza-de-rede", name: "Limpeza de rede" },
      { ...serviceFixture, id: "srv-dedetizacao", name: "Dedetização" },
      { ...serviceFixture, id: "srv-desratizacao", name: "Desratização" },
    ]
    const clauses = [[], ["Limpeza preventiva da rede.\nContinuação da limpeza."], ["Cláusula compartilhada.", "Controle de insetos."], ["Cláusula compartilhada.", "Controle de roedores."]]
    const contract = { ...contractFixture, templateId: template.id, services: services.map((service, index) => ({ ...contractFixture.services[0], id: `item-${index}`, serviceTypeId: service.id, clauses: clauses[index] })) }
    await page.route("**/api/v1/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname
      const send = (data: unknown) => route.fulfill({ json: { success: true, data } })
      if (pathname === "/api/v1/templates" || pathname === `/api/v1/templates/${template.id}`) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        return send(pathname === "/api/v1/templates" ? [template] : template)
      }
      if (pathname === `/api/v1/templates/${template.id}/base-file`) return route.fulfill({ contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: docx })
      if (pathname === "/api/v1/services") return send(services)
      if (pathname === "/api/v1/contracts") return send([contract])
      return route.fallback()
    })
    await page.goto(`/templates?tab=contract&template=${template.id}&view=preview`)
    await page.locator("#preview-client").click()
    await page.getByRole("option", { name: clientFixture.companyName, exact: true }).click()
    await page.locator("#preview-document").click()
    await page.getByRole("option", { name: /E2E-0001/ }).click()
    const preview = page.locator("[data-preview-render-key]")
    await expect(preview).toContainText("Objeto: limpeza de rede, controle de pragas", { timeout: 60_000 })
    await expect(preview).toContainText("1. Limpeza de rede")
    await expect(preview).toContainText("1.1. Limpeza preventiva da rede.")
    await expect(preview).toContainText("Continuação da limpeza.")
    await expect(preview).toContainText("2. Controle de pragas")
    await expect(preview).toContainText("2.3. Controle de roedores.")
    await expect(preview).not.toContainText("Visita de rotina")
    await expect(preview).not.toContainText("não informadas")
    await expect(preview).not.toContainText("Dedetização")
    await expect(preview).not.toContainText("Desratização")
    await expect(page).toHaveURL(/template=contract-service-preview.*view=preview/)
    if (variable === "sectionsHtml") {
      const downloadPromise = page.waitForEvent("download")
      await page.getByRole("button", { name: "Testar PDF", exact: true }).click()
      const download = await downloadPromise
      const pdf = await readFile((await download.path())!)
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF")
      expect(pdf.byteLength).toBeGreaterThan(15_000)
      expect(pdf.byteLength).toBeLessThan(5 * 1024 * 1024)
      if (variant === "eightPages") {
        const content = pdf.toString("latin1")
        expect(content).toMatch(/\/Count 8\b/)
        const pageImages = [...content.matchAll(/\/Subtype \/Image[\s\S]*?\/Length (\d+)/g)]
        expect(pageImages).toHaveLength(8)
        for (const image of pageImages) expect(Number(image[1])).toBeGreaterThan(15_000)
      }
    }
  })
}
