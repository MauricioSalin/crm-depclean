import type { AuthenticatedUser } from "@/lib/auth/types"

type PermissionUser = Pick<AuthenticatedUser, "permissions"> | null | undefined

const SETTINGS_MANAGE_PERMISSION = "settings_manage"
const REPORTS_PERMISSION_GROUP = ["reports_view", "reports_export", "financial_view", "financial_manage"]

const ALWAYS_ALLOWED_PATHS = [
  "/ajuda",
  "/logout",
  "/notificacoes",
  "/perfil",
]

type RoutePermissionRule = {
  pattern: RegExp
  permissions: string[]
}

const routePermissionRules: RoutePermissionRule[] = [
  { pattern: /^\/$/, permissions: ["dashboard_view"] },
  { pattern: /^\/clientes\/novo$/, permissions: ["clients_create"] },
  { pattern: /^\/clientes\/[^/]+\/editar$/, permissions: ["clients_edit"] },
  { pattern: /^\/clientes(?:\/[^/]+)?$/, permissions: ["clients_view", "clients_create", "clients_edit", "clients_delete"] },
  { pattern: /^\/servicos\/novo$/, permissions: ["services_manage"] },
  { pattern: /^\/servicos\/[^/]+\/editar$/, permissions: ["services_manage"] },
  { pattern: /^\/servicos$/, permissions: ["services_view", "services_manage"] },
  { pattern: /^\/agenda$/, permissions: ["agenda_own_view", "agenda_view", "agenda_manage"] },
  { pattern: /^\/agendamentos$/, permissions: ["agenda_own_view", "agenda_view", "agenda_manage"] },
  { pattern: /^\/contratos\/novo$/, permissions: ["contracts_create"] },
  { pattern: /^\/contratos\/[^/]+\/editar$/, permissions: ["contracts_edit"] },
  { pattern: /^\/contratos(?:\/[^/]+)?$/, permissions: ["contracts_view", "contracts_create", "contracts_edit", "contracts_delete"] },
  { pattern: /^\/equipes$/, permissions: ["teams_view", "teams_manage"] },
  { pattern: /^\/funcionarios$/, permissions: ["employees_view", "employees_create", "employees_edit", "employees_delete"] },
  { pattern: /^\/financeiro$/, permissions: REPORTS_PERMISSION_GROUP },
  { pattern: /^\/relatorios$/, permissions: REPORTS_PERMISSION_GROUP },
  { pattern: /^\/certificados(?:\/[^/]+)?$/, permissions: ["certificates_view", "certificates_manage"] },
  { pattern: /^\/configuracoes$/, permissions: ["settings_view", "settings_manage"] },
  { pattern: /^\/templates$/, permissions: ["templates_view", "templates_manage"] },
  { pattern: /^\/logs$/, permissions: ["logs_view", "logs_manage"] },
  { pattern: /^\/depai$/, permissions: ["depai_access"] },
]

const firstAllowedPathCandidates = [
  "/clientes",
  "/servicos",
  "/agenda",
  "/agendamentos",
  "/",
  "/contratos",
  "/equipes",
  "/funcionarios",
  "/certificados",
  "/relatorios",
  "/templates",
  "/configuracoes",
  "/logs",
  "/notificacoes",
  "/ajuda",
]

export function hasAnyPermission(user: PermissionUser, permissions: string[]) {
  if (permissions.length === 0) return true
  if (!user) return false

  const userPermissions = user.permissions ?? []
  return userPermissions.includes(SETTINGS_MANAGE_PERMISSION) || permissions.some((permission) => userPermissions.includes(permission))
}

export function canAccessPath(pathname: string, user: PermissionUser) {
  if (ALWAYS_ALLOWED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true
  }

  const rule = routePermissionRules.find((item) => item.pattern.test(pathname))
  if (!rule) return false
  return hasAnyPermission(user, rule.permissions)
}

export function getFirstAllowedPath(user: PermissionUser) {
  return firstAllowedPathCandidates.find((path) => canAccessPath(path, user)) ?? "/ajuda"
}
