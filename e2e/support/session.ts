import type { Page } from "@playwright/test"

export const E2E_USER = {
  id: "user-e2e-admin",
  name: "Administrador E2E",
  email: "e2e@depclean.test",
  isActive: true,
  permissionProfileId: "profile-e2e-admin",
  permissionProfileName: "Administrador",
  permissions: [
    "dashboard_view",
    "clients_view",
    "clients_create",
    "clients_edit",
    "clients_delete",
    "contracts_view",
    "contracts_create",
    "contracts_edit",
    "contracts_delete",
    "services_view",
    "services_manage",
    "teams_view",
    "teams_manage",
    "employees_view",
    "employees_create",
    "employees_edit",
    "employees_delete",
    "agenda_own_view",
    "agenda_view",
    "agenda_manage",
    "agenda_manage_status",
    "certificates_view",
    "certificates_manage",
    "reports_view",
    "reports_export",
    "financial_view",
    "financial_manage",
    "settings_view",
    "settings_manage",
    "templates_view",
    "templates_manage",
    "logs_view",
    "logs_manage",
    "depai_access",
  ],
  employeeId: "employee-e2e",
  employeeStatus: "active",
  phone: "51999999999",
  cpf: "00000000000",
  role: "Administrador",
  avatar: "",
  isSystemUser: true,
  mustChangePassword: false,
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-07-28T12:00:00.000Z",
}

export async function installAuthenticatedSession(page: Page) {
  await page.addInitScript((user) => {
    const encode = (value: unknown) =>
      window.btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
    const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    })}.e2e`

    window.localStorage.setItem("depclean.accessToken", token)
    window.localStorage.setItem("depclean.refreshToken", "e2e-refresh-token")
    window.localStorage.setItem("depclean.user", JSON.stringify(user))
    window.localStorage.setItem("depclean.expiresAt", String(Date.now() + 24 * 60 * 60 * 1000))
  }, E2E_USER)
}
