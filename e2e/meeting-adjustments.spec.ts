import { expect, test, type Page } from "@playwright/test"
import { clientFixture, contractFixture, installApiMock, scheduleFixture } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"
import type { ScheduleRecord } from "@/lib/api/schedules"

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
async function mockSchedule(page: Page, initial: Record<string, unknown>, user = E2E_USER) {
  let schedule: typeof scheduleFixture & Pick<ScheduleRecord, "statusHistory"> = { ...scheduleFixture, date: today(), ...initial }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  await page.route("**/api/v1/schedules**", async (route) => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    if (request.method() === "GET" && pathname === "/api/v1/schedules") return route.fulfill({ json: { success: true, data: [schedule] } })
    if (request.method() === "GET" && pathname === `/api/v1/schedules/${schedule.id}`) return route.fulfill({ json: { success: true, data: schedule } })
    if (request.method() === "PATCH" && pathname.endsWith("/request-reschedule")) {
      const body = request.postDataJSON()
      schedule = { ...schedule, status: "awaiting_schedule", statusHistory: [{ status: "awaiting_schedule", reason: body.rescheduleReason === "other" ? "Outros" : "Chuva", rescheduleReason: body.rescheduleReason, rescheduleNotes: body.rescheduleNotes ?? "", changedAt: new Date().toISOString(), changedByName: user.name }] } as typeof schedule
      return route.fulfill({ json: { success: true, data: schedule } })
    }
    if (request.method() === "PATCH" && pathname.endsWith("/status")) {
      const body = request.postDataJSON()
      schedule = { ...schedule, status: body.status, statusHistory: [{ status: body.status, reason: body.reason, changedAt: new Date().toISOString(), changedByName: user.name }] } as typeof schedule
      return route.fulfill({ json: { success: true, data: schedule } })
    }
    if (request.method() === "PATCH" && pathname === `/api/v1/schedules/${schedule.id}`) return route.fulfill({ json: { success: true, data: schedule } })
    return route.fallback()
  })
  return () => schedule
}

test("técnico solicita reagendamento com motivo em tela própria no PDA", async ({ page }) => {
  const user = { ...E2E_USER, permissions: ["agenda_own_view"], isSystemUser: false }
  const current = await mockSchedule(page, { status: "in_progress", canAttachNa: true, completionStartDate: today(), completionStartTime: "08:00", naAttachments: [{ fileName: "na.pdf", documentUrl: "/files/na.pdf" }] }, user)
  await page.goto(`/agenda?date=${today()}&scheduleId=${scheduleFixture.id}`)
  await page.getByRole("button", { name: "Encerrar atendimento", exact: true }).click()
  const requestButton = page.getByRole("button", { name: "Solicitar reagendamento", exact: true })
  await expect(requestButton).toHaveClass(/border/)
  await requestButton.click()
  await expect(page.getByRole("button", { name: "Anexar arquivos", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Confirmar solicitação", exact: true }).click()
  await expect(page.getByText("Selecione o motivo do reagendamento.", { exact: true })).toBeVisible()
  await page.getByRole("combobox", { name: "Motivo do reagendamento *", exact: true }).click()
  await page.getByRole("option", { name: "Outros", exact: true }).click()
  await page.getByRole("button", { name: "Confirmar solicitação", exact: true }).click()
  await expect(page.getByText("Preencha as observações ao selecionar Outros.", { exact: true })).toBeVisible()
  await page.getByLabel("Descreva o motivo / observações *", { exact: true }).fill("Cliente estava com o acesso fechado.")
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole("heading", { name: "Solicitar reagendamento", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Confirmar solicitação", exact: true }).click()
  await expect.poll(() => current().status).toBe("awaiting_schedule")
  expect(current().statusHistory?.at(-1)?.rescheduleReason).toBe("other")
  expect(current().statusHistory?.at(-1)?.rescheduleNotes).toBe("Cliente estava com o acesso fechado.")
})

test("responsável recebe motivo e observações da solicitação preenchidos ao reagendar", async ({ page }) => {
  await mockSchedule(page, {
    status: "awaiting_schedule",
    statusHistory: [{ status: "awaiting_schedule", reason: "Chuva", rescheduleReason: "rain", rescheduleNotes: "Chuva forte registrada pelo técnico.", changedAt: new Date().toISOString(), changedByName: "Técnico" }],
  })
  await page.goto(`/agenda?date=${today()}&scheduleId=${scheduleFixture.id}`)
  await expect(page.getByText("Chuva forte registrada pelo técnico.", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Reagendar", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Motivo do reagendamento *", exact: true })).toHaveText("Chuva")
  await expect(page.getByLabel("Observações do reagendamento", { exact: true })).toHaveValue("Chuva forte registrada pelo técnico.")
  await page.reload()
  await page.getByRole("button", { name: "Reagendar", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Motivo do reagendamento *", exact: true })).toHaveText("Chuva")
  await expect(page.getByLabel("Observações do reagendamento", { exact: true })).toHaveValue("Chuva forte registrada pelo técnico.")
})

test("edição de data também preserva os campos informados na solicitação", async ({ page }) => {
  await mockSchedule(page, {
    isManual: true, contractId: null, status: "awaiting_schedule",
    statusHistory: [{ status: "awaiting_schedule", reason: "Chuva", rescheduleReason: "rain", rescheduleNotes: "Chuva forte registrada pelo técnico.", changedAt: new Date().toISOString(), changedByName: "Técnico" }],
  })
  await page.goto(`/agenda?date=${today()}&scheduleId=${scheduleFixture.id}`)
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  await page.locator('#schedule-form input[type="time"]').fill("09:30")
  await page.getByRole("button", { name: "Salvar", exact: true }).click()
  const confirmation = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Confirmar reagendamento", exact: true }) })
  await expect(confirmation.getByRole("combobox", { name: "Motivo do reagendamento *", exact: true })).toHaveText("Chuva")
  await expect(confirmation.getByLabel("Observações do reagendamento", { exact: true })).toHaveValue("Chuva forte registrada pelo técnico.")
})

test("edição permite não concluído com motivo para quem pode editar sem liberar demais status", async ({ page }) => {
  const user = { ...E2E_USER, permissions: ["agenda_view", "agenda_manage"], isSystemUser: false }
  const current = await mockSchedule(page, { isManual: true, contractId: null, status: "scheduled" }, user)
  await page.goto(`/agenda?date=${today()}&scheduleId=${scheduleFixture.id}`)
  await page.getByRole("button", { name: "Editar agendamento", exact: true }).click()
  const status = page.getByText("Status manual", { exact: true }).locator("..").getByRole("combobox")
  await status.click()
  await expect(page.getByRole("option", { name: "Concluído", exact: true })).toHaveCount(0)
  await page.getByRole("option", { name: "Não concluído", exact: true }).click()
  await expect(page.getByLabel("Motivo *", { exact: true })).toBeVisible()
  await page.getByLabel("Motivo *", { exact: true }).fill("Correção do histórico pelo usuário.")
  await page.getByRole("button", { name: /Salvar/, exact: false }).last().click()
  await expect.poll(() => current().status).toBe("not_completed")
})

test("descarte vem antes do MTR, exige número e filtra placas por tipo", async ({ page }) => {
  await mockSchedule(page, { status: "in_progress", canAttachNa: true, completionStartDate: today(), completionStartTime: "08:00", naAttachments: [{ fileName: "na.pdf", documentUrl: "/files/na.pdf" }] })
  await page.goto(`/agenda?date=${today()}&scheduleId=${scheduleFixture.id}`)
  await page.getByRole("button", { name: "Encerrar atendimento", exact: true }).click()
  await page.getByRole("combobox", { name: "Selecione o tipo", exact: true }).click()
  await page.getByRole("option", { name: "Carro", exact: true }).click()
  await page.getByRole("combobox", { name: "Selecione a placa", exact: true }).click()
  await expect(page.getByRole("option", { name: "ABC1D23", exact: true })).toHaveCount(0)
  await page.getByRole("option", { name: "CAR1A23", exact: true }).click()
  await page.getByRole("combobox", { name: "Selecione o tipo de descarte", exact: true }).click()
  await page.getByRole("option", { name: "Fossa", exact: true }).click()
  const mtr = page.getByLabel("MTR *", { exact: true })
  await expect(mtr).toHaveAttribute("aria-required", "true")
  const mtrBox = await mtr.boundingBox(), disposalBox = await page.getByRole("combobox", { name: "Selecione o tipo de descarte", exact: true }).boundingBox()
  expect(mtrBox!.y).toBeGreaterThan(disposalBox!.y)
  await page.getByRole("combobox", { name: "Selecione a estação", exact: true }).click()
  await page.getByRole("option", { name: /GREEN SERVICE/ }).click()
  await page.getByLabel("Quantidade (M³) *").fill("1")
  await page.getByLabel("Horário de fim *").fill("10:00")
  await page.getByRole("button", { name: "Confirmar encerramento", exact: true }).click()
  await expect(page.getByText("Informe o número do MTR para concluir um atendimento com descarte.", { exact: true })).toBeVisible()
})

test("perfis de cliente e contrato abrem o diálogo compartilhado de atendimento", async ({ page }) => {
  await mockSchedule(page, { status: "scheduled" })
  await page.goto(`/clientes/${clientFixture.id}`)
  await page.getByRole("tab", { name: /Agenda/ }).click()
  await page.getByRole("tabpanel").getByRole("row").filter({ hasText: scheduleFixture.serviceTypeName }).first().click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("tab", { name: /Agenda/ }).click()
  await page.getByRole("tabpanel").getByRole("row").filter({ hasText: scheduleFixture.serviceTypeName }).first().click()
  await expect(page.getByRole("dialog")).toBeVisible()
})

for (const canViewClient of [true, false]) {
test(`nome do cliente no detalhe abre o perfil respeitando permissão (acesso: ${canViewClient})`, async ({ page }) => {
  const user = { ...E2E_USER, permissions: ["agenda_view", ...(canViewClient ? ["clients_view"] : [])], isSystemUser: false }
  await mockSchedule(page, { status: "scheduled" }, user)
  const origin = `/agenda?date=${today()}&scheduleId=${scheduleFixture.id}`
  await page.goto(origin)
  const dialog = page.getByRole("dialog")
  const link = dialog.getByRole("link", { name: scheduleFixture.clientName, exact: true })
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 })
    if (canViewClient) {
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute("href", `/clientes/${clientFixture.id}?returnTo=${encodeURIComponent(origin)}`)
    } else {
      await expect(dialog.getByText(scheduleFixture.clientName, { exact: true })).toBeVisible()
      await expect(link).toHaveCount(0)
    }
  }
  if (canViewClient) {
    await link.click()
    await expect(page).toHaveURL(new RegExp(`/clientes/${clientFixture.id}\\?`))
    await expect(page.getByRole("heading", { name: "Perfil do Cliente", exact: true })).toBeVisible()
    await expect(dialog).toHaveCount(0)
  }
})
}

test("cliente avulso oculta código e assinatura e bloqueia checkbox se há contrato vigente", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.goto("/clientes/novo")
  const toggle = page.getByRole("checkbox", { name: /Cliente sem contrato/ })
  await toggle.check()
  await expect(page.getByLabel("Código financeiro")).toHaveCount(0)
  await expect(page.getByText("Assina o contrato", { exact: true })).toHaveCount(0)
  await toggle.uncheck()
  await expect(page.getByLabel("Código financeiro")).toHaveCount(0)
  await page.route(`**/api/v1/clients/${clientFixture.id}`, route => route.fulfill({ json: { success: true, data: { ...clientFixture, hasActiveContract: true } } }))
  await page.goto(`/clientes/${clientFixture.id}/editar`)
  await expect(page.getByRole("checkbox", { name: /Cliente sem contrato/ })).toBeDisabled()
})

test("configurações da empresa mostram tabelas de tipos e veículos com ações", async ({ page }) => {
  const user = { ...E2E_USER, permissionProfileId: "profile-admin" }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  await page.goto("/configuracoes?section=empresa")
  await expect(page.getByText("Tipos de veículo", { exact: true })).toBeVisible()
  await expect(page.getByRole("cell", { name: "ABC1D23", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Ações de ABC1D23", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Editar", exact: true })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Remover", exact: true })).toBeVisible()
})

for (const isEmergency of [false, true]) {
test(`emergências esgotadas aparece apenas em agendamentos emergenciais (emergencial: ${isEmergency})`, async ({ page }) => {
  await mockSchedule(page, { status: "scheduled", canStartAttendance: true, isEmergency, emergencyContractId: isEmergency ? contractFixture.id : null })
  await page.route("**/api/v1/emergencies", route => route.fulfill({ json: { success: true, data: [{ contractId: contractFixture.id, clientId: clientFixture.id, limit: 15, used: 15, remaining: 0, exhausted: true }] } }))
  const badge = page.getByText("Emergencias esgotadas", { exact: true })
  await page.goto("/agendamentos")
  await expect(page.getByRole("cell", { name: scheduleFixture.serviceTypeName, exact: false }).first()).toBeVisible()
  if (isEmergency) await expect(badge.filter({ visible: true })).toHaveCount(1)
  else await expect(badge).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  if (isEmergency) await expect(badge.filter({ visible: true })).toHaveCount(1)
  else await expect(badge).toHaveCount(0)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`/agenda?date=${today()}&scheduleId=${scheduleFixture.id}`)
  await expect(page.getByRole("dialog")).toBeVisible()
  if (isEmergency) await expect(page.getByRole("dialog").getByText("Emergencias esgotadas", { exact: true })).toBeVisible()
  else await expect(page.getByRole("dialog").getByText("Emergencias esgotadas", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Iniciar atendimento", exact: true })).toBeEnabled()
  await page.goto("/clientes")
  await expect(badge.filter({ visible: true })).toHaveCount(1)
  await page.goto(`/clientes/${clientFixture.id}`)
  await expect(badge).toBeVisible()
})
}

test("contrato novo começa com limite de quinze emergências e permite configurá-lo", async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  await page.goto("/contratos/novo")
  const limit = page.getByLabel("Número de emergências *", { exact: true })
  await expect(limit).toHaveValue("15")
  await limit.fill("7")
  await expect(limit).toHaveValue("7")
})

for (const awaitingSchedules of [false, true]) {
test(`limite de emergências de contrato assinado é editado somente na tela de edição (aguardando agenda: ${awaitingSchedules})`, async ({ page }) => {
  await installAuthenticatedSession(page)
  await installApiMock(page)
  let limit = 15
  await page.route(`**/api/v1/contracts/${contractFixture.id}`, route => route.fulfill({ json: { success: true, data: { ...contractFixture, status: "closed", emergencyLimit: limit, isAwaitingSchedules: awaitingSchedules } } }))
  let scheduleSettingsRequests = 0
  page.on("request", request => { if (request.url().endsWith("/schedule-settings") && request.method() === "PATCH") scheduleSettingsRequests++ })
  await page.route(`**/api/v1/contracts/${contractFixture.id}/emergency-limit`, async route => {
    expect(route.request().method()).toBe("PATCH")
    expect(route.request().postDataJSON()).toEqual({ emergencyLimit: 7 })
    limit = route.request().postDataJSON().emergencyLimit
    await route.fulfill({ json: { success: true, data: { ...contractFixture, status: "closed", emergencyLimit: limit } } })
  })
  await page.goto(`/contratos/${contractFixture.id}`)
  await expect(page.getByLabel("Número de emergências", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Editar", exact: true }).click()
  const field = page.getByLabel("Número de emergências *", { exact: true })
  await expect(field).toHaveValue("15")
  await expect(field).toBeEnabled()
  await expect(page.getByLabel("Nº de parcelas *", { exact: true })).toBeDisabled()
  await expect(page.getByLabel("Dia de vencimento *", { exact: true })).toBeDisabled()
  await expect(page.getByLabel("Valor do Contrato *", { exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Adicionar Serviço", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Editar documento", exact: true })).toHaveCount(0)
  await field.fill("7")
  await page.getByRole("button", { name: "Salvar", exact: true }).first().click()
  await expect.poll(() => limit).toBe(7)
  await page.waitForURL(url => url.pathname === `/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Editar", exact: true }).click()
  await expect(field).toHaveValue("7")
  await expect(page.getByLabel("Valor do Contrato *", { exact: true })).toBeDisabled()
  expect(scheduleSettingsRequests).toBe(0)
})
}

test("botão editar contrato continua respeitando a permissão de edição", async ({ page }) => {
  const user = { ...E2E_USER, permissions: ["contracts_view"], isSystemUser: false }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  await page.goto(`/contratos/${contractFixture.id}`)
  await expect(page.getByRole("heading", { name: contractFixture.contractNumber })).toBeVisible()
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0)
})

for (const width of [1440, 390]) {
  test(`lista permite abrir a edição restrita do contrato assinado (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await installAuthenticatedSession(page)
    await installApiMock(page)
    const contract = { ...contractFixture, status: "closed", emergencyLimit: 15, isAwaitingSchedules: false }
    await page.route("**/api/v1/contracts**", async route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname === "/api/v1/contracts") return route.fulfill({ json: { success: true, data: [contract] } })
      if (pathname === `/api/v1/contracts/${contractFixture.id}`) return route.fulfill({ json: { success: true, data: contract } })
      return route.fallback()
    })
    await page.goto("/contratos")
    if (width >= 640) {
      await page.getByRole("button", { name: `Abrir ações do contrato ${contractFixture.contractNumber}`, exact: true }).click()
      await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
    } else {
      await page.getByRole("link", { name: "Editar", exact: true }).click()
    }
    await expect(page.getByLabel("Número de emergências *", { exact: true })).toBeEnabled()
    await expect(page.getByLabel("Nº de parcelas *", { exact: true })).toBeDisabled()
    await expect(page.getByLabel("Valor do Contrato *", { exact: true })).toBeDisabled()
  })
}
