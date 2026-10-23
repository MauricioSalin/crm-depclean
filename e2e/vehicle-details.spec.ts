import { expect, test } from "@playwright/test"
import { installApiMock } from "./support/api-mock"
import { E2E_USER, installAuthenticatedSession } from "./support/session"
import type { VehicleRecord } from "@/lib/api/vehicles"

test("cadastro e edição mostram e preservam modelo, cor e ano na tabela", async ({ page }) => {
  const user = { ...E2E_USER, permissionProfileId: "profile-admin" }
  await installAuthenticatedSession(page, user)
  await installApiMock(page, user)
  const types = [{ id: "truck", name: "Caminhão" }]
  const vehicles: VehicleRecord[] = [{ id: "legacy", typeId: "truck", plate: "ABC1D23" }]
  await page.route("**/api/v1/vehicles**", async route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.method() === "POST" && pathname === "/api/v1/vehicles") vehicles.push({ id: "new-vehicle", ...request.postDataJSON() })
    else if (request.method() === "PATCH" && pathname === "/api/v1/vehicles/new-vehicle") Object.assign(vehicles.find(vehicle => vehicle.id === "new-vehicle")!, request.postDataJSON())
    else if (request.method() !== "GET" || pathname !== "/api/v1/vehicles") return route.fallback()
    return route.fulfill({ json: { success: true, data: { types, vehicles } } })
  })
  await page.goto("/configuracoes?section=empresa")
  await expect(page.getByText("Cadastre os tipos e os veículos utilizados nos atendimentos.", { exact: true })).toBeVisible()
  const legacy = page.getByRole("row").filter({ hasText: "ABC1D23" })
  await expect(legacy.getByRole("cell", { name: "—", exact: true })).toHaveCount(3)
  await page.getByRole("button", { name: "Adicionar veículo", exact: true }).click()
  await page.getByRole("combobox", { name: "Selecione o tipo", exact: true }).click()
  await page.getByRole("option", { name: "Caminhão", exact: true }).click()
  await page.getByLabel("Placa *", { exact: true }).fill("XYZ1A23")
  await page.getByLabel("Modelo", { exact: true }).fill("Modelo de teste")
  await page.getByLabel("Cor", { exact: true }).fill("Branco")
  await page.getByLabel("Ano", { exact: true }).fill("2022")
  await page.getByRole("button", { name: "Salvar", exact: true }).click()
  const row = page.getByRole("row").filter({ hasText: "XYZ1A23" })
  await expect(row.getByRole("cell", { name: "Modelo de teste", exact: true })).toBeVisible()
  await expect(row.getByRole("cell", { name: "Branco", exact: true })).toBeVisible()
  await expect(row.getByRole("cell", { name: "2022", exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole("button", { name: "Ações de XYZ1A23", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  await expect(page.getByLabel("Modelo", { exact: true })).toHaveValue("Modelo de teste")
  await expect(page.getByLabel("Cor", { exact: true })).toHaveValue("Branco")
  await expect(page.getByLabel("Ano", { exact: true })).toHaveValue("2022")
  await page.getByLabel("Cor", { exact: true }).fill("Prata")
  await page.getByLabel("Ano", { exact: true }).fill("2024")
  await page.getByRole("button", { name: "Salvar", exact: true }).click()
  await expect(row.getByRole("cell", { name: "Prata", exact: true })).toBeVisible()
  await expect(row.getByRole("cell", { name: "2024", exact: true })).toBeVisible()
})
