"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { cn, getColorFromClass } from "@/lib/utils"
import { Plus, Edit, Trash2, Shield, Users, Building, Bell, Search, Clock, X, MessageCircle, Mail, Check, ChevronsUpDown } from "lucide-react"
import { DataPagination } from "@/components/ui/data-pagination"
import { mockClientTypes, mockPermissionProfiles, mockUsers, mockTeams, notificationRules } from "@/lib/mock-data"
import type { PermissionKey, NotificationRule, NotificationType, NotificationChannel } from "@/lib/types"

type ClientTypeRow = (typeof mockClientTypes)[number]
type PermissionProfileRow = Omit<(typeof mockPermissionProfiles)[number], "permissions"> & { permissions: PermissionKey[] }
type UserRow = (typeof mockUsers)[number]

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: "new_schedule", label: "Novo Agendamento" },
  { value: "schedule_change", label: "Alteração de Agendamento" },
  { value: "schedule_cancel", label: "Cancelamento" },
  { value: "emergency", label: "Emergência" },
  { value: "daily_services", label: "Serviços do Dia" },
  { value: "payment_due", label: "Parcela Vencendo" },
  { value: "payment_overdue", label: "Parcela Vencida" },
  { value: "contract_expiring", label: "Contrato Vencendo" },
]

const CHANNELS: { value: NotificationChannel; label: string; icon: typeof Bell }[] = [
  { value: "system", label: "Sistema", icon: Bell },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "E-mail", icon: Mail },
]

const ALL_PERMISSIONS: { key: PermissionKey; label: string; description: string }[] = [
  { key: "clients_view", label: "Visualizar Clientes", description: "Ver lista de clientes" },
  { key: "clients_create", label: "Criar Clientes", description: "Cadastrar novos clientes" },
  { key: "clients_edit", label: "Editar Clientes", description: "Modificar dados de clientes" },
  { key: "clients_delete", label: "Excluir Clientes", description: "Remover clientes do sistema" },
  { key: "contracts_view", label: "Visualizar Contratos", description: "Ver contratos" },
  { key: "contracts_create", label: "Criar Contratos", description: "Criar novos contratos" },
  { key: "contracts_edit", label: "Editar Contratos", description: "Modificar contratos" },
  { key: "contracts_delete", label: "Excluir Contratos", description: "Remover contratos" },
  { key: "employees_view", label: "Visualizar Funcionários", description: "Ver funcionários" },
  { key: "employees_create", label: "Criar Funcionários", description: "Cadastrar funcionários" },
  { key: "employees_edit", label: "Editar Funcionários", description: "Modificar funcionários" },
  { key: "employees_delete", label: "Excluir Funcionários", description: "Remover funcionários" },
  { key: "teams_view", label: "Visualizar Equipes", description: "Ver equipes" },
  { key: "teams_manage", label: "Gerenciar Equipes", description: "Criar, editar e excluir equipes" },
  { key: "services_view", label: "Visualizar Serviços", description: "Ver serviços" },
  { key: "services_manage", label: "Gerenciar Serviços", description: "Criar, editar e excluir serviços" },
  { key: "agenda_view", label: "Visualizar Agenda", description: "Ver agendamentos" },
  { key: "agenda_manage", label: "Gerenciar Agenda", description: "Criar e modificar agendamentos" },
  { key: "financial_view", label: "Visualizar Financeiro", description: "Ver dados financeiros" },
  { key: "financial_manage", label: "Gerenciar Financeiro", description: "Editar dados financeiros" },
  { key: "reports_view", label: "Visualizar Relatórios", description: "Acessar relatórios" },
  { key: "reports_export", label: "Exportar Relatórios", description: "Exportar dados" },
  { key: "settings_view", label: "Visualizar Configurações", description: "Ver configurações" },
  { key: "settings_manage", label: "Gerenciar Configurações", description: "Modificar configurações do sistema" },
  { key: "templates_view", label: "Visualizar Templates", description: "Ver templates de contratos" },
  { key: "templates_manage", label: "Gerenciar Templates", description: "Criar, editar e excluir templates" },
  { key: "logs_view", label: "Visualizar Logs", description: "Ver logs do sistema" },
  { key: "logs_manage", label: "Gerenciar Logs", description: "Gerenciar e exportar logs" },
]

type SettingsSection = "tipos-cliente" | "permissoes" | "usuarios" | "notificacoes"

const SETTINGS_CARDS = [
  { id: "tipos-cliente" as SettingsSection, label: "Tipos de Cliente", icon: Building, description: "Categorize seus clientes por tipo" },
  { id: "permissoes" as SettingsSection, label: "Perfis de Permissões", icon: Shield, description: "Configure níveis de acesso ao sistema" },
  { id: "usuarios" as SettingsSection, label: "Usuários do Sistema", icon: Users, description: "Gerencie usuários e seus acessos" },
  { id: "notificacoes" as SettingsSection, label: "Configuração de Notificações", icon: Bell, description: "Defina quem recebe cada tipo de notificação" },
]

export function ConfiguracoesContent() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("tipos-cliente")
  const [clientTypes, setClientTypes] = useState<ClientTypeRow[]>(mockClientTypes)
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfileRow[]>(
    mockPermissionProfiles.map((p) => ({ ...p, permissions: [...p.permissions] })) as PermissionProfileRow[]
  )
  const [users, setUsers] = useState<UserRow[]>(mockUsers)

  // Pagination for client types
  const [typeCurrentPage, setTypeCurrentPage] = useState(1)
  const [typePageSize, setTypePageSize] = useState(10)
  const [typeSearchTerm, setTypeSearchTerm] = useState("")

  // Pagination for users
  const [userCurrentPage, setUserCurrentPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(10)
  const [userSearchTerm, setUserSearchTerm] = useState("")

  // Notification Rules State
  const [rules, setRules] = useState<NotificationRule[]>(notificationRules)
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [ruleFormData, setRuleFormData] = useState({
    name: "",
    type: "new_schedule" as NotificationType,
    daysBefore: 1,
    time: "08:00",
    channels: [] as NotificationChannel[],
    targetTeamIds: [] as string[],
    isActive: true,
  })
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [teamSearchTerm, setTeamSearchTerm] = useState("")

  const filteredTeamsForRule = mockTeams.filter(t =>
    t.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
  )

  // Client Type Dialog
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ClientTypeRow | null>(null)
  const [typeFormData, setTypeFormData] = useState({
    name: "",
    description: "",
    color: "#F59E0B",
  })

  // Permission Profile Dialog
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<PermissionProfileRow | null>(null)
  const [profileFormData, setProfileFormData] = useState({
    name: "",
    description: "",
    permissions: [] as PermissionKey[],
  })

  // User Dialog
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [userFormData, setUserFormData] = useState({
    name: "",
    email: "",
    password: "",
    permissionProfileId: "",
    isActive: true,
  })

  // Filtered and paginated client types
  const filteredTypes = useMemo(() => {
    return clientTypes.filter(t =>
      t.name.toLowerCase().includes(typeSearchTerm.toLowerCase())
    )
  }, [clientTypes, typeSearchTerm])

  const typeTotalPages = Math.ceil(filteredTypes.length / typePageSize)
  const paginatedTypes = useMemo(() => {
    const start = (typeCurrentPage - 1) * typePageSize
    return filteredTypes.slice(start, start + typePageSize)
  }, [filteredTypes, typeCurrentPage, typePageSize])

  // Filtered and paginated users
  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
    )
  }, [users, userSearchTerm])

  const userTotalPages = Math.ceil(filteredUsers.length / userPageSize)
  const paginatedUsers = useMemo(() => {
    const start = (userCurrentPage - 1) * userPageSize
    return filteredUsers.slice(start, start + userPageSize)
  }, [filteredUsers, userCurrentPage, userPageSize])

  // Client Types CRUD
  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingType) {
      setClientTypes(clientTypes.map(ct =>
        ct.id === editingType.id ? { ...ct, ...typeFormData } : ct
      ))
    } else {
      const newType: ClientTypeRow = {
        id: `ctype-${Date.now()}`,
        ...typeFormData,
      }
      setClientTypes([...clientTypes, newType])
    }
    resetTypeForm()
  }

  const resetTypeForm = () => {
    setTypeFormData({ name: "", description: "", color: "#F59E0B" })
    setEditingType(null)
    setIsTypeDialogOpen(false)
  }

  const handleEditType = (type: ClientTypeRow) => {
    setEditingType(type)
    setTypeFormData({
      name: type.name,
      description: type.description || "",
      color: type.color || "#F59E0B",
    })
    setIsTypeDialogOpen(true)
  }

  const handleDeleteType = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este tipo de cliente?")) {
      setClientTypes(clientTypes.filter(ct => ct.id !== id))
    }
  }

  // Permission Profiles CRUD
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingProfile) {
      setPermissionProfiles(permissionProfiles.map(pp =>
        pp.id === editingProfile.id ? { ...pp, ...profileFormData } : pp
      ))
    } else {
      const newProfile: PermissionProfileRow = {
        id: `profile-${Date.now()}`,
        ...profileFormData,
        createdAt: new Date().toISOString(),
      }
      setPermissionProfiles([...permissionProfiles, newProfile])
    }
    resetProfileForm()
  }

  const resetProfileForm = () => {
    setProfileFormData({ name: "", description: "", permissions: [] })
    setEditingProfile(null)
    setIsProfileDialogOpen(false)
  }

  const handleEditProfile = (profile: PermissionProfileRow) => {
    setEditingProfile(profile)
    setProfileFormData({
      name: profile.name,
      description: profile.description || "",
      permissions: [...profile.permissions],
    })
    setIsProfileDialogOpen(true)
  }

  const handleDeleteProfile = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este perfil de permissões?")) {
      setPermissionProfiles(permissionProfiles.filter(pp => pp.id !== id))
    }
  }

  const togglePermission = (permission: PermissionKey) => {
    if (profileFormData.permissions.includes(permission)) {
      setProfileFormData({
        ...profileFormData,
        permissions: profileFormData.permissions.filter(p => p !== permission),
      })
    } else {
      setProfileFormData({
        ...profileFormData,
        permissions: [...profileFormData.permissions, permission],
      })
    }
  }

  // Users CRUD
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userFormData.permissionProfileId) return
    if (editingUser) {
      setUsers(users.map(u =>
        u.id === editingUser.id
          ? {
            ...u,
            name: userFormData.name,
            email: userFormData.email,
            permissionProfileId: userFormData.permissionProfileId,
            isActive: userFormData.isActive,
          }
          : u
      ))
    } else {
      const newUser: UserRow = {
        id: `user-${Date.now()}`,
        name: userFormData.name,
        email: userFormData.email,
        permissionProfileId: userFormData.permissionProfileId,
        isActive: userFormData.isActive,
        createdAt: new Date().toISOString(),
      }
      setUsers([...users, newUser])
    }
    resetUserForm()
  }

  const resetUserForm = () => {
    setUserFormData({ name: "", email: "", password: "", permissionProfileId: "", isActive: true })
    setEditingUser(null)
    setIsUserDialogOpen(false)
  }

  const handleEditUser = (user: UserRow) => {
    setEditingUser(user)
    setUserFormData({
      name: user.name,
      email: user.email,
      password: "",
      permissionProfileId: user.permissionProfileId,
      isActive: user.isActive,
    })
    setIsUserDialogOpen(true)
  }

  const handleDeleteUser = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
      setUsers(users.filter(u => u.id !== id))
    }
  }

  // Notification Rules CRUD
  const handleRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingRule) {
      setRules(rules.map(r =>
        r.id === editingRule.id ? { ...r, ...ruleFormData } : r
      ))
    } else {
      const newRule: NotificationRule = {
        id: `rule-${Date.now()}`,
        ...ruleFormData,
        createdAt: new Date(),
      }
      setRules([...rules, newRule])
    }
    resetRuleForm()
  }

  const resetRuleForm = () => {
    setRuleFormData({
      name: "",
      type: "new_schedule",
      daysBefore: 1,
      time: "08:00",
      channels: [],
      targetTeamIds: [],
      isActive: true,
    })
    setEditingRule(null)
    setIsRuleDialogOpen(false)
  }

  const handleEditRule = (rule: NotificationRule) => {
    setEditingRule(rule)
    setRuleFormData({
      name: rule.name,
      type: rule.type,
      daysBefore: rule.daysBefore || 1,
      time: rule.time || "08:00",
      channels: rule.channels,
      targetTeamIds: rule.targetTeamIds,
      isActive: rule.isActive,
    })
    setIsRuleDialogOpen(true)
  }

  const handleDeleteRule = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta regra?")) {
      setRules(rules.filter(r => r.id !== id))
    }
  }

  const toggleRuleActive = (id: string) => {
    setRules(rules.map(r =>
      r.id === id ? { ...r, isActive: !r.isActive } : r
    ))
  }

  const toggleChannel = (channel: NotificationChannel) => {
    if (ruleFormData.channels.includes(channel)) {
      setRuleFormData({
        ...ruleFormData,
        channels: ruleFormData.channels.filter(c => c !== channel),
      })
    } else {
      setRuleFormData({
        ...ruleFormData,
        channels: [...ruleFormData.channels, channel],
      })
    }
  }

  const toggleTeam = (teamId: string) => {
    if (ruleFormData.targetTeamIds.includes(teamId)) {
      setRuleFormData({
        ...ruleFormData,
        targetTeamIds: ruleFormData.targetTeamIds.filter(t => t !== teamId),
      })
    } else {
      setRuleFormData({
        ...ruleFormData,
        targetTeamIds: [...ruleFormData.targetTeamIds, teamId],
      })
    }
  }

  const removeTeamFromRule = (teamId: string) => {
    setRuleFormData({
      ...ruleFormData,
      targetTeamIds: ruleFormData.targetTeamIds.filter(t => t !== teamId),
    })
  }

  return (
    <div className="space-y-6">
      {/* Mobile: pills horizontais */}
      <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden">
        {SETTINGS_CARDS.map((card) => (
          <button
            key={card.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              activeSection === card.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            onClick={() => setActiveSection(card.id)}
          >
            <card.icon className="h-4 w-4" />
            {card.label}
          </button>
        ))}
      </div>
      {/* Desktop: cards */}
      <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SETTINGS_CARDS.map((card) => (
          <Card
            key={card.id}
            className={`cursor-pointer transition-all hover:shadow-md ${activeSection === card.id ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
            onClick={() => setActiveSection(card.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeSection === card.id ? "bg-primary/20" : "bg-primary/10"}`}>
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

      {/* Client Types Section */}
      {activeSection === "tipos-cliente" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative w-full sm:w-1/3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tipos..."
                value={typeSearchTerm}
                onChange={(e) => { setTypeSearchTerm(e.target.value); setTypeCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Tipo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingType ? "Editar Tipo" : "Novo Tipo de Cliente"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleTypeSubmit} className="space-y-6">
                  <div className="space-y-6">
                    <Label htmlFor="typeName">Nome</Label>
                    <Input
                      id="typeName"
                      value={typeFormData.name}
                      onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                      placeholder="Ex: Condominio"
                      required
                    />
                  </div>
                  <div className="space-y-6">
                    <Label htmlFor="typeDesc">Descrição</Label>
                    <Input
                      id="typeDesc"
                      value={typeFormData.description}
                      onChange={(e) => setTypeFormData({ ...typeFormData, description: e.target.value })}
                      placeholder="Descrição do tipo"
                    />
                  </div>
                  <div className="space-y-6">
                    <Label htmlFor="typeColor">Cor</Label>
                    <div className="flex gap-2">
                      <Input
                        id="typeColor"
                        type="color"
                        value={typeFormData.color}
                        onChange={(e) => setTypeFormData({ ...typeFormData, color: e.target.value })}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={typeFormData.color}
                        onChange={(e) => setTypeFormData({ ...typeFormData, color: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={resetTypeForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {editingType ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Cor</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhum tipo encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: getColorFromClass(type.color) }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {type.description || "Sem descricao"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditType(type)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteType(type.id)}>
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
            currentPage={typeCurrentPage}
            totalPages={typeTotalPages}
            pageSize={typePageSize}
            totalItems={filteredTypes.length}
            onPageChange={setTypeCurrentPage}
            onPageSizeChange={(size) => { setTypePageSize(size); setTypeCurrentPage(1) }}
          />
        </div>
      )}

      {/* Permission Profiles Section */}
      {activeSection === "permissoes" && (
        <div className="space-y-6">
          <div className="flex justify-start mb-4">
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Perfil
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProfile ? "Editar Perfil" : "Novo Perfil de Permissões"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-6">
                      <Label htmlFor="profileName">Nome</Label>
                      <Input
                        id="profileName"
                        value={profileFormData.name}
                        onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                        placeholder="Ex: Administrador"
                        required
                      />
                    </div>
                    <div className="space-y-6">
                      <Label htmlFor="profileDesc">Descrição</Label>
                      <Input
                        id="profileDesc"
                        value={profileFormData.description}
                        onChange={(e) => setProfileFormData({ ...profileFormData, description: e.target.value })}
                        placeholder="Descrição do perfil"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Permissões</Label>
                    <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                      <div className="grid gap-3">
                        {ALL_PERMISSIONS.map((perm) => (
                          <div key={perm.key} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={perm.key}
                                checked={profileFormData.permissions.includes(perm.key)}
                                onCheckedChange={() => togglePermission(perm.key)}
                              />
                              <div>
                                <Label htmlFor={perm.key} className="font-medium cursor-pointer">
                                  {perm.label}
                                </Label>
                                <p className="text-xs text-muted-foreground">{perm.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={resetProfileForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {editingProfile ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {permissionProfiles.map((profile) => (
              <Card key={profile.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{profile.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditProfile(profile)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteProfile(profile.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{profile.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {profile.permissions.slice(0, 5).map((perm) => (
                      <Badge key={perm} variant="secondary" className="text-xs">
                        {ALL_PERMISSIONS.find(p => p.key === perm)?.label || perm}
                      </Badge>
                    ))}
                    {profile.permissions.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.permissions.length - 5} mais
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Users Section */}
      {activeSection === "usuarios" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative w-full sm:w-1/3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={userSearchTerm}
                onChange={(e) => { setUserSearchTerm(e.target.value); setUserCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUserSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="userName">Nome *</Label>
                    <Input
                      id="userName"
                      value={userFormData.name}
                      onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                      placeholder="Nome do usuário"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">E-mail *</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      required
                    />
                  </div>
                  {!editingUser && (
                    <div className="space-y-2">
                      <Label htmlFor="userPassword">Senha *</Label>
                      <Input
                        id="userPassword"
                        type="password"
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        placeholder="Senha"
                        required={!editingUser}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Perfil de Permissões *</Label>
                    <Select
                      required
                      value={userFormData.permissionProfileId}
                      onValueChange={(value) => setUserFormData({ ...userFormData, permissionProfileId: value })}
                    >
                      <SelectTrigger className={!userFormData.permissionProfileId ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione um perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        {permissionProfiles.map(profile => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={userFormData.isActive}
                      onCheckedChange={(checked) => setUserFormData({ ...userFormData, isActive: checked })}
                    />
                    <Label>Usuário ativo</Label>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={resetUserForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {editingUser ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => {
                    const profile = permissionProfiles.find(p => p.id === user.permissionProfileId)
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {profile?.name || "Sem perfil"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={user.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}>
                            {user.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <DataPagination
            currentPage={userCurrentPage}
            totalPages={userTotalPages}
            pageSize={userPageSize}
            totalItems={filteredUsers.length}
            onPageChange={setUserCurrentPage}
            onPageSizeChange={(size) => { setUserPageSize(size); setUserCurrentPage(1) }}
          />
        </div>
      )}

      {/* Notifications Section - Regras de Notificação */}
      {activeSection === "notificacoes" && (
        <div className="space-y-6">
          <div className="flex justify-start items-center mb-4">
            <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Regra
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Notificação"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleRuleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="ruleName">Nome da Regra</Label>
                    <Input
                      id="ruleName"
                      value={ruleFormData.name}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                      placeholder="Ex: Lembrete de serviço"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-[2fr_1fr] gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Notificação</Label>
                      <Select
                        value={ruleFormData.type}
                        onValueChange={(value) => setRuleFormData({ ...ruleFormData, type: value as NotificationType })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NOTIFICATION_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="daysBefore">Dias de Antecedência</Label>
                      <Input
                        id="daysBefore"
                        type="number"
                        value={ruleFormData.daysBefore}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, daysBefore: Number(e.target.value) })}
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 w-1/3">
                    <Label htmlFor="time">Horário de Envio</Label>
                    <Input
                      id="time"
                      type="time"
                      value={ruleFormData.time}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Canais de Envio</Label>
                    <div className="flex gap-2">
                      {CHANNELS.map(channel => {
                        const isSelected = ruleFormData.channels.includes(channel.value)
                        return (
                          <button
                            key={channel.value}
                            type="button"
                            onClick={() => toggleChannel(channel.value)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer",
                              isSelected
                                ? "bg-primary/10 text-primary border-primary"
                                : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            <channel.icon className="h-3.5 w-3.5" />
                            {channel.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Equipes Destinatárias</Label>
                    <Popover open={teamsPopoverOpen} onOpenChange={setTeamsPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                        >
                          <span className="text-muted-foreground">Buscar e adicionar equipes...</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Buscar equipe..."
                            value={teamSearchTerm}
                            onValueChange={setTeamSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>Nenhuma equipe encontrada.</CommandEmpty>
                            <CommandGroup>
                              {filteredTeamsForRule.map((team) => {
                                const teamColor = getColorFromClass(team.color)
                                return (
                                  <CommandItem
                                    key={team.id}
                                    value={team.name}
                                    onSelect={() => toggleTeam(team.id)}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        ruleFormData.targetTeamIds.includes(team.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: teamColor }}
                                    />
                                    <span>{team.name}</span>
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {ruleFormData.targetTeamIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {ruleFormData.targetTeamIds.map(teamId => {
                          const team = mockTeams.find(t => t.id === teamId)
                          const teamColor = team ? getColorFromClass(team.color) : "#94A3B8"
                          return team ? (
                            <Badge
                              key={teamId}
                              variant="secondary"
                              className="px-3 py-1 flex items-center gap-2 text-foreground/80"
                              style={{ backgroundColor: `${teamColor}1A` }}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: teamColor }}
                              />
                              <span>{team.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-3.5 w-3.5 p-0 hover:bg-transparent"
                                onClick={() => removeTeamFromRule(teamId)}
                              >
                                <X className="h-2.5 w-2.5" />
                              </Button>
                            </Badge>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ruleActive"
                      checked={ruleFormData.isActive}
                      onCheckedChange={(checked) => setRuleFormData({ ...ruleFormData, isActive: checked })}
                    />
                    <Label htmlFor="ruleActive">Regra ativa</Label>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={resetRuleForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {editingRule ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {rules.map((rule) => {
              const typeConfig = NOTIFICATION_TYPES.find(t => t.value === rule.type)
              return (
                <Card key={rule.id} className={!rule.isActive ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        {rule.name}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => toggleRuleActive(rule.id)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleEditRule(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{typeConfig?.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground mb-5">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>
                          {rule.daysBefore === 0
                            ? "No dia"
                            : `${rule.daysBefore} dia(s) antes`}
                          {rule.time && ` às ${rule.time}`}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {rule.channels.map(channel => {
                          const channelConfig = CHANNELS.find(c => c.value === channel)
                          return channelConfig ? (
                            <Badge key={channel} variant="outline" className="text-xs">
                              <channelConfig.icon className="h-3 w-3 mr-1" />
                              {channelConfig.label}
                            </Badge>
                          ) : null
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {rule.targetTeamIds.map(teamId => {
                          const team = mockTeams.find(t => t.id === teamId)
                          return team ? (
                            <Badge
                              key={teamId}
                              variant="secondary"
                              className="px-3 py-1 flex items-center gap-2 text-xs text-foreground/80"
                              style={{ backgroundColor: `${team.color}1A` }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                              {team.name}
                            </Badge>
                          ) : null
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Info about automatic notifications */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notificações Automáticas de Serviços
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> As notificações de serviços agendados, lembretes e conclusão são enviadas automaticamente
                  para a equipe designada ao serviço. Esta configuração não pode ser alterada para garantir que apenas a equipe
                  responsável receba os alertas relevantes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
