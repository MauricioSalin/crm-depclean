import { expect, test } from "@playwright/test"
import JSZip from "jszip"

import { clientFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"

const templateId = "template-informative-dates"
const template = {
  id: templateId, name: "Informativo Caixa d'água", kind: "informative", format: "docx",
  html: "", signerId: "", baseFileName: "legacy-informative.docx", informativeSendDaysBefore: 3,
  informativeSendTime: "08:00", certificateValidityMonths: 6, placeholders: [], isActive: true,
  createdAt: "2026-01-01T12:00:00Z", updatedAt: "2026-01-01T12:00:00Z",
}

async function documentBuffer(detailed: boolean) {
  const zip = new JSZip()
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>INFORMATIVO</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Informamos que, no dia </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>{{schedule.</w:t></w:r><w:r><w:t>date}}</w:t></w:r><w:r><w:t xml:space="preserve">, a partir das {{schedule.time}}, realizaremos o atendimento.</w:t></w:r></w:p>${detailed ? '<w:p><w:r><w:t>{{schedule.datesText}}</w:t></w:r></w:p>' : ''}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`)
  return zip.generateAsync({ type: "nodebuffer" })
}

for (const detailed of [false, true]) {
  test(`prévia ${detailed ? "com variável de todas as datas" : "do modelo antigo"} mostra as datas reais e exclui o dia não concluído`, async ({ page }) => {
    test.setTimeout(120_000)
    await installAuthenticatedSession(page)
    await installApiMock(page)
    const docx = await documentBuffer(detailed)
    const records = [
      { id: "old", date: "2026-09-22", status: "not_completed", multiDayIndex: 1 },
      { id: "second", date: "2026-11-17", status: "rescheduled", multiDayIndex: 2 },
      { id: "third", date: "2026-11-24", status: "scheduled", multiDayIndex: 3 },
      { id: "cancelled", date: "2026-11-25", status: "cancelled", multiDayIndex: 4 },
    ].map(item => ({ ...scheduleFixture, ...item, multiDayGroupId: "group", multiDayTotal: 4 }))
    await page.route("**/api/v1/**", async route => {
      const pathname = new URL(route.request().url()).pathname
      const send = (data: unknown) => route.fulfill({ json: { success: true, data } })
      if (pathname === "/api/v1/templates") return send([template])
      if (pathname === `/api/v1/templates/${templateId}`) return send(template)
      if (pathname === `/api/v1/templates/${templateId}/base-file`) return route.fulfill({ contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: docx })
      if (pathname === "/api/v1/schedules") return send(records)
      return route.fallback()
    })
    await page.goto(`/templates?tab=informative&template=${templateId}&view=preview`)
    await page.locator("#preview-client").click()
    await page.getByRole("option", { name: clientFixture.companyName, exact: true }).click()
    await page.locator("#preview-document").click()
    const option = page.getByRole("option", { name: /17\/11\/2026 e 24\/11\/2026/ })
    await expect(option).toHaveCount(1)
    await expect(page.getByRole("option", { name: /22\/09\/2026|25\/11\/2026/ })).toHaveCount(0)
    await option.click()
    const preview = page.locator("[data-preview-render-key]")
    if (detailed) {
      await expect(preview).toContainText("17/11/2026 - 08:00", { timeout: 60_000 })
      await expect(preview).toContainText("24/11/2026 - 08:00")
      await expect(preview).toContainText("no dia 17/11/2026")
    } else {
      await expect(preview).toContainText("nos dias 17/11/2026 e 24/11/2026", { timeout: 60_000 })
    }
    await expect(preview).not.toContainText("22/09/2026")
    await expect(preview).not.toContainText("25/11/2026")
    await page.getByRole("tab", { name: "Editar", exact: true }).click()
    await expect(page.locator(".docx-template-editor-host:visible")).toContainText("{{schedule.date}}", { timeout: 60_000 })
  })
}
