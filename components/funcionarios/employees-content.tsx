"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Copy, Edit, Eye, EyeOff, Mail, Phone, Search, Shield, Trash2, User, UserCog } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DataPagination } from "@/components/ui/data-pagination"
import { TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { getApiErrorMessage } from "@/lib/api/errors"
import { getStoredUser } from "@/lib/auth/session"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { formatCPF, formatPhone, isValidCPF } from "@/lib/masks"
import { getSettings, type PermissionProfileRecord } from "@/lib/api/settings"
import {
  createEmployee,
  deactivateEmployee,
  listEmployees,
  makeEmployeeSystemUser,
  revokeEmployeeSystemUser,
  updateEmployee,
  type EmployeePayload,
  type EmployeeRecord,
} from "@/lib/api/employees"

interface EmployeesContentProps {
  viewMode: "table" | "cards"
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
  viewToggle?: React.ReactNode
}

function generatePassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%"
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

export function EmployeesContent({ viewMode, openDialog, onDialogChange, viewToggle }: EmployeesContentProps) {
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null)
  const [systemUserEmployee, setSystemUserEmployee] = useState<EmployeeRecord | null>(null)
  const [pendingAction, setPendingAction] = useState<
    | { kind: "deactivate"; id: string; label: string }
    | { kind: "revoke"; id: string; label: string }
    | null
  >(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const dialogResetTimeoutRef = useRef<number | null>(null)
  const systemUserDialogResetTimeoutRef = useRef<number | null>(null)
  const [isSystemUserDialogOpen, setIsSystemUserDialogOpen] = useState(false)

  const [formData, setFormData] = useState<EmployeePayload>({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    role: "",
    status: "active",
  })

  const [systemUserForm, setSystemUserForm] = useState({
    password: "",
    permissionProfileId: "",
  })
  const [createSystemUser, setCreateSystemUser] = useState(false)
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false)

  const refreshEmployees = async () => {
    setLoading(true)
    try {
      const employeesResponse = await listEmployees(searchTerm)
      setEmployees(employeesResponse.data)
      const currentUser = getStoredUser()
      if (currentUser?.permissions.includes("settings_manage")) {
        const settingsResponse = await getSettings()
        setPermissionProfiles(settingsResponse.data.permissionProfiles)
      } else {
        setPermissionProfiles([])
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível carregar os funcionários."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshEmployees()
  }, [])

  useEffect(() => {
    if (openDialog !== undefined) {
      if (openDialog) {
        clearDialogResetTimeout()
        resetEmployeeFormFields()
        setIsDialogOpen(true)
      } else {
        closeEmployeeDialog()
      }
      onDialogChange?.(openDialog)
    }
  }, [openDialog])

  useEffect(() => {
    return () => {
      clearDialogResetTimeout()
      clearSystemUserDialogResetTimeout()
    }
  }, [])

  const clearDialogResetTimeout = () => {
    if (dialogResetTimeoutRef.current) {
      window.clearTimeout(dialogResetTimeoutRef.current)
      dialogResetTimeoutRef.current = null
    }
  }

  const clearSystemUserDialogResetTimeout = () => {
    if (systemUserDialogResetTimeoutRef.current) {
      window.clearTimeout(systemUserDialogResetTimeoutRef.current)
      systemUserDialogResetTimeoutRef.current = null
    }
  }

  const resetEmployeeFormFields = () => {
    setEditingEmployee(null)
    setFormData({ name: "", email: "", phone: "", cpf: "", role: "", status: "active" })
    resetSystemUserForm()
  }

  const closeEmployeeDialog = () => {
    setIsDialogOpen(false)
    clearDialogResetTimeout()
    dialogResetTimeoutRef.current = window.setTimeout(() => {
      resetEmployeeFormFields()
      dialogResetTimeoutRef.current = null
    }, 200)
  }

  const handleDialogChange = (open: boolean) => {
    if (open) {
      clearDialogResetTimeout()
      setIsDialogOpen(true)
      onDialogChange?.(true)
      return
    }

    closeEmployeeDialog()
    onDialogChange?.(false)
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch = [employee.name, employee.email, employee.cpf, employee.role].join(" ").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [employees, searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize))
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredEmployees.slice(start, start + pageSize)
  }, [filteredEmployees, currentPage, pageSize])

  const upsertEmployee = (record: EmployeeRecord) => {
    setEmployees((current) => current.some((item) => item.id === record.id)
      ? current.map((item) => (item.id === record.id ? record : item))
      : [...current, record])
  }

  const resetSystemUserForm = () => {
    setCreateSystemUser(false)
    setShowTemporaryPassword(false)
    setSystemUserForm({ password: "", permissionProfileId: permissionProfiles[0]?.id ?? "" })
  }

  const prepareSystemUserForm = () => {
    setSystemUserForm((current) => ({
      password: current.password || generatePassword(),
      permissionProfileId: current.permissionProfileId || permissionProfiles[0]?.id || "",
    }))
    setShowTemporaryPassword(false)
  }

  const generateSystemUserPassword = () => {
    setSystemUserForm((current) => ({ ...current, password: generatePassword() }))
    setShowTemporaryPassword(true)
  }

  const copySystemUserPassword = async () => {
    if (!systemUserForm.password) return
    await navigator.clipboard.writeText(systemUserForm.password)
    toast.success("Senha copiada.")
  }

  const handleCreateSystemUserChange = (checked: boolean | "indeterminate") => {
    const nextChecked = checked === true
    setCreateSystemUser(nextChecked)
    if (nextChecked) {
      prepareSystemUserForm()
    } else {
      resetSystemUserForm()
    }
  }

  const confirmPendingAction = async () => {
    if (!pendingAction) return
    const target = pendingAction
    setPendingAction(null)

    if (target.kind === "deactivate") {
      await handleDeactivate(target.id)
      return
    }

    await handleRevokeSystemUser(target.id)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    if (!isValidCPF(formData.cpf)) {
      toast.error("Informe um CPF válido para o funcionário.")
      return
    }

    if (!editingEmployee && createSystemUser) {
      if (permissionProfiles.length === 0) {
        toast.error("Não há perfis de permissão disponíveis para vincular.")
        return
      }
      if (!systemUserForm.permissionProfileId) {
        toast.error("Selecione um perfil de permissão.")
        return
      }
      if (!systemUserForm.password.trim()) {
        toast.error("Informe uma senha ou gere uma nova senha.")
        return
      }
    }

    setSaving(true)
    const toastId = toast.loading(editingEmployee ? "Salvando funcionário..." : "Cadastrando funcionário...")
    try {
      if (editingEmployee) {
        const response = await updateEmployee(editingEmployee.id, formData)
        upsertEmployee(response.data)
        toast.success("Funcionário atualizado.", { id: toastId })
      } else {
        const response = await createEmployee(formData)
        if (createSystemUser) {
          try {
            const systemUserResponse = await makeEmployeeSystemUser(response.data.id, {
              password: systemUserForm.password.trim(),
              permissionProfileId: systemUserForm.permissionProfileId,
            })
            upsertEmployee(systemUserResponse.data)
            toast.success("Funcionário e usuário do sistema criados.", { id: toastId })
          } catch (systemUserError) {
            upsertEmployee(response.data)
            handleDialogChange(false)
            toast.error(getApiErrorMessage(systemUserError, "Funcionário criado, mas não foi possível criar o usuário do sistema."), { id: toastId })
            return
          }
        } else {
          upsertEmployee(response.data)
          toast.success("Funcionário criado.", { id: toastId })
        }
      }
      handleDialogChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível salvar o funcionário."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (employee: EmployeeRecord) => {
    clearDialogResetTimeout()
    setEditingEmployee(employee)
    resetSystemUserForm()
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: formatPhone(employee.phone),
      cpf: formatCPF(employee.cpf),
      role: employee.role,
      status: employee.status,
    })
    setIsDialogOpen(true)
  }

  const handleDeactivate = async (id: string) => {
    if (saving) return
    setSaving(true)
    const toastId = toast.loading("Inativando funcionário...")
    try {
      await deactivateEmployee(id)
      setEmployees((current) => current.map((item) => item.id === id ? { ...item, status: "inactive", isSystemUser: item.isSystemUser } : item))
      toast.success("Funcionário inativado.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível inativar o funcionário."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleMakeSystemUser = (employee: EmployeeRecord) => {
    if (permissionProfiles.length === 0) {
      toast.error("Não há perfis de permissão disponíveis para vincular.")
      return
    }
    clearSystemUserDialogResetTimeout()
    setSystemUserEmployee(employee)
    setSystemUserForm({ password: generatePassword(), permissionProfileId: permissionProfiles[0]?.id ?? "" })
    setShowTemporaryPassword(false)
    setIsSystemUserDialogOpen(true)
  }

  const closeSystemUserDialog = () => {
    setIsSystemUserDialogOpen(false)
    clearSystemUserDialogResetTimeout()
    systemUserDialogResetTimeoutRef.current = window.setTimeout(() => {
      setSystemUserEmployee(null)
      resetSystemUserForm()
      systemUserDialogResetTimeoutRef.current = null
    }, 200)
  }

  const submitSystemUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (!systemUserEmployee) return
    if (!systemUserForm.permissionProfileId) {
      toast.error("Selecione um perfil de permissão.")
      return
    }
    if (!systemUserForm.password.trim()) {
      toast.error("Informe uma senha ou gere uma nova senha.")
      return
    }
    setSaving(true)
    const toastId = toast.loading("Criando acesso do sistema...")
    try {
      const response = await makeEmployeeSystemUser(systemUserEmployee.id, {
        password: systemUserForm.password.trim(),
        permissionProfileId: systemUserForm.permissionProfileId,
      })
      upsertEmployee(response.data)
      toast.success("Funcionário promovido a usuário do sistema.", { id: toastId })
      closeSystemUserDialog()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível transformar em usuário."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleRevokeSystemUser = async (id: string) => {
    if (saving) return
    setSaving(true)
    const toastId = toast.loading("Removendo acesso...")
    try {
      const response = await revokeEmployeeSystemUser(id)
      upsertEmployee(response.data)
      toast.success("Acesso removido.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível remover o acesso."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ativo</Badge>
    }

    return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Inativo</Badge>
  }

  const renderSystemUserFields = (passwordInputId: string) => (
    <>
      <div className="space-y-2">
        <Label htmlFor={passwordInputId}>Senha temporária</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id={passwordInputId}
              type={showTemporaryPassword ? "text" : "password"}
              value={systemUserForm.password}
              onChange={(event) => setSystemUserForm({ ...systemUserForm, password: event.target.value })}
              placeholder="Senha temporária"
              className="pr-20"
              required
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowTemporaryPassword((value) => !value)} className="h-8 w-8">
                {showTemporaryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={copySystemUserPassword} className="h-8 w-8">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={generateSystemUserPassword}>
            Gerar senha
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Perfil de permissão</Label>
        <Select value={systemUserForm.permissionProfileId} onValueChange={(value) => setSystemUserForm({ ...systemUserForm, permissionProfileId: value })}>
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
    </>
  )

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
          </DialogHeader>
          <form autoComplete="off" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="employee-name">Nome Completo</Label>
                <Input
                  id="employee-name"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  placeholder="Ex: Maurício Salin"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-cpf">CPF *</Label>
                <Input
                  id="employee-cpf"
                  value={formData.cpf}
                  onChange={(event) => setFormData({ ...formData, cpf: formatCPF(event.target.value) })}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-phone">Telefone</Label>
                <Input
                  id="employee-phone"
                  value={formData.phone ?? ""}
                  onChange={(event) => setFormData({ ...formData, phone: formatPhone(event.target.value) })}
                  placeholder="(51) 99999-9999"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="employee-email">E-mail</Label>
                <Input
                  id="employee-email"
                  type="email"
                  autoComplete="off"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  placeholder="Ex: mauricio@depclean.com"
                  required
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="employee-role">Cargo</Label>
                <Input id="employee-role" value={formData.role ?? ""} onChange={(event) => setFormData({ ...formData, role: event.target.value })} placeholder="Ex: Administradora, Técnico, Assistente" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Status</Label>
                <Select value={formData.status ?? "active"} onValueChange={(value) => setFormData({ ...formData, status: value as "active" | "inactive" })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!editingEmployee && permissionProfiles.length > 0 && (
                <div className="sm:col-span-2 space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="employee-create-system-user"
                      checked={createSystemUser}
                      onCheckedChange={handleCreateSystemUserChange}
                    />
                    <Label htmlFor="employee-create-system-user" className="cursor-pointer">
                      Criar usuário do sistema
                    </Label>
                  </div>
                  {createSystemUser && renderSystemUserFields("employee-system-user-password")}
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => handleDialogChange(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
                {saving ? "Salvando..." : editingEmployee ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSystemUserDialogOpen} onOpenChange={(open) => !open && closeSystemUserDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transformar em usuário do sistema</DialogTitle>
          </DialogHeader>
          <form autoComplete="off" onSubmit={submitSystemUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Input value={systemUserEmployee?.name ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={systemUserEmployee?.cpf ? formatCPF(systemUserEmployee.cpf) : ""} disabled />
            </div>
            {renderSystemUserFields("existing-employee-system-user-password")}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeSystemUserDialog} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Criando..." : "Criar usuário"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className={`${mobileFiltersOpen ? "grid" : "hidden"} grid-cols-2 gap-2 sm:flex sm:items-center`}>
            <div className="relative sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail, CPF ou cargo..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10"
              />
            </div>
            <SearchableSelect
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setCurrentPage(1)
              }}
              options={[
                { value: "active", label: "Ativos" },
                { value: "inactive", label: "Inativos" },
              ]}
              placeholder="Status"
              searchPlaceholder="Buscar status..."
              allLabel="Todos"
              className="sm:w-[140px]"
            />
            {viewToggle && <div className="hidden shrink-0 sm:block">{viewToggle}</div>}
          </div>

        {viewMode === "table" ? (
          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Funcionário</TableHead>
                  <TableHead className="hidden min-w-[150px] md:table-cell">CPF</TableHead>
                  <TableHead className="hidden sm:table-cell">Cargo</TableHead>
                  <TableHead className="hidden lg:table-cell">Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sistema</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeletonRows
                    rows={5}
                    columns={[
                      { withIcon: true, width: "w-36" },
                      { className: "hidden md:table-cell", width: "w-28" },
                      { className: "hidden sm:table-cell", width: "w-24" },
                      { className: "hidden lg:table-cell", width: "w-40" },
                      { width: "w-16" },
                      { width: "w-28" },
                      { align: "right", width: "w-20" },
                    ]}
                  />
                ) : paginatedEmployees.length === 0 ? (
                  <TableEmptyState colSpan={7} icon={User} title="Nenhum funcionário encontrado." />
                ) : (
                  paginatedEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium">{employee.name}</div>
                            <div className="text-xs text-muted-foreground sm:hidden">{employee.role || "-"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden min-w-[150px] whitespace-nowrap font-mono text-sm md:table-cell">{formatCPF(employee.cpf)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{employee.role || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {employee.phone || "-"}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {employee.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(employee.status)}</TableCell>
                      <TableCell>
                        {employee.isSystemUser ? (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Usuário do sistema</Badge>
                        ) : (
                          <Badge variant="outline">Somente funcionário</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!employee.isSystemUser ? (
                            <Button variant="ghost" size="icon" onClick={() => handleMakeSystemUser(employee)} title="Tornar usuário do sistema">
                              <UserCog className="h-4 w-4" />
                            </Button>
                          ) : (
                        <Button variant="ghost" size="icon" onClick={() => setPendingAction({ kind: "revoke", id: employee.id, label: employee.name })} title="Remover acesso">
                          <Shield className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(employee)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setPendingAction({ kind: "deactivate", id: employee.id, label: employee.name })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {loading ? (
              <CardSkeletonGrid cards={4} />
            ) : paginatedEmployees.map((employee) => (
              <Card key={employee.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{employee.name}</h3>
                        <p className="text-sm text-muted-foreground">{employee.role || "-"}</p>
                      </div>
                    </div>
                    {getStatusBadge(employee.status)}
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="font-mono">{formatCPF(employee.cpf)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{employee.phone || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {employee.isSystemUser ? (
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Usuário do sistema</Badge>
                    ) : (
                      <Badge variant="outline">Somente funcionário</Badge>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    {!employee.isSystemUser ? (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleMakeSystemUser(employee)}>
                        <UserCog className="mr-1 h-4 w-4" />
                        Tornar usuário
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setPendingAction({ kind: "revoke", id: employee.id, label: employee.name })}>
                        <Shield className="mr-1 h-4 w-4 text-destructive" />
                        Remover acesso
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(employee)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPendingAction({ kind: "deactivate", id: employee.id, label: employee.name })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      {!loading ? (
        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredEmployees.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCurrentPage(1)
          }}
        />
      ) : null}

      <ConfirmActionDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null)
          }
        }}
        title={pendingAction?.kind === "deactivate" ? "Inativar funcionário" : "Remover acesso de usuário"}
        description={
          pendingAction?.kind === "deactivate"
            ? `Esta ação vai inativar o funcionário "${pendingAction.label}".`
            : `Esta ação vai remover o acesso de usuário de "${pendingAction?.label}".`
        }
        confirmLabel={pendingAction?.kind === "deactivate" ? "Inativar" : "Remover acesso"}
        onConfirm={confirmPendingAction}
        busy={saving}
      />
    </div>
  </>
)
}
