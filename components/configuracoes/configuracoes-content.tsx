"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Bell, Building, Copy, Edit, Eye, EyeOff, Mail, MessageCircle, Plus, RefreshCcw, Search, Shield, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataPagination } from "@/components/ui/data-pagination"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { MultiSelect } from "@/components/ui/multi-select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { formatCPF, formatPhone } from "@/lib/masks"
import { listEmployees, type EmployeeRecord } from "@/lib/api/employees"
import {
  createClientType,
  createNotificationRule,
  createPermissionProfile,
  createUser,
  deleteClientType,
  deleteNotificationRule,
  deletePermissionProfile,
  deleteUser,
  getSettings,
  resetUserPassword,
  updateClientType,
  updateNotificationRule,
  updatePermissionProfile,
  updateUser,
  type ClientTypeRecord,
  type NotificationRuleRecord,
  type PermissionProfileRecord,
  type UserRecord,
} from "@/lib/api/settings"
import { listTeams, type TeamRecord } from "@/lib/api/teams"

type SettingsSection = "tipos-cliente" | "permissoes" | "usuarios" | "notificacoes"

const SETTINGS_CARDS = [
  { id: "tipos-cliente" as SettingsSection, label: "Tipos de Cliente", icon: Building, description: "Categorize seus clientes por tipo" },
  { id: "permissoes" as SettingsSection, label: "Perfis de Permissões", icon: Shield, description: "Configure níveis de acesso ao sistema" },
  { id: "usuarios" as SettingsSection, label: "Usuários do Sistema", icon: Users, description: "Gerencie usuários e seus acessos" },
  { id: "notificacoes" as SettingsSection, label: "Configuração de Notificações", icon: Bell, description: "Defina quem recebe cada tipo de notificação" },
]

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_schedule: "Novo Agendamento",
  schedule_change: "Alteração de Agendamento",
  schedule_cancel: "Cancelamento",
  emergency: "Emergência",
  daily_services: "Serviços do Dia",
  payment_due: "Parcela Vencendo",
  payment_overdue: "Parcela Vencida",
  contract_expiring: "Contrato Vencendo",
}

const CHANNELS = [
  { value: "system", label: "Sistema", icon: Bell },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "E-mail", icon: Mail },
] as const

const DEFAULT_COLOR = "#84CC16"

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
}

const PERMISSION_MODULES: PermissionModule[] = [
  { key: "clients", title: "Clientes", description: "Acesso ao cadastro e à gestão de clientes" },
  { key: "contracts", title: "Contratos", description: "Acesso ao fluxo de contratos e aditivos" },
  { key: "employees", title: "Funcionários", description: "Acesso ao cadastro de funcionários" },
  { key: "teams", title: "Equipes", description: "Acesso ao gerenciamento de equipes" },
  { key: "services", title: "Serviços", description: "Acesso ao cadastro e edição de serviços" },
  { key: "agenda", title: "Agenda", description: "Acesso aos agendamentos e à operação diária" },
  { key: "financial", title: "Financeiro", description: "Acesso ao financeiro e às parcelas" },
  { key: "reports", title: "Relatórios", description: "Acesso à consulta e exportação de relatórios" },
  { key: "settings", title: "Configurações", description: "Acesso à administração do sistema" },
  { key: "templates", title: "Templates", description: "Acesso aos modelos de contratos" },
  { key: "logs", title: "Logs", description: "Acesso ao histórico de ações" },
]

function getPermissionModuleLabel(moduleKey: string) {
  return PERMISSION_MODULES.find((module) => module.key === moduleKey)?.title ?? moduleKey
}

function getPermissionModuleDescription(moduleKey: string) {
  return PERMISSION_MODULES.find((module) => module.key === moduleKey)?.description ?? ""
}

export function ConfiguracoesContent() {
  const [activeSection, setActiveSection] = useUrlQueryState("section", "tipos-cliente")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
  const [rulePageSize, setRulePageSize] = useState(6)

  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ClientTypeRecord | null>(null)
  const [typeForm, setTypeForm] = useState({ name: "", description: "", color: DEFAULT_COLOR })

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
    type: "new_schedule",
    daysBefore: 1,
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
      const [settingsResponse, teamsResponse, employeesResponse] = await Promise.all([
        getSettings(),
        listTeams(),
        listEmployees(),
      ])
      const response = settingsResponse
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
    } catch {
      toast.error("Não foi possível carregar as configurações.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshSettings()
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
  })), [teams])

  const employeeOptions = useMemo(() => employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    subtitle: `${employee.role || "Sem cargo"} • ${formatPhone(employee.phone)}`,
  })), [employees])

  const paginatedTypes = useMemo(() => filteredTypes.slice((typePage - 1) * typePageSize, typePage * typePageSize), [filteredTypes, typePage, typePageSize])
  const paginatedProfiles = useMemo(() => filteredProfiles.slice((profilePage - 1) * profilePageSize, profilePage * profilePageSize), [filteredProfiles, profilePage, profilePageSize])
  const paginatedUsers = useMemo(() => filteredUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize), [filteredUsers, userPage, userPageSize])
  const paginatedRules = useMemo(() => filteredRules.slice((rulePage - 1) * rulePageSize, rulePage * rulePageSize), [filteredRules, rulePage, rulePageSize])

  const resetTypeForm = () => {
    setEditingType(null)
    setTypeForm({ name: "", description: "", color: DEFAULT_COLOR })
    setIsTypeDialogOpen(false)
  }

  const resetProfileForm = () => {
    setEditingProfile(null)
    setProfileForm({ name: "", description: "", permissions: [] })
    setIsProfileDialogOpen(false)
  }

  const resetUserForm = () => {
    setEditingUser(null)
    setUserForm({ name: "", email: "", phone: "", cpf: "", role: "", password: "", permissionProfileId: "", isActive: true, mustChangePassword: true })
    setShowTemporaryPassword(false)
    setIsUserDialogOpen(false)
  }

  const resetRuleForm = () => {
    setEditingRule(null)
    setRuleForm({ name: "", type: "new_schedule", daysBefore: 1, time: "08:00", channels: [], targetTeamIds: [], targetEmployeeIds: [], isActive: true })
    setIsRuleDialogOpen(false)
  }

  const openTypeDialog = (record?: ClientTypeRecord) => {
    if (record) {
      setEditingType(record)
      setTypeForm({ name: record.name, description: record.description, color: record.color })
    }
    setIsTypeDialogOpen(true)
  }

  const openProfileDialog = (record?: PermissionProfileRecord) => {
    if (record) {
      setEditingProfile(record)
      setProfileForm({ name: record.name, description: record.description, permissions: [...record.permissions] })
    }
    setIsProfileDialogOpen(true)
  }

  const openUserDialog = (record?: UserRecord) => {
    if (record) {
      setEditingUser(record)
      const cachedTemporaryPassword = record.temporaryPassword ?? temporaryPasswords[record.id] ?? ""
      setUserForm({
        name: record.name,
        email: record.email,
        phone: record.phone,
        cpf: formatCPF(record.cpf),
        role: record.role,
        password: record.mustChangePassword ? cachedTemporaryPassword : "",
        permissionProfileId: record.permissionProfileId,
        isActive: record.isActive,
        mustChangePassword: record.mustChangePassword,
      })
      setShowTemporaryPassword(!record.mustChangePassword)
    } else {
      setEditingUser(null)
      setUserForm({ name: "", email: "", phone: "", cpf: "", role: "", password: "", permissionProfileId: "", isActive: true, mustChangePassword: true })
      setShowTemporaryPassword(false)
    }
    setIsUserDialogOpen(true)
  }

  const openRuleDialog = (record?: NotificationRuleRecord) => {
    if (record) {
      setEditingRule(record)
      setRuleForm({
        name: record.name,
        type: record.type,
        daysBefore: record.daysBefore,
        time: record.time,
        channels: [...record.channels],
        targetTeamIds: [...record.targetTeamIds],
        targetEmployeeIds: [...record.targetEmployeeIds],
        isActive: record.isActive,
      })
    }
    setIsRuleDialogOpen(true)
  }

  const handleTypeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editingType) {
        const response = await updateClientType(editingType.id, typeForm)
        upsertClientType(response.data)
        toast.success("Tipo de cliente atualizado.")
      } else {
        const response = await createClientType(typeForm)
        upsertClientType(response.data)
        toast.success("Tipo de cliente criado.")
      }
      resetTypeForm()
    } catch {
      toast.error("Não foi possível salvar o tipo de cliente.")
    } finally {
      setSaving(false)
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...profileForm, permissions: profileForm.permissions }
      if (editingProfile) {
        const response = await updatePermissionProfile(editingProfile.id, payload)
        upsertPermissionProfile(response.data)
        toast.success("Perfil atualizado.")
      } else {
        const response = await createPermissionProfile(payload)
        upsertPermissionProfile(response.data)
        toast.success("Perfil criado.")
      }
      resetProfileForm()
    } catch {
      toast.error("Não foi possível salvar o perfil.")
    } finally {
      setSaving(false)
    }
  }

  const handleUserSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userForm.permissionProfileId) {
      toast.error("Selecione um perfil de permissao.")
      return
    }
    if (!editingUser && !userForm.password.trim()) {
      toast.error("Informe uma senha ou gere uma nova senha.")
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        const response = await updateUser(editingUser.id, {
          name: userForm.name,
          email: userForm.email,
          phone: userForm.phone,
          cpf: userForm.cpf,
          role: userForm.role,
          permissionProfileId: userForm.permissionProfileId,
          isActive: userForm.isActive,
          ...(userForm.password.trim() ? { password: userForm.password } : {}),
        })
        upsertUser(response.data)
        if (response.data.temporaryPassword) {
          setTemporaryPasswords((current) => ({
            ...current,
            [response.data.id]: response.data.temporaryPassword ?? "",
          }))
        }
        toast.success("Usuário atualizado.")
      } else {
        const response = await createUser({
          name: userForm.name,
          email: userForm.email,
          phone: userForm.phone,
          cpf: userForm.cpf,
          role: userForm.role,
          password: userForm.password,
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
        toast.success("Usuário criado.")
      }
      resetUserForm()
    } catch {
      toast.error("Não foi possível salvar o usuário.")
    } finally {
      setSaving(false)
    }
  }

  const handleRuleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: ruleForm.name,
        type: ruleForm.type,
        daysBefore: ruleForm.daysBefore,
        time: ruleForm.time,
        channels: ruleForm.channels,
        targetTeamIds: ruleForm.targetTeamIds,
        targetEmployeeIds: ruleForm.targetEmployeeIds,
        isActive: ruleForm.isActive,
      }
      if (editingRule) {
        const response = await updateNotificationRule(editingRule.id, payload)
        upsertNotificationRule(response.data)
        toast.success("Regra atualizada.")
      } else {
        const response = await createNotificationRule(payload)
        upsertNotificationRule(response.data)
        toast.success("Regra criada.")
      }
      resetRuleForm()
    } catch {
      toast.error("Não foi possível salvar a regra.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteType = async (id: string) => {
    setSaving(true)
    try {
      await deleteClientType(id)
      setClientTypes((current) => current.filter((item) => item.id !== id))
      toast.success("Tipo de cliente removido.")
    } catch {
      toast.error("Não foi possível excluir o tipo.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProfile = async (id: string) => {
    setSaving(true)
    try {
      await deletePermissionProfile(id)
      setPermissionProfiles((current) => current.filter((item) => item.id !== id))
      toast.success("Perfil removido.")
    } catch {
      toast.error("Não foi possível excluir o perfil.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    setSaving(true)
    try {
      await deleteUser(id)
      setUsers((current) => current.filter((item) => item.id !== id))
      toast.success("Usuário removido.")
    } catch {
      toast.error("Não foi possível excluir o usuário.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    setSaving(true)
    try {
      await deleteNotificationRule(id)
      setNotificationRules((current) => current.filter((item) => item.id !== id))
      toast.success("Regra removida.")
    } catch {
      toast.error("Não foi possível excluir a regra.")
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

    setSaving(true)
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
      toast.success("Senha redefinida.")
    } catch {
      toast.error("Não foi possível redefinir a senha.")
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

  const groupedPermissions = useMemo(() => {
    return PERMISSION_MODULES.map((module) => ({
      ...module,
      permissions: permissionCatalog.filter((permission) => permission.key.startsWith(`${module.key}_`)),
    }))
  }, [permissionCatalog])

  const getModuleSelectionState = (moduleKey: string) => {
    const modulePermissions = permissionCatalog.filter((permission) => permission.key.startsWith(`${moduleKey}_`))
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

  if (loading) {
    return <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Carregando configurações...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden">
        {SETTINGS_CARDS.map((card) => (
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

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {SETTINGS_CARDS.map((card) => (
          <Card
            key={card.id}
            className={cn("cursor-pointer transition-all hover:shadow-md", activeSection === card.id && "ring-2 ring-primary bg-primary/5")}
            onClick={() => setActiveSection(card.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2", activeSection === card.id ? "bg-primary/20" : "bg-primary/10")}>
                  <card.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-base">{card.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeSection === "tipos-cliente" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar tipos..." value={typeSearch} onChange={(event) => { setTypeSearch(event.target.value); setTypePage(1) }} className="pl-10" />
            </div>
            <Button onClick={() => openTypeDialog()} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Novo Tipo
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cor</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">Nenhum tipo encontrado.</TableCell>
                  </TableRow>
                ) : (
                  paginatedTypes.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><span className="inline-flex h-5 w-5 rounded-full" style={{ backgroundColor: item.color }} /></TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.description || "Sem descricao"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openTypeDialog(item)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setPendingDelete({ kind: "client-type", id: item.id, label: item.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
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

          <Dialog open={isTypeDialogOpen} onOpenChange={(open) => (open ? setIsTypeDialogOpen(true) : resetTypeForm())}>
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
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetTypeForm}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{editingType ? "Salvar" : "Criar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeSection === "permissoes" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar perfis..." value={profileSearch} onChange={(event) => { setProfileSearch(event.target.value); setProfilePage(1) }} className="pl-10" />
            </div>
            <Button onClick={() => openProfileDialog()} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Novo Perfil
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">Nenhum perfil encontrado.</TableCell>
                  </TableRow>
                ) : (
                  paginatedProfiles.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.description || "Sem descricao"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">{item.permissions.length} permissões</Badge>
                          {item.id === "profile-admin" && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Padrao</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openProfileDialog(item)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" disabled={item.id === "profile-admin"} onClick={() => setPendingDelete({ kind: "profile", id: item.id, label: item.name })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
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

          <Dialog open={isProfileDialogOpen} onOpenChange={(open) => (open ? setIsProfileDialogOpen(true) : resetProfileForm())}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProfile ? "Editar Perfil" : "Novo Perfil de Permissao"}</DialogTitle>
              </DialogHeader>
              <form autoComplete="off" onSubmit={handleProfileSubmit} className="space-y-4">
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
                              checked={moduleState.allSelected ? true : moduleState.partialSelected ? "indeterminate" : false}
                              onCheckedChange={() => toggleModulePermissions(module.key)}
                            />
                            <AccordionTrigger className="flex-1 py-0 no-underline hover:no-underline">
                              <div className="flex w-full items-center justify-between gap-4 text-left">
                                <div className="space-y-1">
                                  <div className="font-medium">{module.title}</div>
                                  <div className="text-xs text-muted-foreground">{module.description}</div>
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {moduleState.modulePermissions.filter((permission) => profileForm.permissions.includes(permission.key)).length}/{moduleState.modulePermissions.length}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                          </div>
                          <AccordionContent>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {module.permissions.map((permission) => (
                                <label key={permission.key} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                                  <Checkbox
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
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetProfileForm}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{editingProfile ? "Salvar" : "Criar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeSection === "usuarios" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar usuários..." value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setUserPage(1) }} className="pl-10" />
            </div>
            <Button onClick={() => openUserDialog()} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">Nenhum usuario encontrado.</TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {item.name}
                          {item.mustChangePassword && <Badge variant="outline">Primeiro acesso</Badge>}
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
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openUserDialog(item)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setPendingDelete({ kind: "user", id: item.id, label: item.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
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

          <Dialog open={isUserDialogOpen} onOpenChange={(open) => (open ? setIsUserDialogOpen(true) : resetUserForm())}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Editar Usuário do Sistema" : "Novo Usuário do Sistema"}</DialogTitle>
              </DialogHeader>
              <form autoComplete="off" onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user-name">Nome</Label>
                  <Input id="user-name" placeholder="Nome completo" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">E-mail</Label>
                  <Input id="user-email" type="email" autoComplete="off" placeholder="email@empresa.com" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-phone">Telefone</Label>
                  <Input
                    id="user-phone"
                    value={userForm.phone}
                    onChange={(event) => setUserForm({ ...userForm, phone: formatPhone(event.target.value) })}
                    placeholder="(51) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-cpf">CPF</Label>
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
                  <Label>Perfil de permissao</Label>
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {editingUser && !userForm.mustChangePassword && (
                      <Button type="button" variant="outline" onClick={handleResetUserPassword} disabled={saving}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Resetar senha
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetUserForm}>Cancelar</Button>
                    <Button type="submit" disabled={saving}>{editingUser ? "Salvar" : "Criar"}</Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeSection === "notificacoes" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar regras..." value={ruleSearch} onChange={(event) => { setRuleSearch(event.target.value); setRulePage(1) }} className="pl-10" />
            </div>
            <Button onClick={() => openRuleDialog()} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Nova Regra
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedRules.length === 0 ? (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhuma regra encontrada.</CardContent>
              </Card>
            ) : (
              paginatedRules.map((item) => (
                <Card key={item.id} className={cn(!item.isActive && "opacity-60")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Bell className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <CardDescription className="mt-1 text-sm">
                            {NOTIFICATION_TYPE_LABELS[item.type] ?? item.type}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={async () => {
                            setSaving(true)
                            try {
                              const response = await updateNotificationRule(item.id, { isActive: !item.isActive })
                              upsertNotificationRule(response.data)
                            } catch {
                              toast.error("Não foi possível atualizar a regra.")
                            } finally {
                              setSaving(false)
                            }
                          }}
                        />
                        <Button variant="ghost" size="icon" onClick={() => openRuleDialog(item)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setPendingDelete({ kind: "rule", id: item.id, label: item.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="text-sm text-muted-foreground">
                      <span>{item.daysBefore === 0 ? "No dia" : `${item.daysBefore} dia(s) antes`}</span>
                      <span className="mx-1">•</span>
                      <span>às {item.time}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.channels.map((channel) => {
                        const channelLabel = CHANNELS.find((entry) => entry.value === channel)?.label ?? channel
                        return <Badge key={channel} variant="outline">{channelLabel}</Badge>
                      })}
                    </div>
                    {(item.targetTeamIds.length > 0 || item.targetEmployeeIds.length > 0) ? (
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

          <Dialog open={isRuleDialogOpen} onOpenChange={(open) => (open ? setIsRuleDialogOpen(true) : resetRuleForm())}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRule ? "Editar Regra de Notificação" : "Nova Regra de Notificação"}</DialogTitle>
              </DialogHeader>
              <form autoComplete="off" onSubmit={handleRuleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Nome</Label>
                  <Input id="rule-name" value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={ruleForm.type} onValueChange={(value) => setRuleForm({ ...ruleForm, type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rule-days">Dias de antecedencia</Label>
                    <Input id="rule-days" type="number" min={0} value={ruleForm.daysBefore} onChange={(event) => setRuleForm({ ...ruleForm, daysBefore: Number(event.target.value) })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-time">Horario</Label>
                  <Input id="rule-time" type="time" value={ruleForm.time} onChange={(event) => setRuleForm({ ...ruleForm, time: event.target.value })} />
                </div>
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
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Equipes destinatárias</Label>
                    <MultiSelect
                      options={teamOptions}
                      selected={ruleForm.targetTeamIds}
                      onChange={(selected) => setRuleForm({ ...ruleForm, targetTeamIds: selected })}
                      placeholder="Buscar e adicionar equipes..."
                      searchPlaceholder="Buscar equipe..."
                      emptyMessage="Nenhuma equipe encontrada."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Funcionários avulsos</Label>
                    <MultiSelect
                      options={employeeOptions}
                      selected={ruleForm.targetEmployeeIds}
                      onChange={(selected) => setRuleForm({ ...ruleForm, targetEmployeeIds: selected })}
                      placeholder="Buscar e adicionar funcionários..."
                      searchPlaceholder="Buscar funcionário..."
                      emptyMessage="Nenhum funcionário encontrado."
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Selecione equipes, funcionários avulsos ou ambos para definir quem recebe a notificação.</p>
                <div className="flex items-center gap-2">
                  <Switch checked={ruleForm.isActive} onCheckedChange={(checked) => setRuleForm({ ...ruleForm, isActive: checked })} />
                  <Label>Regra ativa</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetRuleForm}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{editingRule ? "Salvar" : "Criar"}</Button>
                </div>
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

