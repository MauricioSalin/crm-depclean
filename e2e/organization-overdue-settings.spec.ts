import { expect, test } from "@playwright/test"

import { installApiMock } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"

const adminUser = {
  ...E2E_USER,
  permissionProfileId: "profile-admin",
}

const organization = {
  id: "organization",
  legalName: "Depclean E2E",
  cnpj: "00.000.000/0001-00",
  address: {
    street: "Rua dos Testes",
    number: "100",
    complement: "",
    neighborhood: "Centro",
    city: "Canoas",
    state: "RS",
    zipCode: "92000-000",
  },
  phone: "(51) 99999-9999",
  email: "contato@depclean.test",
  financialSettings: {
    installmentOverdueGraceDays: 5,
    firstInstallmentOverdueGraceDays: 12,
  },
}

test("configura os prazos de vencimento geral e da primeira parcela em uma secao propria", async ({ page }) => {
  let patchPayload: unknown

  await installAuthenticatedSession(page, adminUser)
  await installApiMock(page, adminUser)
  await page.route("**/api/v1/settings/organization", async (route) => {
    const request = route.request()
    if (request.method() === "PATCH") {
      patchPayload = request.postDataJSON()
      const payload = patchPayload as { financialSettings?: typeof organization.financialSettings }
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          success: true,
          data: {
            ...organization,
            financialSettings: payload.financialSettings ?? organization.financialSettings,
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ success: true, data: organization }),
    })
  })

  await page.goto("/configuracoes")
  await expect(page.getByText("Tipos de Cliente", { exact: true }).last()).toBeVisible()
  await page.getByText("Empresa", { exact: true }).last().click()

  await expect(page.getByText("Dados da empresa", { exact: true })).toBeVisible()
  await expect(page.getByText("Configurações da empresa", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Prazo padrão (dias)")).toHaveValue("5")
  await expect(page.getByLabel("Prazo da primeira parcela (dias)")).toHaveValue("12")
  await expect(page.getByLabel("Prazo padrão (dias)")).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await expect(page.getByLabel("Prazo da primeira parcela (dias)")).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await expect(page.getByText("Aplicado da segunda parcela em diante.", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Aplicado somente à parcela nº 1 de cada contrato.", { exact: true })).toHaveCount(0)
  const overdueSettingsSection = page.getByText("Parcelas vencidas", { exact: true }).locator("xpath=../..")
  await expect(overdueSettingsSection).toHaveCSS("border-top-width", "0px")

  await page.getByLabel("Prazo padrão (dias)").fill("7")
  await page.getByLabel("Prazo da primeira parcela (dias)").fill("15")
  const financialSettingsCard = page.getByText("Configurações da empresa", { exact: true }).locator("xpath=../../../..")
  await financialSettingsCard.getByRole("button", { name: "Salvar", exact: true }).click()

  await expect.poll(() => patchPayload).toEqual({
    financialSettings: {
      installmentOverdueGraceDays: 7,
      firstInstallmentOverdueGraceDays: 15,
    },
  })
  await expect(page.getByText("Configurações da empresa atualizadas.")).toBeVisible()
})
