"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Bell, Building, Copy, Edit, Eye, EyeOff, Mail, MessageCircle, MoreHorizontal, RefreshCcw, Save, Search, Shield, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataPagination } from "@/components/ui/data-pagination"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid } from "@/components/ui/table-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { MultiSelect } from "@/components/ui/multi-select"
import { Switch } from "@/components/ui/switch"
import { getApiErrorMessage } from "@/lib/api/errors"
import { cn, getInitials } from "@/lib/utils"
import { resolveAvatarUrl } from "@/lib/avatar"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { formatCNPJ, formatCPF, formatPhone, isValidCNPJ, isValidCPF } from "@/lib/masks"
import { listEmployees, type EmployeeRecord } from "@/lib/api/employees"
import {
  createClientType,
  createPermissionProfile,
  createUser,
  deleteClientType,
  deletePermissionProfile,
  deleteUser,
  getOrganizationSettings,
  getSettings,
  resetUserPassword,
  sendFirstAccessEmail,
  updateClientType,
  updateNotificationRule,
  updateOrganizationSettings,
  updatePermissionProfile,
  updateUser,
  type ClientTypeRecord,
  type NotificationRuleRecord,
  type OrganizationSettingsRecord,
  type PermissionProfileRecord,
  type UserRecord,
} from "@/lib/api/settings"
import { listTeams, type TeamRecord } from "@/lib/api/teams"
import { getStoredUser } from "@/lib/auth/session"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import {
  isEmployeeCoveredBySelectedTeams,
  normalizeTeamEmployeeSelection,
  removeEmployeesCoveredByTeams,
} from "@/lib/team-member-selection"

type SettingsSection = "empresa" | "tipos-cliente" | "permissoes" | "usuarios" | "notificações"
type ContractExpirationAlertDay = number | ""
export type SettingsCreateAction = "client-type" | "profile" | "user"

export const SETTINGS_CREATE_ACTION_EVENT = "depclean:settings-create-action"

const SETTINGS_CARDS = [
  { id: "empresa" as SettingsSection, label: "Empresa", icon: Building, description: "Configure os dados da Depclean nos documentos", adminOnly: true },
  { id: "tipos-cliente" as SettingsSection, label: "Tipos de Cliente", icon: Building, description: "Categorize seus clientes por tipo" },
  { id: "permissoes" as SettingsSection, label: "Perfis de Permissões", icon: Shield, description: "Configure níveis de acesso ao sistema" },
  { id: "usuarios" as SettingsSection, label: "Usuários do Sistema", icon: Users, description: "Gerencie usuários e seus acessos" },
  { id: "notificações" as SettingsSection, label: "Notificações", icon: Bell, description: "Defina quem recebe cada tipo de notificação" },
]

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_schedule: "Novo Agendamento",
  schedule_assigned: "Agendamento Atribuído",
  schedule_unassigned: "Remoção de Agendamento",
  schedule_change: "Alteração de Agendamento",
  schedule_cancel: "Cancelamento",
  emergency: "Emergência",
  daily_services: "Serviços do Dia",
  contract_signature: "Assinatura de Contrato",
  informative: "Informativo ao Cliente",
  certificate: "Certificado ao Cliente",
  certificate_ready: "Certificado Pronto para Emissão",
  payment_due: "Parcela Vencendo",
  payment_overdue: "Parcela Vencida",
  contract_expiring: "Contrato Vencendo",
}

const CHANNELS = [
  { value: "system", label: "Sistema", icon: Bell },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const

const DEFAULT_RULES_WITH_CONFIGURABLE_RECIPIENTS = new Set(["certificate_ready"])

const DEFAULT_COLOR = "#84CC16"
const DEFAULT_CONTRACT_SIGNER_ROLE: ClientTypeRecord["contractSignerRole"] = "owner"
const CONTRACT_SIGNER_ROLE_LABELS: Record<ClientTypeRecord["contractSignerRole"], string> = {
  owner: "Proprietário",
  assessor: "Assessor",
  syndic: "Síndico",
}
const DEFAULT_CONTRACT_EXPIRATION_ALERT_DAYS: ContractExpirationAlertDay[] = [60, 30]
const EMPTY_ORGANIZATION_ADDRESS = {
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
}

function normalizeOrganizationAddress(address?: OrganizationSettingsRecord["address"] | string | null) {
  if (typeof address === "string") {
    return { ...EMPTY_ORGANIZATION_ADDRESS, street: address }
  }

  return {
    street: address?.street ?? "",
    number: address?.number ?? "",
    complement: address?.complement ?? "",
    neighborhood: address?.neighborhood ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    zipCode: address?.zipCode ?? "",
  }
}

function generatePassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%"
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

type PermissionModule = {
  key: string
  title: string
  description: string
  permissionKeys?: string[]
}

const PERMISSION_MODULES: PermissionModule[] = [
  { key: "dashboard", title: "Dashboard", description: "Acesso aos indicadores e à visão geral da operação" },
  { key: "clients", title: "Clientes", description: "Acesso ao cadastro e à gestão de clientes" },
  { key: "contracts", title: "Contratos", description: "Acesso ao fluxo de contratos e aditivos" },
  { key: "employees", title: "Funcionários", description: "Acesso ao cadastro de funcionários" },
  { key: "teams", title: "Equipes", description: "Acesso ao gerenciamento de equipes" },
  { key: "services", title: "Serviços", description: "Acesso ao cadastro e edição de serviços" },
  { key: "agenda", title: "Agenda", description: "Acesso aos agendamentos e à operação diária" },
  {
    key: "reports",
    title: "Relatórios",
    description: "Acesso à consulta, exportação e financeiro dentro de relatórios",
    permissionKeys: ["financial_view", "financial_manage", "reports_view", "reports_export"],
  },
  { key: "certificates", title: "Certificados", description: "Acesso à emissão e envio de certificados" },
  { key: "settings", title: "Configurações", description: "Acesso à administração do sistema" },
  { key: "depai", title: "DepAI", description: "Acesso ao assistente de IA da plataforma" },
  { key: "templates", title: "Templates", description: "Acesso aos modelos de contratos" },
  { key: "logs", title: "Logs", description: "Acesso ao histórico de ações" },
]

function getPermissionModuleLabel(moduleKey: string) {
  return PERMISSION_MODULES.find((module) => module.key === moduleKey)?.title ?? moduleKey
}

function getPermissionModuleDescription(moduleKey: string) {
  return PERMISSION_MODULES.find((module) => module.key === moduleKey)?.description ?? ""
}

function formatRuleDaysBefore(days: number) {
  const value = Math.max(0, Math.trunc(Number(days) || 0))
  if (value === 0) return "no dia"
  return `${value} dia${value === 1 ? "" : "s"} antes`
}

function getNotificationRuleSummary(rule: NotificationRuleRecord) {
  switch (rule.type) {
    case "new_schedule":
      return "Disparo quando um agendamento for criado."
    case "schedule_assigned":
      return "Disparo quando uma equipe ou funcionário for atribuído."
    case "schedule_unassigned":
      return "Disparo quando uma equipe ou funcionário for removido."
    case "schedule_change":
      return "Disparo quando dados do agendamento forem alterados."
    case "schedule_cancel":
      return "Disparo quando um agendamento for cancelado."
    case "emergency":
      return "Disparo quando um agendamento for marcado como emergencial."
    case "schedule_confirmed":
      return "Disparo quando o agendamento do contrato for confirmado ao cliente."
    case "daily_services":
      return `Envio diário às ${rule.time}.`
    case "contract_signature":
      return "Disparo ao enviar o contrato para assinatura."
    case "contract_signed":
      return "Disparo após todas as assinaturas do contrato."
    case "informative":
      return "Antecedência configurada no template do informativo."
    case "certificate":
      return "Disparo após o envio do certificado final."
    case "certificate_ready":
      return "Disparo quando o atendimento concluído com NA estiver pronto para emissão."
    case "payment_due":
      return `Aviso de parcela: ${formatRuleDaysBefore(rule.daysBefore)}.`
    case "payment_overdue":
      return `Cobrança recorrente a cada ${rule.daysBefore || 7} dia${(rule.daysBefore || 7) === 1 ? "" : "s"}.`
    case "contract_expiring": {
      const days = (rule.contractExpirationAlertDays?.length ? rule.contractExpirationAlertDays : [rule.daysBefore])
        .map((day) => Number(day))
        .filter((day) => Number.isFinite(day))

      return days.length > 0
        ? `Alertas: ${days.map(formatRuleDaysBefore).join(" e ")}.`
        : "Alertas conforme vencimento do contrato."
    }
    default:
      return rule.daysBefore > 0 ? `Envio ${formatRuleDaysBefore(rule.daysBefore)}.` : "Disparo conforme o evento."
  }
}

export function ConfiguracoesContent() {
  const typeDialogResetTimeoutRef = useRef<number | null>(null)
  const profileDialogResetTimeoutRef = useRef<number | null>(null)
  const userDialogResetTimeoutRef = useRef<number | null>(null)
  const ruleDialogResetTimeoutRef = useRef<number | null>(null)
  const [activeSection, setActiveSection] = useUrlQueryState("section", "tipos-cliente")
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canManageSettings, setCanManageSettings] = useState(false)

  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettingsRecord | null>(null)
  const [organizationForm, setOrganizationForm] = useState({
    legalName: "",
    cnpj: "",
    address: { ...EMPTY_ORGANIZATION_ADDRESS },
    phone: "",
    email: "",
  })
  const [clientTypes, setClientTypes] = useState<ClientTypeRecord[]>([])
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfileRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [notificationRules, setNotificationRules] = useState<NotificationRuleRecord[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [permissionCatalog, setPermissionCatalog] = useState<Array<{ key: string; label: string; description: string }>>([])

  const [typeSearch, setTypeSearch] = useUrlQueryState("q-types")
  const [profileSearch, setProfileSearch] = useUrlQueryState("q-profiles")
  const [userSearch, setUserSearch] = useUrlQueryState("q-users")
  const [ruleSearch, setRuleSearch] = useUrlQueryState("q-rules")

  const [typePage, setTypePage] = useState(1)
  const [profilePage, setProfilePage] = useState(1)
  const [userPage, setUserPage] = useState(1)
  const [rulePage, setRulePage] = useState(1)

  const [typePageSize, setTypePageSize] = useState(10)
  const [profilePageSize, setProfilePageSize] = useState(10)
  const [userPageSize, setUserPageSize] = useState(10)
  const [rulePageSize, setRulePageSize] = useState(10)

  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ClientTypeRecord | null>(null)
  const [typeForm, setTypeForm] = useState({
    name: "",
    description: "",
    color: DEFAULT_COLOR,
    contractSignerRole: DEFAULT_CONTRACT_SIGNER_ROLE,
  })

  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<PermissionProfileRecord | null>(null)
  const [profileForm, setProfileForm] = useState({ name: "", description: "", permissions: [] as string[] })

  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false)
  const [temporaryPasswords, setTemporaryPasswords] = useState<Record<string, string>>({})
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    role: "",
    password: "",
    permissionProfileId: "",
    isActive: true,
    mustChangePassword: true,
  })

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRuleRecord | null>(null)
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    type: "new_schedule",
    daysBefore: 1,
    contractExpirationAlertDays: DEFAULT_CONTRACT_EXPIRATION_ALERT_DAYS,
    time: "08:00",
    channels: [] as string[],
    targetTeamIds: [] as string[],
    targetEmployeeIds: [] as string[],
    isActive: true,
  })
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "client-type"; id: string; label: string }
    | { kind: "profile"; id: string; label: string }
    | { kind: "user"; id: string; label: string }
    | { kind: "rule"; id: string; label: string }
    | null
  >(null)

  const refreshSettings = async () => {
    setLoading(true)
    try {
      const storedUser = getStoredUser()
      const adminUser = storedUser?.permissionProfileId === "profile-admin"
      const userPermissions = storedUser?.permissions ?? []
      const canManage = userPermissions.includes("settings_manage")
      const canReadTeams = canManage || userPermissions.includes("teams_view") || userPermissions.includes("teams_manage")
      const canReadEmployees =
        canManage ||
        userPermissions.includes("employees_view") ||
        userPermissions.includes("employees_create") ||
        userPermissions.includes("employees_edit") ||
        userPermissions.includes("employees_delete")
      setIsAdmin(adminUser)
      setCanManageSettings(canManage)
      const [settingsResponse, teamsResponse, employeesResponse] = await Promise.all([
        getSettings(),
        canReadTeams ? listTeams() : Promise.resolve({ data: [] }),
        canReadEmployees ? listEmployees() : Promise.resolve({ data: [] }),
      ])
      const organizationResponse = adminUser ? await getOrganizationSettings() : null
      const response = settingsResponse
      if (organizationResponse) {
        setOrganizationSettings(organizationResponse.data)
        setOrganizationForm({
          legalName: organizationResponse.data.legalName,
          cnpj: formatCNPJ(organizationResponse.data.cnpj),
          address: normalizeOrganizationAddress(organizationResponse.data.address),
          phone: formatPhone(organizationResponse.data.phone),
          email: organizationResponse.data.email,
        })
      }
      setClientTypes(response.data.clientTypes)
      setPermissionProfiles(response.data.permissionProfiles)
      setUsers(response.data.users)
      setTemporaryPasswords((current) => {
        const next = { ...current }
        response.data.users.forEach((user) => {
          if (user.temporaryPassword) {
            next[user.id] = user.temporaryPassword
          }
        })
        return next
      })
      setNotificationRules(response.data.notificationRules)
      setPermissionCatalog(response.data.permissions)
      setTeams(teamsResponse.data.filter((team) => team.isActive))
      setEmployees(employeesResponse.data.filter((employee) => employee.status === "active"))
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível carregar as configurações."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshSettings()
  }, [])

  useEffect(() => {
    return () => {
      ;[typeDialogResetTimeoutRef, profileDialogResetTimeoutRef, userDialogResetTimeoutRef, ruleDialogResetTimeoutRef].forEach((timeoutRef) => {
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current)
        }
      })
    }
  }, [])

  const filteredTypes = useMemo(() => clientTypes.filter((item) =>
    [item.name, item.description, item.color].join(" ").toLowerCase().includes(typeSearch.toLowerCase()),
  ), [clientTypes, typeSearch])

  const filteredProfiles = useMemo(() => permissionProfiles.filter((item) =>
    [item.name, item.description, item.permissions.join(" ")].join(" ").toLowerCase().includes(profileSearch.toLowerCase()),
  ), [permissionProfiles, profileSearch])

  const filteredUsers = useMemo(() => users.filter((item) =>
    [item.name, item.email, item.phone, item.cpf, item.role, item.permissionProfileName].join(" ").toLowerCase().includes(userSearch.toLowerCase()),
  ), [users, userSearch])

  const filteredRules = useMemo(() => notificationRules.filter((item) => {
    const teamNames = item.targetTeamIds.map((teamId) => teams.find((team) => team.id === teamId)?.name ?? teamId).join(" ")
    const employeeNames = item.targetEmployeeIds.map((employeeId) => employees.find((employee) => employee.id === employeeId)?.name ?? employeeId).join(" ")

    return [
      item.name,
      item.description,
      item.type,
      item.channels.join(" "),
      item.targetTeamIds.join(" "),
      item.targetEmployeeIds.join(" "),
      teamNames,
      employeeNames,
    ].join(" ").toLowerCase().includes(ruleSearch.toLowerCase())
  }), [notificationRules, ruleSearch, teams, employees])

  const teamOptions = useMemo(() => teams.map((team) => ({
    id: team.id,
    name: team.name,
    subtitle: team.description,
    color: team.color,
  })), [teams])

  const employeeOptions = useMemo(() => employees
    .filter((employee) => !isEmployeeCoveredBySelectedTeams(employee.id, ruleForm.targetTeamIds, teams))
    .map((employee) => ({
    id: employee.id,
    name: employee.name,
    subtitle: `${employee.role || "Sem cargo"} • ${formatPhone(employee.phone)}`,
  })), [employees, ruleForm.targetTeamIds, teams])

  const settingsCards = useMemo(
    () => SETTINGS_CARDS.filter((card) => !card.adminOnly || isAdmin),
    [isAdmin],
  )

  useEffect(() => {
    if (!isAdmin && activeSection === "empresa") {
      setActiveSection("tipos-cliente")
    }
  }, [activeSection, isAdmin, setActiveSection])

  const paginatedTypes = useMemo(() => filteredTypes.slice((typePage - 1) * typePageSize, typePage * typePageSize), [filteredTypes, typePage, typePageSize])
  const paginatedProfiles = useMemo(() => filteredProfiles.slice((profilePage - 1) * profilePageSize, profilePage * profilePageSize), [filteredProfiles, profilePage, profilePageSize])
  const paginatedUsers = useMemo(() => filteredUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize), [filteredUsers, userPage, userPageSize])
  const paginatedRules = useMemo(() => filteredRules.slice((rulePage - 1) * rulePageSize, rulePage * rulePageSize), [filteredRules, rulePage, rulePageSize])

  const clearDialogResetTimeout = (timeoutRef: { current: number | null }) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const resetTypeFormFields = () => {
    setEditingType(null)
    setTypeForm({ name: "", description: "", color: DEFAULT_COLOR, contractSignerRole: DEFAULT_CONTRACT_SIGNER_ROLE })
  }

  const closeTypeDialog = () => {
    setIsTypeDialogOpen(false)
    clearDialogResetTimeout(typeDialogResetTimeoutRef)
    typeDialogResetTimeoutRef.current = window.setTimeout(() => {
      resetTypeFormFields()
      typeDialogResetTimeoutRef.current = null
    }, 200)
  }

  const resetProfileFormFields = () => {
    setEditingProfile(null)
    setProfileForm({ name: "", description: "", permissions: [] })
  }

  const closeProfileDialog = () => {
    setIsProfileDialogOpen(false)
    clearDialogResetTimeout(profileDialogResetTimeoutRef)
    profileDialogResetTimeoutRef.current = window.setTimeout(() => {
      resetProfileFormFields()
      profileDialogResetTimeoutRef.current = null
    }, 200)
  }

  const resetUserFormFields = () => {
    setEditingUser(null)
    setUserForm({ name: "", email: "", phone: "", cpf: "", role: "", password: "", permissionProfileId: "", isActive: true, mustChangePassword: true })
    setShowTemporaryPassword(false)
  }

  const closeUserDialog = () => {
    setIsUserDialogOpen(false)
    clearDialogResetTimeout(userDialogResetTimeoutRef)
    userDialogResetTimeoutRef.current = window.setTimeout(() => {
      resetUserFormFields()
      userDialogResetTimeoutRef.current = null
    }, 200)
  }

  const resetRuleForm = () => {
    setEditingRule(null)
    setRuleForm({ name: "", description: "", type: "new_schedule", daysBefore: 1, contractExpirationAlertDays: DEFAULT_CONTRACT_EXPIRATION_ALERT_DAYS, time: "08:00", channels: [], targetTeamIds: [], targetEmployeeIds: [], isActive: true })
  }

  const closeRuleDialog = () => {
    setIsRuleDialogOpen(false)
    clearDialogResetTimeout(ruleDialogResetTimeoutRef)
    ruleDialogResetTimeoutRef.current = window.setTimeout(() => {
      resetRuleForm()
      ruleDialogResetTimeoutRef.current = null
    }, 200)
  }

  const openTypeDialog = (record?: ClientTypeRecord) => {
    if (!canManageSettings) return
    clearDialogResetTimeout(typeDialogResetTimeoutRef)
    if (record) {
      setEditingType(record)
      setTypeForm({
        name: record.name,
        description: record.description,
        color: record.color,
        contractSignerRole: record.contractSignerRole ?? DEFAULT_CONTRACT_SIGNER_ROLE,
      })
    } else {
      resetTypeFormFields()
    }
    setIsTypeDialogOpen(true)
  }

  const openProfileDialog = (record?: PermissionProfileRecord) => {
    if (!canManageSettings) return
    clearDialogResetTimeout(profileDialogResetTimeoutRef)
    if (record) {
      setEditingProfile(record)
      setProfileForm({ name: record.name, description: record.description, permissions: [...record.permissions] })
    } else {
      resetProfileFormFields()
    }
    setIsProfileDialogOpen(true)
  }

  const openUserDialog = (record?: UserRecord) => {
    if (!canManageSettings) return
    clearDialogResetTimeout(userDialogResetTimeoutRef)
    if (record) {
      setEditingUser(record)
      setUserForm({
        name: record.name,
        email: record.email,
        phone: record.phone,
        cpf: formatCPF(record.cpf),
        role: record.role,
        password: "",
        permissionProfileId: record.permissionProfileId,
        isActive: record.isActive,
        mustChangePassword: record.mustChangePassword,
      })
      setShowTemporaryPassword(false)
    } else {
      resetUserFormFields()
    }
    setIsUserDialogOpen(true)
  }

  const openRuleDialog = (record?: NotificationRuleRecord) => {
    if (!canManageSettings) return
    clearDialogResetTimeout(ruleDialogResetTimeoutRef)
    if (record) {
      const selection = normalizeTeamEmployeeSelection({
        teamIds: [...record.targetTeamIds],
        employeeIds: [...record.targetEmployeeIds],
        teams,
      })
      setEditingRule(record)
      setRuleForm({
        name: record.name,
        description: record.description ?? "",
        type: record.type,
        daysBefore: record.daysBefore,
        contractExpirationAlertDays: record.contractExpirationAlertDays?.length ? record.contractExpirationAlertDays : [record.daysBefore, ""],
        time: record.time,
        channels: [...record.channels],
        targetTeamIds: selection.teamIds,
        targetEmployeeIds: selection.employeeIds,
        isActive: record.isActive,
      })
    } else {
      resetRuleForm()
    }
    setIsRuleDialogOpen(true)
  }

  useEffect(() => {
    const handleCreateAction = (event: Event) => {
      if (!canManageSettings) return

      const action = (event as CustomEvent<{ action?: SettingsCreateAction }>).detail?.action

      if (action === "client-type") {
        openTypeDialog()
        return
      }

      if (action === "profile") {
        openProfileDialog()
        return
      }

      if (action === "user") {
        openUserDialog()
      }
    }

    window.addEventListener(SETTINGS_CREATE_ACTION_EVENT, handleCreateAction)
    return () => window.removeEventListener(SETTINGS_CREATE_ACTION_EVENT, handleCreateAction)
  }, [canManageSettings, openProfileDialog, openTypeDialog, openUserDialog])

  const handleOrganizationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageSettings) return
    if (saving) return
    if (!isValidCNPJ(organizationForm.cnpj)) {
      toast.error("Informe um CNPJ válido para a empresa.")
      return
    }
    setSaving(true)
    const toastId = toast.loading("Salvando dados da empresa...")
    try {
      const response = await updateOrganizationSettings(organizationForm)
      setOrganizationSettings(response.data)
      setOrganizationForm({
        legalName: response.data.legalName,
        cnpj: formatCNPJ(response.data.cnpj),
        address: normalizeOrganizationAddress(response.data.address),
        phone: formatPhone(response.data.phone),
        email: response.data.email,
      })
      toast.success("Dados da empresa atualizados.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar os dados da empresa."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleTypeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageSettings) return
    if (saving) return
    setSaving(true)
    const toastId = toast.loading(editingType ? "Salvando tipo de cliente..." : "Criando tipo de cliente...")
    try {
      if (editingType) {
        const response = await updateClientType(editingType.id, typeForm)
        upsertClientType(response.data)
        toast.success("Tipo de cliente atualizado.", { id: toastId })
      } else {
        const response = await createClientType(typeForm)
        upsertClientType(response.data)
        toast.success("Tipo de cliente criado.", { id: toastId })
      }
      closeTypeDialog()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o tipo de cliente."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageSettings) return
    if (saving) return
    setSaving(true)
    const toastId = toast.loading(editingProfile ? "Salvando perfil..." : "Criando perfil...")
    try {
      const payload = { ...profileForm, permissions: profileForm.permissions }
      if (editingProfile) {
        const response = await updatePermissionProfile(editingProfile.id, payload)
        upsertPermissionProfile(response.data)
        toast.success("Perfil atualizado.", { id: toastId })
      } else {
        const response = await createPermissionProfile(payload)
        upsertPermissionProfile(response.data)
        toast.success("Perfil criado.", { id: toastId })
      }
      closeProfileDialog()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o perfil."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleUserSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageSettings) return
    if (saving) return
    if (!isValidCPF(userForm.cpf)) {
      toast.error("Informe um CPF válido para o usuário.")
      return
    }
    if (!userForm.permissionProfileId) {
      toast.error("Selecione um perfil de permissão.")
      return
    }
    const normalizedPassword = userForm.password.trim()
    const currentTemporaryPassword = editingUser?.mustChangePassword
      ? editingUser.temporaryPassword ?? temporaryPasswords[editingUser.id] ?? ""
      : ""
    const shouldSubmitPassword = Boolean(normalizedPassword) && (
      !editingUser ||
      !editingUser.mustChangePassword ||
      normalizedPassword !== currentTemporaryPassword
    )

    if (!editingUser && !normalizedPassword) {
      toast.error("Informe uma senha ou gere uma nova senha.")
      return
    }

    setSaving(true)
    const toastId = toast.loading(editingUser ? "Salvando usuário..." : "Criando usuário...")
    try {
      if (editingUser) {
        const response = await updateUser(editingUser.id, {
          name: userForm.name,
          email: userForm.email.trim() || undefined,
          phone: userForm.phone,
          cpf: userForm.cpf,
          role: userForm.role,
          permissionProfileId: userForm.permissionProfileId,
          isActive: userForm.isActive,
          ...(shouldSubmitPassword ? { password: normalizedPassword } : {}),
        })
        upsertUser(response.data)
        if (response.data.temporaryPassword) {
          setTemporaryPasswords((current) => ({
            ...current,
            [response.data.id]: response.data.temporaryPassword ?? "",
          }))
        }
        toast.success("Usuário atualizado.", { id: toastId })
      } else {
        const response = await createUser({
          name: userForm.name,
          email: userForm.email,
          phone: userForm.phone,
          cpf: userForm.cpf,
          role: userForm.role,
          password: normalizedPassword,
          permissionProfileId: userForm.permissionProfileId,
          isActive: userForm.isActive,
        })
        upsertUser(response.data)
        if (response.data.temporaryPassword) {
          setTemporaryPasswords((current) => ({
            ...current,
            [response.data.id]: response.data.temporaryPassword ?? "",
          }))
        }
        toast.success("Usuário criado.", { id: toastId })
      }
      closeUserDialog()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o usuário."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleRuleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageSettings) return
    if (saving) return
    if (!editingRule) {
      toast.error("Apenas notificações padrão podem ser editadas.")
      return
    }
    setSaving(true)
    const toastId = toast.loading("Salvando regra de notificação...")
    try {
      const contractExpirationAlertDays = ruleForm.contractExpirationAlertDays
        .filter((value) => value !== "")
        .map((value) => Math.max(0, Math.trunc(Number(value))))
        .slice(0, 2)
      const canConfigureRecipients = !editingRule.isDefault || DEFAULT_RULES_WITH_CONFIGURABLE_RECIPIENTS.has(editingRule.type)
      const recipientSelection = normalizeTeamEmployeeSelection({
        teamIds: ruleForm.targetTeamIds,
        employeeIds: ruleForm.targetEmployeeIds,
        teams,
      })

      const payload = editingRule?.isDefault
        ? {
          description: ruleForm.description,
          daysBefore: ruleForm.daysBefore,
          contractExpirationAlertDays: ruleForm.type === "contract_expiring" ? contractExpirationAlertDays : undefined,
          time: ruleForm.time,
          channels: ruleForm.channels,
          ...(canConfigureRecipients
            ? {
              targetTeamIds: recipientSelection.teamIds,
              targetEmployeeIds: recipientSelection.employeeIds,
            }
            : {}),
          isActive: ruleForm.isActive,
        }
        : {
          name: ruleForm.name,
          description: ruleForm.description,
          type: ruleForm.type,
          daysBefore: ruleForm.daysBefore,
          contractExpirationAlertDays: ruleForm.type === "contract_expiring" ? contractExpirationAlertDays : undefined,
          time: ruleForm.time,
          channels: ruleForm.channels,
          targetTeamIds: recipientSelection.teamIds,
          targetEmployeeIds: recipientSelection.employeeIds,
          isActive: ruleForm.isActive,
        }
      const response = await updateNotificationRule(editingRule.id, payload)
      upsertNotificationRule(response.data)
      toast.success("Regra atualizada.", { id: toastId })
      closeRuleDialog()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar a regra."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteType = async (id: string) => {
    if (!canManageSettings) return
    if (saving) return
    setSaving(true)
    const toastId = toast.loading("Removendo tipo de cliente...")
    try {
      await deleteClientType(id)
      setClientTypes((current) => current.filter((item) => item.id !== id))
      toast.success("Tipo de cliente removido.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir o tipo."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProfile = async (id: string) => {
    if (!canManageSettings) return
    if (saving) return
    setSaving(true)
    const toastId = toast.loading("Removendo perfil...")
    try {
      await deletePermissionProfile(id)
      setPermissionProfiles((current) => current.filter((item) => item.id !== id))
      toast.success("Perfil removido.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir o perfil."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!canManageSettings) return
    if (saving) return
    setSaving(true)
    const toastId = toast.loading("Removendo usuário...")
    try {
      await deleteUser(id)
      setUsers((current) => current.filter((item) => item.id !== id))
      toast.success("Usuário removido.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir o usuário."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    if (!canManageSettings) return
    if (saving) return
    setSaving(true)
    try {
      void id
      toast.error("Regras personalizadas não estão disponíveis.")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir a regra."))
    } finally {
      setSaving(false)
    }
  }

  const togglePermission = (key: string) => {
    setProfileForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((permission) => permission !== key)
        : [...current.permissions, key],
    }))
  }

  const toggleChannel = (key: string) => {
    setRuleForm((current) => ({
      ...current,
      channels: current.channels.includes(key)
        ? current.channels.filter((item) => item !== key)
        : [...current.channels, key],
    }))
  }

  const generateUserPassword = () => {
    setUserForm((current) => ({ ...current, password: generatePassword(), mustChangePassword: true }))
    setShowTemporaryPassword(true)
  }

  const copyUserPassword = async () => {
    if (!userForm.password) return
    await navigator.clipboard.writeText(userForm.password)
    toast.success("Senha copiada.")
  }

  const handleResetUserPassword = async () => {
    if (!editingUser) return
    if (saving) return

    setSaving(true)
    const toastId = toast.loading("Redefinindo senha...")
    try {
      const response = await resetUserPassword(editingUser.id)
      upsertUser(response.data)
      setEditingUser(response.data)
      if (response.data.temporaryPassword) {
        setTemporaryPasswords((current) => ({
          ...current,
          [response.data.id]: response.data.temporaryPassword ?? "",
        }))
      }
      setUserForm((current) => ({
        ...current,
        password: response.data.temporaryPassword ?? "",
        mustChangePassword: true,
      }))
      setShowTemporaryPassword(false)
      toast.success(response.message || "Senha redefinida e enviada.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível redefinir a senha."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleSendFirstAccessEmail = async () => {
    if (!editingUser) return
    if (saving) return

    setSaving(true)
    const toastId = toast.loading("Enviando acesso...")
    try {
      const response = await sendFirstAccessEmail(editingUser.id)
      upsertUser(response.data)
      setEditingUser(response.data)
      if (response.data.temporaryPassword) {
        setTemporaryPasswords((current) => ({
          ...current,
          [response.data.id]: response.data.temporaryPassword ?? "",
        }))
      }
      setUserForm((current) => ({
        ...current,
        password: response.data.temporaryPassword ?? current.password,
        mustChangePassword: true,
      }))
      setShowTemporaryPassword(false)
      toast.success(response.message || "Acesso enviado.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível enviar o e-mail de acesso."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const upsertClientType = (record: ClientTypeRecord) => {
    setClientTypes((current) => current.some((item) => item.id === record.id)
      ? current.map((item) => (item.id === record.id ? record : item))
      : [...current, record])
  }

  const upsertPermissionProfile = (record: PermissionProfileRecord) => {
    setPermissionProfiles((current) => current.some((item) => item.id === record.id)
      ? current.map((item) => (item.id === record.id ? record : item))
      : [...current, record])
  }

  const upsertUser = (record: UserRecord) => {
    setUsers((current) => current.some((item) => item.id === record.id)
      ? current.map((item) => (item.id === record.id ? record : item))
      : [...current, record])
  }

  const upsertNotificationRule = (record: NotificationRuleRecord) => {
    setNotificationRules((current) => current.some((item) => item.id === record.id)
      ? current.map((item) => (item.id === record.id ? record : item))
      : [...current, record])
  }

  const shouldShowPasswordFields = !editingUser || userForm.mustChangePassword

  const getModulePermissions = useCallback((module: PermissionModule) => {
    if (module.permissionKeys) {
      return permissionCatalog.filter((permission) => module.permissionKeys?.includes(permission.key))
    }

    return permissionCatalog.filter((permission) => permission.key.startsWith(`${module.key}_`))
  }, [permissionCatalog])

  const groupedPermissions = useMemo(() => {
    return PERMISSION_MODULES.map((module) => ({
      ...module,
      permissions: getModulePermissions(module),
    }))
  }, [getModulePermissions])

  const getModuleSelectionState = (moduleKey: string) => {
    const module = PERMISSION_MODULES.find((item) => item.key === moduleKey)
    const modulePermissions = module ? getModulePermissions(module) : []
    const selectedCount = modulePermissions.filter((permission) => profileForm.permissions.includes(permission.key)).length
    const allSelected = modulePermissions.length > 0 && selectedCount === modulePermissions.length
    const partialSelected = selectedCount > 0 && !allSelected
    return { allSelected, partialSelected, modulePermissions }
  }

  const toggleModulePermissions = (moduleKey: string) => {
    const { allSelected, modulePermissions } = getModuleSelectionState(moduleKey)
    const moduleKeys = modulePermissions.map((permission) => permission.key)
    setProfileForm((current) => ({
      ...current,
      permissions: allSelected
        ? current.permissions.filter((permission) => !moduleKeys.includes(permission))
        : Array.from(new Set([...current.permissions, ...moduleKeys])),
    }))
  }

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)

    if (target.kind === "client-type") {
      await handleDeleteType(target.id)
      return
    }

    if (target.kind === "profile") {
      await handleDeleteProfile(target.id)
      return
    }

    if (target.kind === "user") {
      await handleDeleteUser(target.id)
      return
    }

    await handleDeleteRule(target.id)
  }

  const renderActiveSectionFilters = (className: string) => {
    if (activeSection === "tipos-cliente") {
      return (
        <div className={className}>
          <div className="relative w-full focus-within:z-[70] sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar tipos..." value={typeSearch} onChange={(event) => { setTypeSearch(event.target.value); setTypePage(1) }} className="pl-10" />
          </div>
        </div>
      )
    }

    if (activeSection === "permissoes") {
      return (
        <div className={className}>
          <div className="relative w-full focus-within:z-[70] sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar perfis..." value={profileSearch} onChange={(event) => { setProfileSearch(event.target.value); setProfilePage(1) }} className="pl-10" />
          </div>
        </div>
      )
    }

    if (activeSection === "usuarios") {
      return (
        <div className={className}>
          <div className="relative w-full focus-within:z-[70] sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar usuários..." value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setUserPage(1) }} className="pl-10" />
          </div>
        </div>
      )
    }

    if (activeSection === "notificações") {
      return (
        <div className={className}>
          <div className="relative w-full focus-within:z-[70] sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar regras..." value={ruleSearch} onChange={(event) => { setRuleSearch(event.target.value); setRulePage(1) }} className="pl-10" />
          </div>
        </div>
      )
    }

    return null
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <CardSkeletonGrid cards={5} />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeletonGrid cards={4} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {renderActiveSectionFilters(`${mobileFiltersOpen ? "flex" : "hidden"} -m-1 flex-col gap-3 overflow-visible p-1 sm:hidden`)}

      <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden">
        {settingsCards.map((card) => (
          <button
            key={card.id}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors",
              activeSection === card.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
            onClick={() => setActiveSection(card.id)}
          >
            <card.icon className="h-4 w-4" />
            {card.label}
          </button>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-5">
        {settingsCards.map((card) => (
          <Card
            key={card.id}
            className={cn("min-h-[132px] cursor-pointer gap-2 py-4 transition-all hover:shadow-md", activeSection === card.id && "ring-2 ring-primary bg-primary/5")}
            onClick={() => setActiveSection(card.id)}
          >
            <CardHeader className="px-4 pb-1">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2", activeSection === card.id ? "bg-primary/20" : "bg-primary/10")}>
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">{card.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4">
              <p className="text-xs leading-relaxed text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeSection === "empresa" && isAdmin && canManageSettings && (
        <form autoComplete="off" onSubmit={handleOrganizationSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Dados da empresa</CardTitle>
                  <CardDescription>
                    Configure os dados da Depclean usados nos contratos e documentos.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="organization-legal-name">Razão social</Label>
                  <Input
                    id="organization-legal-name"
                    value={organizationForm.legalName}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, legalName: event.target.value }))}
                    placeholder="Razão social da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-cnpj">CNPJ *</Label>
                  <Input
                    id="organization-cnpj"
                    value={organizationForm.cnpj}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, cnpj: formatCNPJ(event.target.value) }))}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    maxLength={18}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="organization-street">Rua</Label>
                  <Input
                    id="organization-street"
                    value={organizationForm.address.street}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, address: { ...current.address, street: event.target.value } }))}
                    placeholder="Rua"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-number">Número</Label>
                  <Input
                    id="organization-number"
                    value={organizationForm.address.number}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, address: { ...current.address, number: event.target.value } }))}
                    placeholder="Número"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-complement">Complemento</Label>
                  <Input
                    id="organization-complement"
                    value={organizationForm.address.complement}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, address: { ...current.address, complement: event.target.value } }))}
                    placeholder="Sala, andar, bloco..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-neighborhood">Bairro</Label>
                  <Input
                    id="organization-neighborhood"
                    value={organizationForm.address.neighborhood}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, address: { ...current.address, neighborhood: event.target.value } }))}
                    placeholder="Bairro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-city">Cidade</Label>
                  <Input
                    id="organization-city"
                    value={organizationForm.address.city}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, address: { ...current.address, city: event.target.value } }))}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-state">UF</Label>
                  <Input
                    id="organization-state"
                    value={organizationForm.address.state}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, address: { ...current.address, state: event.target.value.toUpperCase().slice(0, 2) } }))}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-zip-code">CEP</Label>
                  <Input
                    id="organization-zip-code"
                    value={organizationForm.address.zipCode}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, address: { ...current.address, zipCode: event.target.value } }))}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-phone">Telefone</Label>
                  <Input
                    id="organization-phone"
                    value={organizationForm.phone}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, phone: formatPhone(event.target.value) }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-email">E-mail</Label>
                  <Input
                    id="organization-email"
                    type="email"
                    value={organizationForm.email}
                    onChange={(event) => setOrganizationForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="contato@empresa.com.br"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {activeSection === "tipos-cliente" && (
        <div className="space-y-4">
          <div className="hidden -m-1 flex-col gap-3 overflow-visible p-1 sm:flex sm:flex-row sm:items-center">
            <div className="relative w-full focus-within:z-[70] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar tipos..." value={typeSearch} onChange={(event) => { setTypeSearch(event.target.value); setTypePage(1) }} className="pl-10" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cor</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Assina contrato</TableHead>
                  {canManageSettings ? <TableHead className="text-right">Ações</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTypes.length === 0 ? (
                  <TableEmptyState colSpan={canManageSettings ? 5 : 4} icon={Building} title="Nenhum tipo encontrado." />
                ) : (
                  paginatedTypes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><span className="inline-flex h-5 w-5 rounded-full" style={{ backgroundColor: item.color }} /></TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.description || "Sem descrição"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {CONTRACT_SIGNER_ROLE_LABELS[item.contractSignerRole ?? DEFAULT_CONTRACT_SIGNER_ROLE]}
                        </Badge>
                      </TableCell>
                      {canManageSettings ? (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Ações do tipo de cliente">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => openTypeDialog(item)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setPendingDelete({ kind: "client-type", id: item.id, label: item.name })}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={typePage}
            totalPages={Math.max(1, Math.ceil(filteredTypes.length / typePageSize))}
            pageSize={typePageSize}
            totalItems={filteredTypes.length}
            onPageChange={setTypePage}
            onPageSizeChange={(size) => { setTypePageSize(size); setTypePage(1) }}
          />

          <Dialog open={isTypeDialogOpen} onOpenChange={(open) => (open ? setIsTypeDialogOpen(true) : closeTypeDialog())}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingType ? "Editar Tipo de Cliente" : "Novo Tipo de Cliente"}</DialogTitle>
              </DialogHeader>
              <form autoComplete="off" onSubmit={handleTypeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type-name">Nome</Label>
                  <Input id="type-name" value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-description">Descrição</Label>
                  <Textarea id="type-description" value={typeForm.description} onChange={(event) => setTypeForm({ ...typeForm, description: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-color">Cor</Label>
                  <Input id="type-color" type="color" value={typeForm.color} onChange={(event) => setTypeForm({ ...typeForm, color: event.target.value })} className="h-11 w-24 p-1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-contract-signer">Quem assina o contrato</Label>
                  <Select
                    value={typeForm.contractSignerRole}
                    onValueChange={(value) => setTypeForm({
                      ...typeForm,
                      contractSignerRole: value as ClientTypeRecord["contractSignerRole"],
                    })}
                  >
                    <SelectTrigger id="type-contract-signer" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Proprietário</SelectItem>
                      <SelectItem value="assessor">Assessor</SelectItem>
                      <SelectItem value="syndic">Síndico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeTypeDialog}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{editingType ? "Salvar" : "Criar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeSection === "permissoes" && (
        <div className="space-y-4">
          <div className="hidden -m-1 flex-col gap-3 overflow-visible p-1 sm:flex sm:flex-row sm:items-center">
            <div className="relative w-full focus-within:z-[70] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar perfis..." value={profileSearch} onChange={(event) => { setProfileSearch(event.target.value); setProfilePage(1) }} className="pl-10" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Permissões</TableHead>
                  {canManageSettings ? <TableHead className="text-right">Ações</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProfiles.length === 0 ? (
                  <TableEmptyState colSpan={canManageSettings ? 4 : 3} icon={Shield} title="Nenhum perfil encontrado." />
                ) : (
                  paginatedProfiles.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.description || "Sem descrição"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">{item.permissions.length} permissões</Badge>
                          {item.id === "profile-admin" && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Padrão</Badge>}
                        </div>
                      </TableCell>
                      {canManageSettings ? (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Ações do perfil">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => openProfileDialog(item)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              disabled={item.id === "profile-admin"}
                              onClick={() => setPendingDelete({ kind: "profile", id: item.id, label: item.name })}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={profilePage}
            totalPages={Math.max(1, Math.ceil(filteredProfiles.length / profilePageSize))}
            pageSize={profilePageSize}
            totalItems={filteredProfiles.length}
            onPageChange={setProfilePage}
            onPageSizeChange={(size) => { setProfilePageSize(size); setProfilePage(1) }}
          />

          <Dialog open={isProfileDialogOpen} onOpenChange={(open) => (open ? setIsProfileDialogOpen(true) : closeProfileDialog())}>
            <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
              <DialogHeader className="px-6 pb-4 pt-6">
                <DialogTitle>{editingProfile ? "Editar Permissão" : "Nova Permissão"}</DialogTitle>
              </DialogHeader>
              <form autoComplete="off" onSubmit={handleProfileSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Nome</Label>
                      <Input id="profile-name" value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-description">Descrição</Label>
                      <Textarea id="profile-description" value={profileForm.description} onChange={(event) => setProfileForm({ ...profileForm, description: event.target.value })} />
                    </div>
                    <div className="space-y-3">
                      <Label>Permissões</Label>
                      <Accordion type="multiple" className="rounded-xl border">
                        {groupedPermissions.map((module) => {
                          if (module.permissions.length === 0) return null

                          const moduleState = getModuleSelectionState(module.key)

                          return (
                            <AccordionItem key={module.key} value={module.key} className="px-4">
                              <div className="flex items-center gap-3 py-4">
                                <Checkbox
                                  className="cursor-pointer"
                                  checked={moduleState.allSelected ? true : moduleState.partialSelected ? "indeterminate" : false}
                                  onCheckedChange={() => toggleModulePermissions(module.key)}
                                />
                                <AccordionTrigger
                                  headerClassName="min-w-0 flex-1"
                                  className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_3rem_1rem] items-center gap-3 py-0 no-underline hover:no-underline [&>svg]:col-start-3 [&>svg]:self-center [&>svg]:justify-self-center [&>svg]:translate-y-0"
                                >
                                  <div className="min-w-0 space-y-1 text-left">
                                    <div className="truncate font-medium">{module.title}</div>
                                    <div className="truncate text-xs text-muted-foreground">{module.description}</div>
                                  </div>
                                  <Badge variant="secondary" className="w-10 justify-center justify-self-center self-center px-0">
                                    {moduleState.modulePermissions.filter((permission) => profileForm.permissions.includes(permission.key)).length}/{moduleState.modulePermissions.length}
                                  </Badge>
                                </AccordionTrigger>
                              </div>
                              <AccordionContent>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  {module.permissions.map((permission) => (
                                    <label key={permission.key} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3">
                                      <Checkbox
                                        className="cursor-pointer"
                                        checked={profileForm.permissions.includes(permission.key)}
                                        onCheckedChange={() => togglePermission(permission.key)}
                                      />
                                      <div>
                                        <div className="font-medium">{permission.label}</div>
                                        <div className="text-xs text-muted-foreground">{permission.description}</div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    </div>
                  </div>
                </div>
                <DialogFooter className="px-6 pb-6 pt-3">
                  <Button type="button" variant="outline" onClick={closeProfileDialog}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{editingProfile ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeSection === "usuarios" && (
        <div className="space-y-4">
          <div className="hidden -m-1 flex-col gap-3 overflow-visible p-1 sm:flex sm:flex-row sm:items-center">
            <div className="relative w-full focus-within:z-[70] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar usuários..." value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setUserPage(1) }} className="pl-10" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageSettings ? <TableHead className="text-right">Ações</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableEmptyState colSpan={canManageSettings ? 6 : 5} icon={Users} title="Nenhum usuário encontrado." />
                ) : (
                  paginatedUsers.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0 ring-2 ring-primary/10">
                            <AvatarImage src={resolveAvatarUrl(item.avatar)} alt={item.name} />
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {getInitials(item.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{item.name}</span>
                              {item.mustChangePassword && <Badge variant="outline">Primeiro acesso</Badge>}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell className="font-mono text-sm">{item.cpf ? formatCPF(item.cpf) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.permissionProfileName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={item.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}>
                          {item.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      {canManageSettings ? (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Ações do usuário">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => openUserDialog(item)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setPendingDelete({ kind: "user", id: item.id, label: item.name })}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            currentPage={userPage}
            totalPages={Math.max(1, Math.ceil(filteredUsers.length / userPageSize))}
            pageSize={userPageSize}
            totalItems={filteredUsers.length}
            onPageChange={setUserPage}
            onPageSizeChange={(size) => { setUserPageSize(size); setUserPage(1) }}
          />

          <Dialog open={isUserDialogOpen} onOpenChange={(open) => (open ? setIsUserDialogOpen(true) : closeUserDialog())}>
            <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
              <DialogHeader className="px-6 pb-4 pt-6">
                <DialogTitle>{editingUser ? "Editar Usuário do Sistema" : "Novo Usuário do Sistema"}</DialogTitle>
              </DialogHeader>
              <form autoComplete="off" onSubmit={handleUserSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                  <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user-name">Nome</Label>
                  <Input id="user-name" placeholder="Nome completo" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">E-mail</Label>
                  <Input id="user-email" type="email" autoComplete="off" placeholder="email@empresa.com" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-phone">Telefone *</Label>
                  <Input
                    id="user-phone"
                    value={userForm.phone}
                    onChange={(event) => setUserForm({ ...userForm, phone: formatPhone(event.target.value) })}
                    placeholder="(51) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-cpf">CPF *</Label>
                  <Input
                    id="user-cpf"
                    value={userForm.cpf}
                    onChange={(event) => setUserForm({ ...userForm, cpf: formatCPF(event.target.value) })}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-role">Cargo</Label>
                  <Input
                    id="user-role"
                    value={userForm.role}
                    onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
                    placeholder="Ex: Gerente, Operador, Administrativo"
                  />
                </div>
                {shouldShowPasswordFields && (
                  <div className="space-y-2">
                    <Label htmlFor="user-password">{userForm.mustChangePassword ? "Senha temporária" : "Senha *"}</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="user-password"
                          type={userForm.mustChangePassword && !showTemporaryPassword ? "password" : "text"}
                          value={userForm.password}
                          onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                          placeholder="Senha temporária"
                          className={userForm.mustChangePassword ? "pr-20" : ""}
                          required={!editingUser}
                        />
                        {userForm.mustChangePassword && (
                          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => setShowTemporaryPassword((value) => !value)} className="h-8 w-8">
                              {showTemporaryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={copyUserPassword} className="h-8 w-8">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button type="button" variant="outline" onClick={generateUserPassword}>
                        Gerar senha
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Perfil de permissão</Label>
                  <Select value={userForm.permissionProfileId} onValueChange={(value) => setUserForm({ ...userForm, permissionProfileId: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {permissionProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={userForm.isActive ? "active" : "inactive"} onValueChange={(value) => setUserForm({ ...userForm, isActive: value === "active" })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  </div>
                </div>
                <DialogFooter className="px-6 pb-6 pt-3 sm:items-center sm:justify-between">
                  <div>
                    {editingUser && userForm.mustChangePassword ? (
                      <Button type="button" variant="outline" onClick={handleSendFirstAccessEmail} disabled={saving}>
                        <Mail className="mr-2 h-4 w-4" />
                        Enviar para e-mail
                      </Button>
                    ) : editingUser ? (
                      <Button type="button" variant="outline" onClick={handleResetUserPassword} disabled={saving}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Resetar senha
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeUserDialog}>Cancelar</Button>
                    <Button type="submit" disabled={saving}>{editingUser ? "Salvar" : "Criar"}</Button>
                  </div>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeSection === "notificações" && (
        <div className="space-y-4">
          <div className="hidden -m-1 flex-col gap-3 overflow-visible p-1 sm:flex sm:flex-row sm:items-center">
            <div className="relative w-full focus-within:z-[70] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar regras..." value={ruleSearch} onChange={(event) => { setRuleSearch(event.target.value); setRulePage(1) }} className="pl-10" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {paginatedRules.length === 0 ? (
              <EmptyState icon={Bell} title="Nenhuma regra encontrada." className="md:col-span-2" />
            ) : (
              paginatedRules.map((item) => (
                <Card key={item.id} className={cn("flex h-full flex-col", !item.isActive && "opacity-60")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Bell className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="min-w-0 break-words text-base leading-tight">{item.name}</CardTitle>
                          <CardDescription className="mt-1 text-sm">
                            {NOTIFICATION_TYPE_LABELS[item.type] ?? item.type}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.isDefault ? <Badge variant="secondary" className="shrink-0 whitespace-nowrap">Padrão</Badge> : null}
                        {canManageSettings ? (
                          <>
                            <Switch
                              checked={item.isActive}
                              onCheckedChange={async () => {
                                setSaving(true)
                                try {
                                  const response = await updateNotificationRule(item.id, { isActive: !item.isActive })
                                  upsertNotificationRule(response.data)
                                } catch (error) {
                                  toast.error(getApiErrorMessage(error, "Não foi possível atualizar a regra."))
                                } finally {
                                  setSaving(false)
                                }
                              }}
                            />
                            <Button variant="ghost" size="icon" onClick={() => openRuleDialog(item)}><Edit className="h-4 w-4" /></Button>
                            {!item.isDefault ? (
                              <Button variant="ghost" size="icon" onClick={() => setPendingDelete({ kind: "rule", id: item.id, label: item.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                    <div className="text-sm text-muted-foreground">
                      {getNotificationRuleSummary(item)}
                    </div>
                    <div className="mt-auto space-y-3 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {item.channels.map((channel) => {
                          const channelLabel = CHANNELS.find((entry) => entry.value === channel)?.label ?? channel
                          return <Badge key={channel} variant="outline">{channelLabel}</Badge>
                        })}
                      </div>
                      {item.isDefault && !DEFAULT_RULES_WITH_CONFIGURABLE_RECIPIENTS.has(item.type) ? (
                        <span className="text-xs text-muted-foreground">Destinatários automáticos conforme o evento.</span>
                      ) : (item.targetTeamIds.length > 0 || item.targetEmployeeIds.length > 0) ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.targetTeamIds.map((teamId) => {
                            const team = teams.find((entry) => entry.id === teamId)
                            const teamName = team?.name ?? teamId
                            return (
                              <Badge
                                key={teamId}
                                variant="secondary"
                                className="px-3 py-1 flex items-center gap-2 text-xs text-foreground/80"
                                style={team?.color ? { backgroundColor: `${team.color}1A` } : undefined}
                              >
                                {team?.color ? (
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: team.color }}
                                  />
                                ) : null}
                                {teamName}
                              </Badge>
                            )
                          })}
                          {item.targetEmployeeIds.map((employeeId) => {
                            const employeeName = employees.find((employee) => employee.id === employeeId)?.name ?? employeeId
                            return (
                              <Badge key={employeeId} variant="outline" className="px-3 py-1 text-xs">
                                {employeeName}
                              </Badge>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nenhum destinatário vinculado.</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <DataPagination
            currentPage={rulePage}
            totalPages={Math.max(1, Math.ceil(filteredRules.length / rulePageSize))}
            pageSize={rulePageSize}
            totalItems={filteredRules.length}
            onPageChange={setRulePage}
            onPageSizeChange={(size) => { setRulePageSize(size); setRulePage(1) }}
          />

          <Dialog open={isRuleDialogOpen} onOpenChange={(open) => (open ? setIsRuleDialogOpen(true) : closeRuleDialog())}>
            <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
              <DialogHeader className="px-6 pb-4 pt-6">
                <DialogTitle>Editar Notificação Padrão</DialogTitle>
              </DialogHeader>
              <form autoComplete="off" onSubmit={handleRuleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                  <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Nome</Label>
                  <Input id="rule-name" value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} disabled={Boolean(editingRule?.isDefault)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-description">Descrição</Label>
                  <Textarea id="rule-description" value={ruleForm.description} onChange={(event) => setRuleForm({ ...ruleForm, description: event.target.value })} rows={3} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={ruleForm.type} onValueChange={(value) => setRuleForm({ ...ruleForm, type: value })} disabled={Boolean(editingRule?.isDefault)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-time">Horário</Label>
                    <Input id="rule-time" type="time" value={ruleForm.time} onChange={(event) => setRuleForm({ ...ruleForm, time: event.target.value })} />
                  </div>
                </div>
                {ruleForm.type === "contract_expiring" ? (
                  <div className="space-y-2">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Primeiro Alerta (dias antes)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={ruleForm.contractExpirationAlertDays[0] ?? 0}
                          onChange={(event) => {
                            const next = [...ruleForm.contractExpirationAlertDays]
                            next[0] = event.target.value === "" ? "" : Number(event.target.value)
                            setRuleForm({ ...ruleForm, contractExpirationAlertDays: next, daysBefore: event.target.value === "" ? 0 : Number(event.target.value) })
                          }}
                          aria-label="Alerta 1 em dias"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Segundo Alerta (dias antes)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={ruleForm.contractExpirationAlertDays[1] ?? 0}
                          onChange={(event) => {
                            const next = [...ruleForm.contractExpirationAlertDays]
                            next[1] = event.target.value === "" ? "" : Number(event.target.value)
                            setRuleForm({ ...ruleForm, contractExpirationAlertDays: next })
                          }}
                          aria-label="Alerta 2 em dias"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Ex.: 60 dias antes e depois 30 dias antes.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="rule-days">
                      {ruleForm.type === "payment_overdue" ? "Intervalo de cobrança (dias)" : "Dias de antecedência"}
                    </Label>
                    <Input id="rule-days" type="number" min={ruleForm.type === "payment_overdue" ? 1 : 0} value={ruleForm.daysBefore} onChange={(event) => setRuleForm({ ...ruleForm, daysBefore: Number(event.target.value) })} />
                    {ruleForm.type === "payment_overdue" ? (
                      <p className="text-xs text-muted-foreground">A cobrança só é enviada quando a parcela for marcada manualmente como vencida.</p>
                    ) : null}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Canais</Label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNELS.map((channel) => {
                      const active = ruleForm.channels.includes(channel.value)
                      return (
                        <button
                          key={channel.value}
                          type="button"
                          onClick={() => toggleChannel(channel.value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                          )}
                        >
                          <channel.icon className="h-3.5 w-3.5" />
                          {channel.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {editingRule?.isDefault && !DEFAULT_RULES_WITH_CONFIGURABLE_RECIPIENTS.has(editingRule.type) ? (
                  <p className="text-xs text-muted-foreground">Esta regra usa destinatários automáticos: equipes e funcionários do agendamento, ou cliente nos envios externos.</p>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Equipes</Label>
                        <MultiSelect
                          options={teamOptions}
                          selected={ruleForm.targetTeamIds}
                          onChange={(selected) => setRuleForm({
                            ...ruleForm,
                            targetTeamIds: selected,
                            targetEmployeeIds: removeEmployeesCoveredByTeams(ruleForm.targetEmployeeIds, selected, teams),
                          })}
                          placeholder="Buscar e adicionar equipes..."
                          searchPlaceholder="Buscar equipe..."
                          emptyMessage="Nenhuma equipe encontrada."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Funcionários Avulsos</Label>
                        <MultiSelect
                          options={employeeOptions}
                          selected={ruleForm.targetEmployeeIds}
                          onChange={(selected) => setRuleForm({
                            ...ruleForm,
                            targetEmployeeIds: removeEmployeesCoveredByTeams(selected, ruleForm.targetTeamIds, teams),
                          })}
                          placeholder="Buscar e adicionar funcionários..."
                          searchPlaceholder="Buscar funcionário..."
                          emptyMessage="Nenhum funcionário encontrado."
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Selecione equipes, funcionários avulsos ou ambos para definir quem recebe a notificação.</p>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={ruleForm.isActive} onCheckedChange={(checked) => setRuleForm({ ...ruleForm, isActive: checked })} />
                  <Label>Regra ativa</Label>
                </div>
                  </div>
                </div>
                <DialogFooter className="px-6 pb-6 pt-3">
                  <Button type="button" variant="outline" onClick={closeRuleDialog}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{editingRule ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <ConfirmActionDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        title={
          pendingDelete?.kind === "client-type"
            ? "Excluir tipo de cliente"
            : pendingDelete?.kind === "profile"
              ? "Excluir perfil de permissão"
              : pendingDelete?.kind === "user"
                ? "Excluir usuário"
                : "Excluir regra de notificação"
        }
        description={
          pendingDelete?.kind === "client-type"
            ? `Esta ação vai excluir o tipo "${pendingDelete?.label ?? ""}".`
            : pendingDelete?.kind === "profile"
              ? `Esta ação vai excluir o perfil "${pendingDelete?.label ?? ""}".`
              : pendingDelete?.kind === "user"
                ? `Esta ação vai excluir o usuário "${pendingDelete?.label ?? ""}".`
                : `Esta ação vai excluir a regra "${pendingDelete?.label ?? ""}".`
        }
        confirmLabel="Excluir"
        onConfirm={confirmPendingDelete}
        busy={saving}
      />
    </div>
  )
}

