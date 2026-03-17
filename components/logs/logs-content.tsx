"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Filter,
  User,
  FileText,
  Users,
  Settings,
  Calendar,
  DollarSign,
  Wrench,
  Plus,
  Edit,
  Trash2,
  Eye,
  LogIn,
  LogOut,
  Download,
  Shield,
} from "lucide-react"
import { DataPagination } from "@/components/ui/data-pagination"

type LogAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "login"
  | "logout"
  | "export"
  | "import"

type LogModule =
  | "clients"
  | "contracts"
  | "employees"
  | "teams"
  | "services"
  | "agenda"
  | "financial"
  | "settings"
  | "templates"
  | "auth"

interface SystemLog {
  id: string
  userId: string
  userName: string
  userRole: string
  action: LogAction
  module: LogModule
  description: string
  details?: string
  ipAddress: string
  timestamp: string
}

const mockLogs: SystemLog[] = [
  {
    id: "log-1",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "create",
    module: "clients",
    description: "Criou o cliente 'Condomínio Solar das Flores'",
    details: "CNPJ: 12.345.678/0001-90",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-12T14:32:00",
  },
  {
    id: "log-2",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "update",
    module: "contracts",
    description: "Atualizou contrato DEP-2026-001",
    details: "Alterou valor total de R$ 15.000 para R$ 18.000",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-12T13:15:00",
  },
  {
    id: "log-3",
    userId: "emp9",
    userName: "Paula Santos",
    userRole: "Gerente",
    action: "create",
    module: "agenda",
    description: "Agendou serviço de Desentupimento",
    details: "Cliente: Edifício Central Park - 15/03/2026 às 09:00",
    ipAddress: "192.168.1.105",
    timestamp: "2026-03-12T11:45:00",
  },
  {
    id: "log-4",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "delete",
    module: "employees",
    description: "Excluiu funcionário 'João Temporário'",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-12T10:20:00",
  },
  {
    id: "log-5",
    userId: "emp1",
    userName: "Carlos Silva",
    userRole: "Equipe Operacional",
    action: "login",
    module: "auth",
    description: "Realizou login no sistema",
    ipAddress: "192.168.1.110",
    timestamp: "2026-03-12T08:00:00",
  },
  {
    id: "log-6",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "update",
    module: "settings",
    description: "Atualizou perfil de permissão 'Gerente'",
    details: "Adicionou permissão: financial_manage",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-11T16:40:00",
  },
  {
    id: "log-7",
    userId: "emp9",
    userName: "Paula Santos",
    userRole: "Gerente",
    action: "export",
    module: "financial",
    description: "Exportou relatório financeiro de Fevereiro/2026",
    ipAddress: "192.168.1.105",
    timestamp: "2026-03-11T15:30:00",
  },
  {
    id: "log-8",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "create",
    module: "templates",
    description: "Importou template 'Contrato de Limpeza Premium'",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-11T14:10:00",
  },
  {
    id: "log-9",
    userId: "emp9",
    userName: "Paula Santos",
    userRole: "Gerente",
    action: "update",
    module: "teams",
    description: "Alterou a Equipe Desentupimento",
    details: "Adicionou funcionário: Roberto Lima",
    ipAddress: "192.168.1.105",
    timestamp: "2026-03-11T11:00:00",
  },
  {
    id: "log-10",
    userId: "emp1",
    userName: "Carlos Silva",
    userRole: "Equipe Operacional",
    action: "view",
    module: "services",
    description: "Visualizou detalhes do serviço #SRV-2026-045",
    ipAddress: "192.168.1.110",
    timestamp: "2026-03-11T09:20:00",
  },
  {
    id: "log-11",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "login",
    module: "auth",
    description: "Realizou login no sistema",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-11T08:05:00",
  },
  {
    id: "log-12",
    userId: "emp1",
    userName: "Carlos Silva",
    userRole: "Equipe Operacional",
    action: "logout",
    module: "auth",
    description: "Realizou logout do sistema",
    ipAddress: "192.168.1.110",
    timestamp: "2026-03-10T18:00:00",
  },
  {
    id: "log-13",
    userId: "emp9",
    userName: "Paula Santos",
    userRole: "Gerente",
    action: "create",
    module: "contracts",
    description: "Criou contrato DEP-2026-005",
    details: "Cliente: Hospital São Lucas - Valor: R$ 45.000",
    ipAddress: "192.168.1.105",
    timestamp: "2026-03-10T15:45:00",
  },
  {
    id: "log-14",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "update",
    module: "clients",
    description: "Atualizou dados do cliente 'Edifício Central Park'",
    details: "Alterou telefone e e-mail do responsável",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-10T14:20:00",
  },
  {
    id: "log-15",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "import",
    module: "templates",
    description: "Importou template 'Contrato Dedetização Industrial'",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-10T10:30:00",
  },
  {
    id: "log-16",
    userId: "emp9",
    userName: "Paula Santos",
    userRole: "Gerente",
    action: "delete",
    module: "agenda",
    description: "Cancelou agendamento #AGD-2026-089",
    details: "Motivo: Solicitação do cliente",
    ipAddress: "192.168.1.105",
    timestamp: "2026-03-10T09:15:00",
  },
  {
    id: "log-17",
    userId: "emp1",
    userName: "Carlos Silva",
    userRole: "Equipe Operacional",
    action: "login",
    module: "auth",
    description: "Realizou login no sistema",
    ipAddress: "192.168.1.110",
    timestamp: "2026-03-10T07:55:00",
  },
  {
    id: "log-18",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "create",
    module: "employees",
    description: "Cadastrou funcionário 'Ana Beatriz Souza'",
    details: "Perfil: Equipe Operacional",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-09T16:00:00",
  },
  {
    id: "log-19",
    userId: "emp9",
    userName: "Paula Santos",
    userRole: "Gerente",
    action: "update",
    module: "financial",
    description: "Registrou pagamento da parcela #3 do contrato DEP-2026-002",
    details: "Valor: R$ 2.500,00 - Método: PIX",
    ipAddress: "192.168.1.105",
    timestamp: "2026-03-09T14:30:00",
  },
  {
    id: "log-20",
    userId: "emp10",
    userName: "Melina Costa",
    userRole: "Administrador",
    action: "update",
    module: "settings",
    description: "Alterou configurações de notificação",
    details: "Habilitou notificação WhatsApp para agendamentos",
    ipAddress: "192.168.1.100",
    timestamp: "2026-03-09T11:10:00",
  },
]

const actionConfig: Record<LogAction, { label: string; color: string; icon: typeof Plus }> = {
  create: { label: "Criação", color: "bg-green-100 text-green-700", icon: Plus },
  update: { label: "Edição", color: "bg-blue-100 text-blue-700", icon: Edit },
  delete: { label: "Exclusão", color: "bg-red-100 text-red-700", icon: Trash2 },
  view: { label: "Visualização", color: "bg-gray-100 text-gray-700", icon: Eye },
  login: { label: "Login", color: "bg-emerald-100 text-emerald-700", icon: LogIn },
  logout: { label: "Logout", color: "bg-orange-100 text-orange-700", icon: LogOut },
  export: { label: "Exportação", color: "bg-purple-100 text-purple-700", icon: Download },
  import: { label: "Importação", color: "bg-cyan-100 text-cyan-700", icon: Download },
}

const moduleConfig: Record<LogModule, { label: string; icon: typeof User }> = {
  clients: { label: "Clientes", icon: Users },
  contracts: { label: "Contratos", icon: FileText },
  employees: { label: "Funcionários", icon: User },
  teams: { label: "Equipes", icon: Users },
  services: { label: "Serviços", icon: Wrench },
  agenda: { label: "Agenda", icon: Calendar },
  financial: { label: "Financeiro", icon: DollarSign },
  settings: { label: "Configurações", icon: Settings },
  templates: { label: "Templates", icon: FileText },
  auth: { label: "Autenticação", icon: Shield },
}

export function LogsContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [moduleFilter, setModuleFilter] = useState<string>("all")
  const [userFilter, setUserFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>()
    mockLogs.forEach(log => users.set(log.userId, log.userName))
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }))
  }, [])

  const filteredLogs = useMemo(() => {
    return mockLogs.filter(log => {
      const matchesSearch =
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details || "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesAction = actionFilter === "all" || log.action === actionFilter
      const matchesModule = moduleFilter === "all" || log.module === moduleFilter
      const matchesUser = userFilter === "all" || log.userId === userFilter

      let matchesDate = true
      if (dateFrom) {
        matchesDate = matchesDate && log.timestamp >= dateFrom
      }
      if (dateTo) {
        matchesDate = matchesDate && log.timestamp <= dateTo + "T23:59:59"
      }

      return matchesSearch && matchesAction && matchesModule && matchesUser && matchesDate
    })
  }, [searchTerm, actionFilter, moduleFilter, userFilter, dateFrom, dateTo])

  const totalPages = Math.ceil(filteredLogs.length / pageSize)
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, currentPage, pageSize])

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts)
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const clearFilters = () => {
    setSearchTerm("")
    setActionFilter("all")
    setModuleFilter("all")
    setUserFilter("all")
    setDateFrom("")
    setDateTo("")
    setCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || actionFilter !== "all" || moduleFilter !== "all" || userFilter !== "all" || dateFrom || dateTo

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar nos logs..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setCurrentPage(1) }}>
              <SelectTrigger>
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {Object.entries(actionConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setCurrentPage(1) }}>
              <SelectTrigger>
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {Object.entries(moduleConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setCurrentPage(1) }}>
              <SelectTrigger>
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
                className="text-xs"
                placeholder="De"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
                className="text-xs"
                placeholder="Até"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <div className="rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead className="min-w-[300px]">Descrição</TableHead>
              <TableHead className="hidden lg:table-cell">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Nenhum log encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((log) => {
                const action = actionConfig[log.action]
                const module = moduleConfig[log.module]
                const ActionIcon = action.icon
                const ModuleIcon = module.icon

                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{log.userName}</span>
                        <p className="text-[10px] text-muted-foreground">{log.userRole}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${action.color} gap-1 hover:${action.color.split(" ")[0]}`}>
                        <ActionIcon className="w-3 h-3" />
                        {action.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <ModuleIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        {module.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{log.description}</p>
                      {log.details && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{log.details}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                      {log.ipAddress}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DataPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredLogs.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
      />
    </div>
  )
}
