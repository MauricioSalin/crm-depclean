import { expect, test, type Page } from "@playwright/test"

import { contractFixture, installApiMock, serviceFixture } from "./support/api-mock"
import { installAuthenticatedSession } from "./support/session"
import { getTemplateVariableGroups } from "../components/templates/template-variables"
import {
  buildDownPaymentsText,
  buildInstallmentDueDatesText,
  buildRemainingInstallmentsText,
  currencyToPortuguese,
} from "../lib/contract-down-payments"
import {
  isContractEligibleForRenewal,
  isOperationallyActiveContract,
} from "../lib/contract-status"

const FIXED_NOW = new Date("2026-07-28T12:00:00.000Z")

async function installContractMock(
  page: Page,
  overrides: Record<string, unknown>,
) {
  const contract = {
    ...contractFixture,
    ...overrides,
  }

  await page.route("**/api/v1/contracts**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    if (path !== "/contracts" && path !== `/contracts/${contract.id}`) {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Contrato de teste carregado.",
        data: path === "/contracts" ? [contract] : contract,
        meta: { version: "e2e", timestamp: FIXED_NOW.toISOString() },
      }),
    })
  })
}

async function installServicesMock(
  page: Page,
  services: Array<Record<string, unknown>>,
) {
  await page.route("**/api/v1/services**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Serviços de teste carregados.",
        data: services,
        meta: { version: "e2e", timestamp: FIXED_NOW.toISOString() },
      }),
    })
  })
}

async function installContractTemplateMock(page: Page, name = "Contrato E2E") {
  const template = {
    id: "template-contract-e2e",
    name,
    description: "Template usado no fluxo de contrato.",
    kind: "contract",
    format: "docx",
    html: "",
    signerId: "",
    baseFileName: "",
    informativeSendDaysBefore: 0,
    certificateValidityMonths: 0,
    placeholders: [],
    isActive: true,
    createdAt: FIXED_NOW.toISOString(),
    updatedAt: FIXED_NOW.toISOString(),
  }

  await page.route("**/api/v1/templates**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    const kind = new URL(route.request().url()).searchParams.get("kind")
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Templates de teste carregados.",
        data: kind === "contract" ? [template] : [],
        meta: { version: "e2e", timestamp: FIXED_NOW.toISOString() },
      }),
    })
  })

  return template
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await installAuthenticatedSession(page)
  await installApiMock(page)
})

test("mantém o nome longo do template dentro do seletor", async ({ page }) => {
  const templateName = "Contrato padrão condomínio Depclean - 2 anos (múltiplas entradas)"
  await installContractTemplateMock(page, templateName)
  await page.goto("/contratos/novo")

  const templateSelect = page.getByRole("combobox", { name: "Selecionar template do contrato" })
  await templateSelect.click()
  await page.getByRole("option", { name: templateName }).click()

  const selectedName = templateSelect.locator("span").first()
  await expect(selectedName).toHaveText(templateName)
  await expect(selectedName).toHaveCSS("text-overflow", "ellipsis")

  const geometry = await templateSelect.evaluate((element) => {
    const trigger = element.getBoundingClientRect()
    const icon = element.querySelector("svg")?.getBoundingClientRect()
    return {
      triggerRight: trigger.right,
      iconRight: icon?.right ?? Number.POSITIVE_INFINITY,
    }
  })
  expect(geometry.iconRight).toBeLessThanOrEqual(geometry.triggerRight)

  const title = page.locator("p.font-medium").filter({ hasText: templateName })
  const activeBadge = page.getByText("Ativo", { exact: true })
  const [titleBox, badgeBox] = await Promise.all([title.boundingBox(), activeBadge.boundingBox()])
  expect(titleBox).not.toBeNull()
  expect(badgeBox).not.toBeNull()
  expect(Math.abs(badgeBox!.y - titleBox!.y)).toBeLessThanOrEqual(2)
})

test("usa as novas faixas padrão ao iniciar um contrato", async ({ page }) => {
  await page.goto("/contratos/novo")

  const rangeStarts = page.getByLabel("Quantidade inicial de unidades")
  const rangeEnds = page.getByLabel("Quantidade final de unidades")
  await expect(rangeStarts.nth(0)).toHaveValue("1")
  await expect(rangeStarts.nth(1)).toHaveValue("201")
  await expect(rangeEnds.nth(0)).toHaveValue("200")
  await expect(rangeEnds.nth(1)).toHaveValue("300")
  await expect(page.getByLabel("Quantidade mínima de unidades")).toHaveValue("300")
})

test("permite N entradas e desconta cada uma das parcelas do saldo", async ({ page }) => {
  const contractVariables = getTemplateVariableGroups("contract")
    .flatMap((group) => group.variables.map((variable) => variable.path))
  expect(contractVariables).toContain("contract.downPaymentsText")
  expect(contractVariables).toContain("contract.installmentDueDatesText")
  expect(contractVariables).toContain("contract.remainingInstallmentsText")
  expect(buildDownPaymentsText([
    { value: 5_000, dueDate: "2026-08-06" },
    { value: 5_000, dueDate: "2026-09-06" },
    { value: 5_000, dueDate: "2026-10-06" },
  ])).toBe(
    "03 (três) primeiras parcelas no valor de R$ 5.000,00 (cinco mil reais) cada",
  )
  expect(buildInstallmentDueDatesText("2026-08-06", 7)).toBe(
    "A primeira parcela terá vencimento em 06/08/2026, vencendo as demais parcelas sempre no dia 07 (sete) dos meses subsequentes.",
  )
  expect(buildRemainingInstallmentsText(45, 1_762.67, true)).toBe(
    "45 (quarenta e cinco) parcelas subsequentes no valor de R$ 1.762,67 (mil setecentos e sessenta e dois reais e sessenta e sete centavos) cada",
  )
  expect(currencyToPortuguese(1_762.67)).toBe(
    "mil setecentos e sessenta e dois reais e sessenta e sete centavos",
  )

  await page.goto("/contratos/novo")

  const installmentsInput = page.getByLabel("Nº de parcelas *")
  await installmentsInput.fill("48")
  const totalValue = page.getByLabel("Valor do Contrato *")
  await totalValue.focus()
  await totalValue.pressSequentially("4800000")

  const firstDueDate = page.getByRole("button", { name: "Data da primeira parcela" })
  await expect(firstDueDate).toBeEnabled()
  const addEntryButton = page.getByRole("button", { name: "Inserir entrada" })
  await expect(addEntryButton).toHaveText("Inserir entrada")
  await installmentsInput.focus()
  await expect.poll(
    () => installmentsInput.evaluate((element) => getComputedStyle(element).boxShadow),
  ).toContain("0px 0px 0px 3px")
  const [activeInputBorder, activeInputShadow, buttonBackground] = await Promise.all([
    installmentsInput.evaluate((element) => getComputedStyle(element).borderColor),
    installmentsInput.evaluate((element) => getComputedStyle(element).boxShadow),
    addEntryButton.evaluate((element) => getComputedStyle(element).backgroundColor),
  ])
  await addEntryButton.hover()
  await expect.poll(
    () => addEntryButton.evaluate((element) => getComputedStyle(element).borderColor),
  ).toBe(activeInputBorder)
  await expect.poll(
    () => addEntryButton.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(buttonBackground)
  await expect.poll(
    () => addEntryButton.evaluate((element) => getComputedStyle(element).boxShadow),
  ).toBe(activeInputShadow)
  const entryHeading = page.getByText("Entradas", { exact: true }).locator("..")
  const [headingBox, buttonBox] = await Promise.all([entryHeading.boundingBox(), addEntryButton.boundingBox()])
  expect(headingBox).not.toBeNull()
  expect(buttonBox).not.toBeNull()
  expect(buttonBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height)

  await addEntryButton.click()
  const firstEntryValue = page.getByLabel("Valor da entrada 1 *")
  await firstEntryValue.focus()
  await firstEntryValue.pressSequentially("100000")
  await page.getByRole("button", { name: "Vencimento da entrada 1" }).click()
  await page.getByRole("button", { name: /29 de julho de 2026/i }).click()

  await addEntryButton.click()
  await expect(page.getByLabel("Valor da entrada 2 *")).toHaveValue("R$ 1.000,00")
  await expect(page.getByRole("button", { name: "Vencimento da entrada 2" })).toContainText("29/08/2026")

  await addEntryButton.click()
  await expect(page.getByLabel("Valor da entrada 3 *")).toHaveValue("R$ 1.000,00")
  await expect(page.getByRole("button", { name: "Vencimento da entrada 3" })).toContainText("29/09/2026")

  const lastEntryCard = page.getByRole("button", { name: "Remover entrada 3" }).locator("..")
  const [lastEntryBox, movedButtonBox] = await Promise.all([lastEntryCard.boundingBox(), addEntryButton.boundingBox()])
  expect(lastEntryBox).not.toBeNull()
  expect(movedButtonBox).not.toBeNull()
  expect(movedButtonBox!.y).toBeGreaterThanOrEqual(lastEntryBox!.y + lastEntryBox!.height)
  const summary = page.getByText("Total do contrato", { exact: true }).locator("..").locator("..")
  const [entryStyles, summaryBackground] = await Promise.all([
    lastEntryCard.evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        backgroundColor: styles.backgroundColor,
        borderTopWidth: styles.borderTopWidth,
        borderRightWidth: styles.borderRightWidth,
        borderBottomWidth: styles.borderBottomWidth,
        borderLeftWidth: styles.borderLeftWidth,
      }
    }),
    summary.evaluate((element) => getComputedStyle(element).backgroundColor),
  ])
  expect(entryStyles.backgroundColor).toBe(summaryBackground)
  expect([
    entryStyles.borderTopWidth,
    entryStyles.borderRightWidth,
    entryStyles.borderBottomWidth,
    entryStyles.borderLeftWidth,
  ]).toEqual(["0px", "0px", "0px", "0px"])
  const firstEntryDueDate = page.getByRole("button", { name: "Vencimento da entrada 1" })
  const [valueBackground, dueDateBackground] = await Promise.all([
    firstEntryValue.evaluate((element) => getComputedStyle(element).backgroundColor),
    firstEntryDueDate.evaluate((element) => getComputedStyle(element).backgroundColor),
  ])
  expect(valueBackground).toBe(dueDateBackground)
  expect(valueBackground).not.toBe("rgba(0, 0, 0, 0)")
  await expect(page.getByText(/^Venc\. da entrada \d+ \*$/)).toHaveCount(3)
  await expect(firstDueDate).toHaveCount(0)
  await expect(page.getByText("Quantidade de entradas").locator("..")).toContainText("3")
  await expect(page.getByText("Total das entradas").locator("..")).toContainText("R$ 3.000,00")
  await expect(page.getByText("Saldo a parcelar").locator("..")).toContainText("R$ 45.000,00")
  await expect(page.getByText("Parcelas do saldo").locator("..")).toContainText("45x")
  await expect(page.getByText(
    "03 (três) primeiras parcelas no valor de R$ 1.000,00 (mil reais) cada",
    { exact: true },
  )).toHaveCount(0)

  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: /Remover entrada/ }).first().click()
  }
  await expect(firstDueDate).toBeEnabled()
  await expect(firstDueDate).toContainText("Selecionar data")
})

test("remove do estado da listagem o contrato excluído em preenchimento", async ({ page }) => {
  const fillingContract = {
    ...contractFixture,
    internalStatus: "filling",
    status: "draft",
    formDraft: {
      selectedTemplateId: "",
      createAutomatedSchedules: false,
      createAutomatedInformatives: false,
      startDate: "2026-07-28",
      firstDueDate: "2026-07-28",
      firstVisitDate: "2026-07-28",
      firstVisitTime: "08:00",
      installmentsCountInput: "12",
      dueDayInput: "10",
      selectedUnitIds: ["unit-e2e"],
      recurrenceServiceTypeId: serviceFixture.id,
      services: contractFixture.services,
      contractValue: 420_000,
      downPaymentValue: 0,
      contractRecurrenceRules: [],
    },
  }
  let deleted = false

  await page.route("**/api/v1/contracts**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace("/api/v1", "")

    if (path === `/contracts/${fillingContract.id}` && request.method() === "DELETE") {
      deleted = true
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: null }),
      })
      return
    }

    if (path === `/contracts/${fillingContract.id}` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: fillingContract }),
      })
      return
    }

    if (path === "/contracts" && request.method() === "GET") {
      if (deleted) await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: deleted ? [] : [fillingContract] }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto("/contratos")
  await expect(page.getByText(fillingContract.contractNumber, { exact: true })).toBeVisible()
  await page.getByRole("link", { name: `Abrir contrato ${fillingContract.contractNumber}` }).click()
  await expect(page).toHaveURL(new RegExp(`/contratos/${fillingContract.id}/editar`))
  await page.getByRole("button", { name: "Excluir", exact: true }).click()
  await page.getByRole("button", { name: "Excluir contrato", exact: true }).click()

  await expect(page).toHaveURL(/\/contratos$/)
  await expect(page.getByRole("heading", { name: "Contratos", exact: true })).toBeVisible()
  await expect(page.getByText(fillingContract.contractNumber, { exact: true })).toHaveCount(0, { timeout: 300 })
})

test("inicia com Nenhum quando Visita de rotina não existe", async ({ page }) => {
  await page.goto("/contratos/novo")

  await expect(
    page.getByRole("combobox", { name: "Serviço automático da recorrência" }),
  ).toHaveText("Nenhum")
  await expect(page.getByText("Nenhum serviço adicionado", { exact: true })).toBeVisible()
})

test("seleciona Visita de rotina por padrão e permite remover a automação", async ({ page }) => {
  const routineService = {
    ...serviceFixture,
    id: "srv-visita-de-rotina",
    name: "Visita de rotina",
  }
  await installServicesMock(page, [serviceFixture, routineService])
  await page.goto("/contratos/novo")

  const recurrenceServiceSelect = page.getByRole("combobox", {
    name: "Serviço automático da recorrência",
  })
  await expect(recurrenceServiceSelect).toHaveText("Visita de rotina")
  const routineServiceRow = page.getByRole("row").filter({ hasText: "Visita de rotina" })
  await expect(routineServiceRow).toBeVisible()
  const durationInput = routineServiceRow.locator('input[type="tel"]')
  const initialDuration = await durationInput.inputValue()
  await durationInput.pressSequentially(",")
  await expect(durationInput).toHaveValue(initialDuration)

  await recurrenceServiceSelect.click()
  await page.getByRole("option", { name: "Nenhum", exact: true }).click()

  await expect(recurrenceServiceSelect).toHaveText("Nenhum")
  await expect(page.getByRole("row").filter({ hasText: "Visita de rotina" })).toHaveCount(0)
  await expect(page.getByText("Nenhum serviço adicionado", { exact: true })).toBeVisible()
})

test("preserva as faixas do contrato anterior ao renovar", async ({ page }) => {
  await installContractMock(page, {
    recurrenceRules: [
      { type: "range", minUnits: 1, maxUnits: 100, recurrence: "semiannual" },
      { type: "range", minUnits: 101, maxUnits: 200, recurrence: "quarterly" },
      { type: "above", minUnits: 200, maxUnits: 999999, recurrence: "monthly" },
    ],
  })

  await page.goto(`/contratos/novo?renewFrom=${contractFixture.id}`)

  const rangeStarts = page.getByLabel("Quantidade inicial de unidades")
  const rangeEnds = page.getByLabel("Quantidade final de unidades")
  await expect(rangeStarts.nth(0)).toHaveValue("1")
  await expect(rangeStarts.nth(1)).toHaveValue("101")
  await expect(rangeEnds.nth(0)).toHaveValue("100")
  await expect(rangeEnds.nth(1)).toHaveValue("200")
  await expect(page.getByLabel("Quantidade mínima de unidades")).toHaveValue("200")
  await expect(
    page.getByRole("combobox", { name: "Serviço automático da recorrência" }),
  ).toHaveText(serviceFixture.name)
})

test("oferece Salvar Rascunho também na edição do documento", async ({ page }) => {
  const template = await installContractTemplateMock(page)
  await installContractMock(page, {
    internalStatus: "filling",
    status: "draft",
    documentUrl: "",
    documentFileName: "",
    formDraft: {
      selectedTemplateId: template.id,
      createAutomatedSchedules: false,
      createAutomatedInformatives: false,
      startDate: "2026-07-28",
      firstDueDate: "2026-07-28",
      firstVisitDate: "2026-07-28",
      firstVisitTime: "08:00",
      installmentsCountInput: "12",
      dueDayInput: "10",
      selectedUnitIds: ["unit-e2e"],
      recurrenceServiceTypeId: serviceFixture.id,
      services: contractFixture.services,
      contractValue: 420_000,
      downPaymentValue: 0,
      contractRecurrenceRules: [
        { type: "range", minUnits: 1, maxUnits: 200, recurrence: "semiannual" },
        { type: "range", minUnits: 201, maxUnits: 300, recurrence: "quarterly" },
        { type: "above", minUnits: 300, maxUnits: 999999, recurrence: "monthly" },
      ],
    },
  })

  await page.goto(`/contratos/${contractFixture.id}/editar`)
  await page.getByRole("button", { name: "Avançar" }).first().click()

  await expect(page.getByRole("button", { name: "Voltar ao formulário" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Salvar Rascunho" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Concluir e salvar" })).toBeVisible()
})

test("exibe Renovar a partir de dois meses antes do fim da vigência", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    startDate: "2025-09-28",
    endDate: "2026-09-28",
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  const renewLink = page.getByRole("link", { name: "Renovar", exact: true })
  await expect(renewLink).toBeVisible()
  await expect(renewLink).toHaveAttribute("href", /\/contratos\/novo\?renewFrom=contract-e2e/)
  await expect(page.getByRole("button", { name: "Marcar como renovado", exact: true })).toHaveCount(0)
})

test("permite marcar contrato assinado como renovado antes da janela de dois meses", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    startDate: "2025-09-29",
    endDate: "2026-09-29",
  })

  await page.goto("/contratos")
  await page.getByRole("button", {
    name: `Abrir ações do contrato ${contractFixture.contractNumber}`,
  }).click()
  await expect(page.getByRole("menuitem", { name: "Renovar", exact: true })).toHaveCount(0)
  await expect(page.getByRole("menuitem", { name: "Marcar como renovado", exact: true })).toBeVisible()

  await page.goto(`/contratos/${contractFixture.id}`)

  await expect(page.getByRole("link", { name: "Renovar", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Marcar como renovado", exact: true })).toHaveCount(0)
})

test("ajusta a janela de dois meses para o último dia do mês de destino", () => {
  const contract = {
    status: "closed",
    endDate: "2027-04-30",
  }

  expect(isContractEligibleForRenewal(
    contract,
    new Date("2027-02-28T12:00:00.000Z"),
  )).toBe(true)
  expect(isContractEligibleForRenewal(
    contract,
    new Date("2027-02-27T12:00:00.000Z"),
  )).toBe(false)
})

test("mantém Renovar disponível após o vencimento", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    startDate: "2025-08-28",
    endDate: "2026-07-27",
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  await expect(page.getByRole("link", { name: "Renovar", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Marcar como renovado", exact: true })).toHaveCount(0)
})

test("exibe Renovado e oculta novas ações mesmo quando marcado antes do vencimento", async ({ page }) => {
  const contract = {
    status: "closed",
    renewalStatus: "renewed",
    startDate: "2025-09-28",
    endDate: "2026-09-28",
  }
  await installContractMock(page, contract)

  await page.goto(`/contratos/${contractFixture.id}`)

  await expect(page.getByText("Renovado", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Renovar", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Marcar como renovado", exact: true })).toHaveCount(0)
  expect(isContractEligibleForRenewal(contract, FIXED_NOW)).toBe(false)
})

test("não trata Renovado como ativo mesmo antes ou depois do fim da vigência anterior", () => {
  for (const endDate of ["2026-07-20", "2026-09-20"]) {
    const contract = {
      status: "closed",
      renewalStatus: "renewed",
      startDate: "2025-07-20",
      endDate,
    }

    expect(isOperationallyActiveContract(contract, FIXED_NOW)).toBe(false)
  }
})

test("deixa Renovar e Marcar como renovado por último no menu e confirma a ação manual", async ({ page }) => {
  let markRenewedRequests = 0
  await installContractMock(page, {
    status: "closed",
    startDate: "2025-08-28",
    endDate: "2026-07-27",
  })
  await page.route(`**/api/v1/contracts/${contractFixture.id}/mark-renewed`, async (route) => {
    markRenewedRequests += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Contrato marcado como renovado.",
        data: {
          ...contractFixture,
          status: "closed",
          renewalStatus: "renewed",
        },
      }),
    })
  })

  await page.goto("/contratos")
  await page.getByRole("button", {
    name: `Abrir ações do contrato ${contractFixture.contractNumber}`,
  }).click()

  const menuItems = page.getByRole("menuitem")
  const itemLabels = await menuItems.allTextContents()
  expect(itemLabels.slice(-2)).toEqual(["Renovar", "Marcar como renovado"])

  await page.getByRole("menuitem", { name: "Marcar como renovado" }).click()
  await expect(page.getByRole("dialog")).toContainText("Marcar contrato como renovado?")
  await page.getByRole("dialog").getByRole("button", { name: "Marcar como renovado" }).click()

  await expect.poll(() => markRenewedRequests).toBe(1)
})

test("abre o documento correto no ClickSign em vez do envelope", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    clicksign: {
      envelopeId: "a57ca141-7165-4b7d-a136-01d7ea00eb23",
      documentKey: "cd01f2bf-7030-446f-9c02-b3c96c80245d",
      documentId: "cd01f2bf-7030-446f-9c02-b3c96c80245d",
      folderId: "49449970",
      webhookId: "",
      status: "closed",
      signers: [],
    },
  })
  let syncRequests = 0
  await page.route(`**/api/v1/clicksign/contracts/${contractFixture.id}/sync`, async (route) => {
    syncRequests += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: null }),
    })
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  await expect(page.getByRole("link", { name: "ClickSign", exact: true })).toHaveAttribute(
    "href",
    "https://app.clicksign.com/accounts/379383/folders/49449970/documents/cd01f2bf-7030-446f-9c02-b3c96c80245d",
  )
  await page.waitForTimeout(250)
  expect(syncRequests).toBe(0)
})

test("mostra sucesso imediato no envio ClickSign e restaura a acao quando falha", async ({ page }) => {
  await installContractMock(page, {
    status: "draft",
    clicksign: undefined,
  })

  let markRequestStarted: (() => void) | undefined
  let releaseResponse: (() => void) | undefined
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve
  })
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })

  await page.route(`**/api/v1/clicksign/contracts/${contractFixture.id}/send`, async (route) => {
    markRequestStarted?.()
    await responseGate
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Falha de teste ao enviar para a ClickSign.",
        error: "Bad Gateway",
        statusCode: 502,
      }),
    })
  })

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Enviar ClickSign" }).click()
  await requestStarted

  await expect(page.getByText("O envio para assinatura no ClickSign foi iniciado em segundo plano.")).toBeVisible()

  releaseResponse?.()

  await expect(page.getByText("Falha de teste ao enviar para a ClickSign.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Enviar ClickSign" })).toBeEnabled()
})

test("permite editar e reenviar um contrato cancelado em um novo envelope", async ({ page }) => {
  await installContractMock(page, {
    status: "canceled",
    clicksign: {
      envelopeId: "envelope-canceled",
      documentKey: "document-canceled",
      documentId: "document-canceled",
      folderId: "49449970",
      webhookId: "webhook-1",
      status: "canceled",
      signers: [],
    },
  })

  let replaceRequests = 0
  let sendRequests = 0
  await page.route(`**/api/v1/clicksign/contracts/${contractFixture.id}/replace`, async (route) => {
    replaceRequests += 1
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { status: "running" } }),
    })
  })
  await page.route(`**/api/v1/clicksign/contracts/${contractFixture.id}/send`, async (route) => {
    sendRequests += 1
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { status: "running" } }),
    })
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  await expect(page.getByText("Cancelado", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: "Editar Contrato" })).toBeVisible()
  await page.getByRole("button", { name: "Reenviar ClickSign" }).click()

  await expect(page.getByText("O novo envio para assinatura no ClickSign foi iniciado em segundo plano.")).toBeVisible()
  await expect.poll(() => replaceRequests).toBe(1)
  expect(sendRequests).toBe(0)
})

test("mostra sucesso imediato ao enviar agendamentos e preserva o plano quando falha", async ({ page }) => {
  await installContractMock(page, {
    status: "closed",
    signedAt: FIXED_NOW.toISOString(),
    automationCreateSchedules: true,
    automationSchedulePlanSavedAt: FIXED_NOW.toISOString(),
    automationSchedulePlanPublishedAt: undefined,
    clicksign: {
      envelopeId: "envelope-e2e",
      documentId: "document-e2e",
      documentKey: "document-e2e",
      status: "closed",
      signers: [],
    },
  })

  let markRequestStarted: (() => void) | undefined
  let releaseResponse: (() => void) | undefined
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve
  })
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })

  await page.route(`**/api/v1/contracts/${contractFixture.id}/schedule-plan/publish`, async (route) => {
    markRequestStarted?.()
    await responseGate
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Falha de teste ao publicar os agendamentos.",
        error: "Bad Gateway",
        statusCode: 502,
      }),
    })
  })

  await page.goto(`/contratos/${contractFixture.id}`)
  await page.getByRole("button", { name: "Enviar agendamentos" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Enviar agendamentos" }).click()
  await requestStarted

  await expect(page.getByText("A publicação e os alertas estão sendo processados em segundo plano.")).toBeVisible()

  releaseResponse?.()

  await expect(page.getByText("Falha de teste ao publicar os agendamentos.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Enviar agendamentos" })).toBeEnabled()
})

test("exibe hífen sem ícone para equipe não definida no perfil do contrato", async ({ page }) => {
  await installContractMock(page, {
    services: contractFixture.services.map((service) => ({
      ...service,
      teamIds: [],
      additionalEmployeeIds: [],
    })),
  })

  await page.goto(`/contratos/${contractFixture.id}`)

  const emptyAssignment = page.getByText("-", { exact: true }).first()
  await expect(emptyAssignment).toBeVisible()
  await expect(emptyAssignment.locator("xpath=ancestor::td[1]").locator("svg")).toHaveCount(0)
})
