import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { formatCivilDate } from "../lib/date-utils.ts"
import { buildTemplateSchedulePreviewOptions, prepareSchedulePreviewContext, renderSchedulePreviewXml } from "../lib/template-schedule-preview.ts"

const visit = (id, date, status = "scheduled", extra = {}) => ({
  id, date, status, time: "08:00", multiDayGroupId: "morada", unitId: "unit",
  serviceTypeName: "Limpeza de caixa d'água", unitName: "Matriz", ...extra,
})
const visits = [
  visit("old", "2026-09-22", "not_completed"),
  visit("second", "2026-11-17", "rescheduled"),
  visit("third", "2026-11-24"),
  visit("cancelled", "2026-11-25", "cancelled"),
]
const options = (values = visits, kind = "informative") => buildTemplateSchedulePreviewOptions(values, kind, formatCivilDate)
const variables = (option = options()[0]) => ({
  "schedule.date": "17/11/2026", "schedule.time": "08h", "schedule.datesText": option.datesText,
  "schedule.legacyDateText": option.dateText, "schedule.legacyTimeText": option.timeText,
})
const legacyXml = '<w:document><w:body><w:p><w:r><w:t xml:space="preserve">Informamos que, no dia </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>{{schedule.</w:t></w:r><w:r><w:t>date}}</w:t></w:r><w:r><w:t>, a partir das {{schedule.time}}.</w:t></w:r></w:p></w:body></w:document>'
const visible = xml => xml.replace(/<[^>]+>/g, "")
const render = (xml, values = variables(), files = [xml]) => renderSchedulePreviewXml(xml, prepareSchedulePreviewContext(values, files))

test("Morada de Cascais: seleção e texto legado exibem 17/11 e 24/11, nunca 22/09", () => {
  const result = options()
  assert.equal(result.length, 1)
  assert.equal(result[0].value, "second")
  assert.match(result[0].label, /17\/11\/2026 e 24\/11\/2026/)
  assert.doesNotMatch(result[0].label, /22\/09|25\/11/)
  const xml = render(legacyXml)
  assert.match(visible(xml), /nos dias 17\/11\/2026 e 24\/11\/2026, a partir das 08h/)
  assert.doesNotMatch(visible(xml), /22\/09|25\/11|\{\{/)
  assert.ok(xml.includes("<w:b/>"), "Preserve the original bold formatting")
})

test("modelo moderno usa todas as datas e horários, inclusive variável dividida entre trechos do DOCX", () => {
  const xml = legacyXml.replace("</w:body>", '<w:p><w:r><w:t>{{ schedule.</w:t></w:r><w:r><w:t>datesText }}</w:t></w:r></w:p></w:body>')
  const result = render(xml)
  assert.match(visible(result), /no dia 17\/11\/2026, a partir das 08h/)
  assert.match(visible(result), /17\/11\/2026 - 08:00/)
  assert.match(visible(result), /24\/11\/2026 - 08:00/)
  assert.ok(result.includes("<w:br/>"))
  assert.doesNotMatch(result, /\{\{/)
})

test("variável de todas as datas no cabeçalho mantém compatibilidade das variáveis antigas no corpo", () => {
  const header = '<w:p><w:r><w:t>{{schedule.datesText}}</w:t></w:r></w:p>'
  const context = prepareSchedulePreviewContext(variables(), [legacyXml, header])
  assert.match(visible(renderSchedulePreviewXml(legacyXml, context)), /no dia 17\/11\/2026/)
  assert.match(visible(renderSchedulePreviewXml(header, context)), /24\/11\/2026 - 08:00/)
})

test("um único dia ativo mantém o singular e não recupera datas encerradas ou sem programação", () => {
  const records = [visit("only", "2026-11-17"), ...["completed", "partially_completed", "cancelled", "not_completed", "awaiting_schedule"].map((status, index) => visit(status, `2026-09-${20 + index}`, status))]
  const result = options(records)
  assert.equal(result.length, 1)
  assert.equal(result[0].dateText, "17/11/2026")
  assert.match(visible(render(legacyXml, variables(result[0]))), /no dia 17\/11\/2026,/)
  assert.equal(options(records.slice(1)).length, 0)
})

test("horários diferentes permanecem associados ao dia correto", () => {
  const result = options([visits[1], { ...visits[2], time: "13:30" }])[0]
  const xml = render(legacyXml, variables(result))
  assert.match(visible(xml), /08h em 17\/11\/2026 e 13:30 em 24\/11\/2026/)
  assert.equal(result.datesText, "17/11/2026 - 08:00\n24/11/2026 - 13:30")
})

test("outra recorrência ou unidade não é misturada ao mesmo informativo", () => {
  const result = options([...visits, visit("recurrence", "2027-05-17", "scheduled", { multiDayGroupId: "next" }), visit("other-unit", "2026-12-01", "scheduled", { unitId: "another-unit" })])
  assert.equal(result.length, 3)
  assert.equal(result[0].dateText, "17/11/2026 e 24/11/2026")
})

test("certificados preservam as datas de execução de registros concluídos", () => {
  const result = options([visit("completed-1", "2026-11-04", "completed"), visit("completed-2", "2026-11-06", "completed")], "certificate")
  assert.equal(result[0].datesText, "04/11/2026 e 06/11/2026")
  const xml = '<w:p><w:r><w:t>{{schedule.date}}</w:t></w:r></w:p>'
  assert.match(visible(render(xml, { "schedule.date": result[0].datesText })), /04\/11\/2026 e 06\/11\/2026/)
})

test("a prévia não altera os registros nem os placeholders do modelo original", () => {
  const records = Object.freeze(visits.map(item => Object.freeze({ ...item })))
  const original = JSON.stringify(records)
  const fields = Object.freeze(variables(options(records)[0]))
  const snapshot = JSON.stringify(fields)
  render(legacyXml, fields)
  assert.equal(JSON.stringify(records), original)
  assert.equal(JSON.stringify(fields), snapshot)
  assert.ok(legacyXml.includes("{{schedule."))
})

test("a publicação da Vercel executa a proteção antes do build", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"))
  assert.equal(vercel.buildCommand, "pnpm run build")
  assert.match(pkg.scripts.build, /^pnpm run test:informative-preview && /)
})
