import { expect, test } from "@playwright/test"
import { clientFixture, contractFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import { resolveScheduleDisplayPeriod } from "../lib/schedule-display-period"
import type { ScheduleRecord } from "../lib/api/schedules"

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-28T12:00:00Z"))
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("adiciona N assessores e preenche subsíndico fixo, salva checkbox individual e recarrega", async ({ page }) => {
  let client: any = {
    ...clientFixture, cnpj: "11.222.333/0001-81", responsibleCpf: "529.982.247-25",
    assessor: { ...clientFixture.assessor, cpf: "" }, syndic: { ...clientFixture.syndic, cpf: "529.982.247-25" },
    additionalAssessors: [], subSyndics: [],
  }
  let saved: any
  await page.route(`**/api/v1/clients/${client.id}`, async (route) => {
    if (route.request().method() === "PATCH") {
      saved = route.request().postDataJSON()
      client = { ...client, ...saved, assessor: {
        name: saved.assessorName, cpf: saved.assessorCpf, email: saved.assessorEmail,
        phone: saved.assessorPhone, receivesNotifications: saved.assessorReceivesNotifications,
      } }
    }
    await route.fulfill({ json: { success: true, data: client } })
  })
  await page.goto(`/clientes/${client.id}/editar`)
  const assessors = page.getByRole("group", { name: "Assessor", exact: true })
  const addAssessor = page.getByRole("button", { name: "Adicionar assessor", exact: true })
  await expect(assessors).toHaveCount(1)
  await assessors.first().getByRole("button", { name: "Adicionar assessor", exact: true }).click()
  await expect(assessors).toHaveCount(2)
  await expect(assessors.first().getByRole("button", { name: "Adicionar assessor" })).toHaveCount(0)
  await assessors.last().getByRole("button", { name: "Adicionar assessor", exact: true }).click()
  await expect(assessors).toHaveCount(3)
  await expect(addAssessor).toHaveCount(1)
  await expect(assessors.last().getByRole("button", { name: "Adicionar assessor", exact: true })).toBeVisible()
  expect(await assessors.evaluateAll((cards) => cards.every((card) => card.parentElement === cards[0].parentElement))).toBe(true)
  await expect(assessors.getByRole("heading")).toHaveText(["Assessor", "Assessor", "Assessor"])
  await expect(assessors.locator("fieldset")).toHaveCount(0)
  await expect(assessors.getByText(/adicional|Assessor \d/i)).toHaveCount(0)
  await assessors.first().getByLabel("Nome", { exact: true }).fill("Assessor principal editado")
  await assessors.nth(1).getByLabel("Nome *", { exact: true }).fill("Ana Assessor")
  await assessors.nth(1).getByLabel("Telefone *", { exact: true }).fill("51999990001")
  await assessors.nth(1).getByRole("checkbox").check()
  await assessors.nth(2).getByLabel("Nome *", { exact: true }).fill("Bruna Assessor")
  await assessors.nth(2).getByLabel("Telefone *", { exact: true }).fill("51999990002")
  const subSyndic = page.getByRole("group", { name: "Subsíndico", exact: true })
  await expect(subSyndic).toHaveCount(1)
  await subSyndic.getByLabel("Nome", { exact: true }).fill("Carlos Subsíndico")
  await subSyndic.getByLabel("Telefone", { exact: true }).fill("51999990003")
  await subSyndic.getByRole("checkbox").check()
  await page.setViewportSize({ width: 1536, height: 1100 })
  await assessors.nth(1).scrollIntoViewIfNeeded()
  await page.screenshot({ path: "test-results/assessor-independent-cards.png" })
  await assessors.last().screenshot({ path: "test-results/assessor-last-card.png" })
  expect(await page.locator("input:invalid").evaluateAll((inputs) => inputs.map((input) => ({ id: input.id, message: (input as HTMLInputElement).validationMessage })))).toEqual([])
  await page.getByRole("button", { name: /Salvar/ }).first().click()
  await expect.poll(() => saved).toBeTruthy()
  expect(saved.additionalAssessors).toHaveLength(2)
  expect(saved.assessorName).toBe("Assessor principal editado")
  expect(saved.additionalAssessors.map((item: any) => item.name)).toEqual(["Ana Assessor", "Bruna Assessor"])
  expect(saved.additionalAssessors.map((item: any) => item.receivesNotifications)).toEqual([true, false])
  expect(saved.subSyndics[0]).toMatchObject({ name: "Carlos Subsíndico", receivesNotifications: true, cpf: "" })
  await page.goto(`/clientes/${client.id}/editar`)
  await expect(assessors.first().getByLabel("Nome", { exact: true })).toHaveValue("Assessor principal editado")
  await expect(assessors.nth(1).getByLabel("Nome *", { exact: true })).toHaveValue("Ana Assessor")
  await expect(assessors.nth(1).getByRole("checkbox")).toBeChecked()
  await expect(assessors.last().getByRole("checkbox")).not.toBeChecked()
  await assessors.nth(1).getByRole("button", { name: "Remover assessor", exact: true }).click()
  await expect(assessors).toHaveCount(2)
  await expect(assessors.last().getByLabel("Nome *", { exact: true })).toHaveValue("Bruna Assessor")
  await expect(assessors.last().getByRole("button", { name: "Adicionar assessor", exact: true })).toBeVisible()
  await assessors.last().getByRole("button", { name: "Remover assessor", exact: true }).click()
  await expect(assessors).toHaveCount(1)
  await expect(assessors.first().getByRole("button", { name: "Adicionar assessor", exact: true })).toBeVisible()
})

test("subsíndico fixo permite cadastro vazio e exige nome e telefone apenas para notificações", async ({ page }) => {
  let client: any = {
    ...clientFixture, cnpj: "11.222.333/0001-81", responsibleCpf: "529.982.247-25",
    assessor: { ...clientFixture.assessor, cpf: "" }, syndic: { ...clientFixture.syndic, cpf: "529.982.247-25" },
    additionalAssessors: [], subSyndics: [],
  }
  const payloads: any[] = []
  await page.route(`**/api/v1/clients/${client.id}`, async (route) => {
    if (route.request().method() === "PATCH") {
      const saved = route.request().postDataJSON()
      payloads.push(saved)
      client = { ...client, ...saved, subSyndics: saved.subSyndics.filter((contact: any) =>
        contact.name.trim() || contact.phone.trim() || contact.email.trim() || contact.cpf.trim()),
      }
    }
    await route.fulfill({ json: { success: true, data: client } })
  })
  await page.goto(`/clientes/${client.id}/editar`)
  const card = page.getByRole("group", { name: "Subsíndico", exact: true })
  const name = card.locator("#subSyndicName")
  const phone = card.locator("#subSyndicPhone")
  const checkbox = card.getByRole("checkbox")
  const save = page.getByRole("button", { name: /Salvar/ }).first()
  await expect(card).toHaveCount(1)
  await expect(card.getByRole("heading")).toHaveText("Subsíndico")
  await expect(card.locator("fieldset")).toHaveCount(0)
  await expect(card.getByRole("button")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Adicionar subsíndico|Remover subsíndico/ })).toHaveCount(0)
  expect(await card.evaluate((element) => element.parentElement === document.querySelector("#syndicName")?.closest('[data-slot="card"]')?.parentElement)).toBe(true)
  await expect(name).not.toHaveAttribute("required")
  await expect(phone).not.toHaveAttribute("required")
  await save.click()
  await expect.poll(() => payloads.length).toBe(1)
  expect(payloads[0].subSyndics).toEqual([])
  await expect(page).not.toHaveURL(/\/editar/)

  await page.goto(`/clientes/${client.id}/editar`)
  await name.fill("Carlos")
  await save.click()
  await expect.poll(() => payloads.length).toBe(2)
  expect(payloads[1].subSyndics).toHaveLength(1)
  expect(payloads[1].subSyndics[0]).toMatchObject({ name: "Carlos", phone: "", receivesNotifications: false })
  const contactId = payloads[1].subSyndics[0].id
  await expect(page).not.toHaveURL(/\/editar/)

  await page.goto(`/clientes/${client.id}/editar`)
  await expect(name).toHaveValue("Carlos")
  await checkbox.check()
  await expect(name).toHaveAttribute("required", "")
  await expect(phone).toHaveAttribute("required", "")
  await save.click()
  await expect(page.getByText("Informe nome e telefone do subsíndico para receber notificações.")).toBeVisible()
  expect(payloads).toHaveLength(2)
  await name.fill("")
  await phone.fill("51999990003")
  await save.click()
  await expect(page.getByText("Informe nome e telefone do subsíndico para receber notificações.").first()).toBeVisible()
  expect(payloads).toHaveLength(2)
  await name.fill("Carlos")
  await page.setViewportSize({ width: 1536, height: 1100 })
  await card.screenshot({ path: "test-results/subsyndic-fixed-card.png" })
  await save.click()
  await expect.poll(() => payloads.length).toBe(3)
  expect(payloads[2].subSyndics).toEqual([{ id: contactId, name: "Carlos", phone: "(51) 99999-0003", email: "", cpf: "", receivesNotifications: true }])
  await expect(page).not.toHaveURL(/\/editar/)

  await page.goto(`/clientes/${client.id}/editar`)
  await expect(checkbox).toBeChecked()
  await expect(name).toHaveValue("Carlos")
  await checkbox.uncheck()
  await name.fill("")
  await phone.fill("")
  await expect(name).not.toHaveAttribute("required")
  await expect(phone).not.toHaveAttribute("required")
  await page.setViewportSize({ width: 390, height: 844 })
  await card.screenshot({ path: "test-results/subsyndic-fixed-card-mobile.png" })
  expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await save.click()
  await expect.poll(() => payloads.length).toBe(4)
  await expect(page).not.toHaveURL(/\/editar/)
  await page.goto(`/clientes/${client.id}/editar`)
  await expect(card).toHaveCount(1)
  await expect(name).toHaveValue("")
  await expect(checkbox).not.toBeChecked()
})

test("lista entradas sem data como aguardando assinatura", async ({ page }) => {
  const contract = {
    ...contractFixture, downPaymentDueDateMode: "signature_plus_7", downPaymentValue: 100,
    downPayments: [{ id: "entry", number: 1, value: 100, dueDate: "" }],
    installments: [{ id: "installment", number: 1, value: 100, dueDate: "", awaitingSignature: true, status: "pending", createdAt: contractFixture.createdAt }],
  }
  await page.route(`**/api/v1/contracts/${contract.id}`, (route) => route.fulfill({ json: { success: true, data: contract } }))
  await page.goto(`/contratos/${contract.id}`)
  await page.getByRole("tab", { name: /Parcelas/ }).click()
  await expect(page.getByRole("cell", { name: "Aguardando assinatura", exact: true })).toBeVisible()
  await page.route("**/api/v1/contracts**", async (route) => {
    if (new URL(route.request().url()).pathname === "/api/v1/contracts") return route.fulfill({ json: { success: true, data: [contract] } })
    await route.fallback()
  })
  await page.goto(`/clientes/${clientFixture.id}?tab=parcelas`)
  await page.getByRole("tab", { name: /Parcelas/ }).click()
  await expect(page.getByRole("cell", { name: "Aguardando assinatura", exact: true })).toBeVisible()
})

test("reagendamento exige observações só em Outros e exibe histórico sem duplicar o calendário", async ({ page }) => {
  let record: any = { ...scheduleFixture, date: "2026-07-29", billable: false, value: 0 }
  const payloads: any[] = []
  await page.route("**/api/v1/schedules**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/reschedule-options")) return route.fulfill({ json: { success: true, data: [{ date: "2026-07-30", time: "09:00" }] } })
    if (path.endsWith("/reschedule")) {
      const payload = route.request().postDataJSON()
      payloads.push(payload)
      record = {
        ...record, status: "rescheduled", date: payload.scheduledDate, time: payload.scheduledTime,
        originalScheduledDate: "2026-07-29", originalScheduledTime: "08:00",
        rescheduleHistory: [{ fromDate: "2026-07-29", fromTime: "08:00", toDate: payload.scheduledDate, toTime: payload.scheduledTime, reason: payload.rescheduleReason, reasonLabel: "Chuva", notes: payload.rescheduleNotes, changedAt: "2026-07-28T12:00:00Z" }],
      }
      return route.fulfill({ json: { success: true, data: record } })
    }
    if (path === "/api/v1/schedules") return route.fulfill({ json: { success: true, data: [record] } })
    if (path === `/api/v1/schedules/${record.id}`) return route.fulfill({ json: { success: true, data: record } })
    await route.fallback()
  })
  await page.goto("/agenda?date=2026-07-29&view=week")
  await page.locator(`[data-schedule-id="${record.id}"]`).click()
  await page.getByRole("button", { name: "Reagendar", exact: true }).click()
  const suggestion = page.getByRole("button").filter({ hasText: "09:00" }).first()
  await suggestion.click()
  await expect(page.getByText("Selecione o motivo do reagendamento.")).toBeVisible()
  expect(payloads).toHaveLength(0)
  await page.getByRole("combobox", { name: "Motivo do reagendamento *" }).click()
  await page.getByRole("option", { name: "Outros", exact: true }).click()
  await suggestion.click()
  await expect(page.getByText("Preencha as observações ao selecionar Outros.")).toBeVisible()
  expect(payloads).toHaveLength(0)
  await page.getByRole("combobox", { name: "Motivo do reagendamento *" }).click()
  await page.getByRole("option", { name: "Chuva", exact: true }).click()
  const notes = page.getByLabel("Observações do reagendamento", { exact: true })
  await expect(notes).toBeVisible()
  await expect(notes).not.toHaveAttribute("required")
  const reasonSection = notes.locator("../..")
  const suggestionsSection = page.getByText("Sugestões disponíveis", { exact: true }).locator("..")
  const manualSection = page.getByText("Escolher manualmente", { exact: true }).locator("..")
  for (const section of [reasonSection, suggestionsSection, manualSection]) {
    await expect(section).toHaveCSS("border-top-width", "0px")
    await expect(section).toHaveCSS("padding", "0px")
  }
  await expect(reasonSection.locator("svg.lucide-message-square-text")).toHaveCount(1)
  await page.getByRole("dialog").screenshot({ path: "test-results/reschedule-unboxed.png" })
  await suggestion.click()
  await expect.poll(() => payloads.length).toBe(1)
  expect(payloads[0]).toMatchObject({ rescheduleReason: "rain", rescheduleNotes: "", scheduledDate: "2026-07-30" })
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator(`[data-schedule-id="${record.id}"]`)).toHaveCount(1)
  await page.locator(`[data-schedule-id="${record.id}"]`).click()
  await expect(page.getByText("Histórico de reagendamentos")).toBeVisible()
  await expect(page.getByText("Chuva", { exact: true })).toBeVisible()
  await page.screenshot({ path: "test-results/reschedule-history.png", fullPage: true })
})

test("timeline usa data agendada, última reagendada ou execução conforme o status", () => {
  const base = { ...scheduleFixture, originalScheduledDate: "2026-07-20", date: "2026-07-29" } as ScheduleRecord
  expect(resolveScheduleDisplayPeriod(base).date).toBe("2026-07-29")
  expect(resolveScheduleDisplayPeriod({ ...base, status: "rescheduled", date: "2026-07-30" }).date).toBe("2026-07-30")
  const completed = resolveScheduleDisplayPeriod({
    ...base, status: "completed", completionStartDate: "2026-07-31", completionStartTime: "09:15",
    completionEndDate: "2026-07-31", completionEndTime: "11:00",
  })
  expect(completed).toMatchObject({ date: "2026-07-31", time: "09:15", durationMinutes: 105, usesExecutionPeriod: true })
})

for (const screen of ["agendamentos", "agenda"]) {
  test(`edição pela ${screen} pede justificativa em modal somente ao salvar a data ou horário`, async ({ page }) => {
    const record = { ...scheduleFixture, date: "2026-07-29" }
    let saved: any
    await page.route("**/api/v1/schedules**", async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === "/api/v1/schedules") return route.fulfill({ json: { success: true, data: [record] } })
      if (path === `/api/v1/schedules/${record.id}`) {
        if (route.request().method() === "PATCH") saved = route.request().postDataJSON()
        return route.fulfill({ json: { success: true, data: { ...record, status: saved ? "rescheduled" : record.status } } })
      }
      if (path.endsWith("/status")) return route.fulfill({ json: { success: true, data: { ...record, status: "rescheduled" } } })
      await route.fallback()
    })
    if (screen === "agenda") {
      await page.goto("/agenda?date=2026-07-29&view=week")
      await page.locator(`[data-schedule-id="${record.id}"]`).click()
      await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
    } else {
      await page.goto("/agendamentos")
      await page.getByRole("button", { name: `Abrir ações do agendamento de ${record.clientName}` }).click()
      await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
    }
    const dialog = page.getByRole("dialog", { name: "Editar atendimento recorrente" })
    await dialog.locator('input[type="time"]').fill("09:00")
    if (screen === "agenda") {
      await dialog.getByRole("button", { name: "29/07/2026", exact: true }).click()
      await page.getByRole("button", { name: /30 de julho de 2026/i }).click()
    }
    await expect(dialog.getByRole("combobox", { name: "Motivo do reagendamento *" })).toHaveCount(0)
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
    const confirmation = page.getByRole("dialog", { name: "Confirmar reagendamento", exact: true })
    await expect(confirmation).toBeVisible()
    await expect(confirmation.locator("svg.lucide-message-square-text")).toHaveCount(0)
    expect(saved).toBeUndefined()
    await confirmation.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(confirmation).toHaveCount(0)
    await expect(dialog.locator('input[type="time"]')).toHaveValue("09:00")
    await expect(dialog.getByRole("combobox", { name: "Motivo do reagendamento *" })).toHaveCount(0)
    expect(saved).toBeUndefined()
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click()
    await expect(confirmation).toBeVisible()
    const confirm = confirmation.getByRole("button", { name: "Salvar reagendamento", exact: true })
    await confirm.click()
    await expect(page.getByText("Selecione o motivo do reagendamento.")).toBeVisible()
    expect(saved).toBeUndefined()
    await confirmation.getByRole("combobox", { name: "Motivo do reagendamento *" }).click()
    await page.getByRole("option", { name: "Outros", exact: true }).click()
    await expect(confirmation.getByRole("textbox")).toHaveAttribute("required", "")
    await confirm.click()
    await expect(page.getByText("Preencha as observações ao selecionar Outros.")).toBeVisible()
    expect(saved).toBeUndefined()
    if (screen === "agenda") {
      await confirmation.getByRole("combobox", { name: "Motivo do reagendamento *" }).click()
      await page.getByRole("option", { name: "Chuva", exact: true }).click()
      await expect(confirmation.getByRole("textbox")).not.toHaveAttribute("required")
    } else {
      await confirmation.getByLabel("Descreva o motivo / observações *").fill("Solicitação do condomínio.")
      await confirmation.screenshot({ path: "test-results/reschedule-edit-confirmation.png" })
      await page.setViewportSize({ width: 390, height: 844 })
      await confirmation.screenshot({ path: "test-results/reschedule-edit-confirmation-mobile.png" })
      expect(await confirmation.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    }
    await confirm.click()
    await expect.poll(() => saved).toBeTruthy()
    expect(saved).toMatchObject({ scheduledTime: "09:00", rescheduleReason: screen === "agenda" ? "rain" : "other", rescheduleNotes: screen === "agenda" ? "" : "Solicitação do condomínio." })
    if (screen === "agenda") expect(saved.scheduledDate).toBe("2026-07-30")
    await expect(confirmation).toHaveCount(0)
  })
}

test("contratos antigos mantêm o campo de vencimento das entradas", async ({ page }) => {
  const contract = {
    ...contractFixture, status: "draft", downPaymentValue: 100,
    downPayments: [{ id: "entry", number: 1, value: 100, dueDate: "2026-07-29" }],
  }
  await page.route(`**/api/v1/contracts/${contract.id}`, (route) => route.fulfill({ json: { success: true, data: contract } }))
  await page.goto(`/contratos/${contract.id}/editar`)
  await expect(page.getByRole("button", { name: "Vencimento da entrada 1" })).toContainText("29/07/2026")
})
