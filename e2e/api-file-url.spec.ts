import { expect, test } from "@playwright/test"

import { buildApiFileUrl, resolveApiBaseUrl } from "../lib/api/client"

const filePath = "/api/v1/files/clients/ruda/informativo%20de%20rede.pdf"

for (const origin of ["http://192.168.15.2:3333", "http://localhost:3333", "https://old-api.example"]) {
  test(`resolve arquivo interno salvo com origem antiga ${origin}`, () => {
    const suffix = "?download=1#page=2"
    expect(buildApiFileUrl(`${origin}${filePath}${suffix}`))
      .toBe(`${new URL(resolveApiBaseUrl()).origin}${filePath}${suffix}`)
  })
}

test("preserva arquivos relativos, links externos e caminho vazio", () => {
  const origin = new URL(resolveApiBaseUrl()).origin
  expect(buildApiFileUrl(filePath)).toBe(`${origin}${filePath}`)
  expect(buildApiFileUrl(filePath.slice(1))).toBe(`${origin}${filePath}`)
  expect(buildApiFileUrl("https://documents.example/report.pdf?signature=abc"))
    .toBe("https://documents.example/report.pdf?signature=abc")
  expect(buildApiFileUrl("https://documents.example/api/v1/files-other/report.pdf"))
    .toBe("https://documents.example/api/v1/files-other/report.pdf")
  expect(buildApiFileUrl("")).toBe("")
})
