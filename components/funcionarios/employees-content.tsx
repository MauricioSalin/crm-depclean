"use client"

import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Edit, Eye, EyeOff, Mail, MoreHorizontal, Phone, Search, Shield, Trash2, User, UserCog, UserX, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DataPagination } from "@/components/ui/data-pagination"
import { CsvImportDialog, type CsvImportField } from "@/components/ui/csv-import-dialog"
import { TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { getApiErrorMessage } from "@/lib/api/errors"
import { resolveAvatarUrl } from "@/lib/avatar"
import { getStoredUser } from "@/lib/auth/session"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { formatCPF, formatPhone, isValidCPF } from "@/lib/masks"
import { getInitials } from "@/lib/utils"
import { listPermissionProfiles } from "@/lib/api/settings"
import {
  createEmployee,
  deactivateEmployee,
  deleteEmployee,
  listEmployeesPage,
  makeEmployeeSystemUser,
  revokeEmployeeSystemUser,
  updateEmployee,
  type EmployeePayload,
  type EmployeeRecord,
  type PaginatedEmployees,
} from "@/lib/api/employees"

interface EmployeesContentProps {
  viewMode: "table" | "cards"
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
  viewToggle?: React.ReactNode
  openImport?: boolean
  onImportChange?: (open: boolean) => void
}

function generatePassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%"
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

function hasSystemAccessContact(employee: Pick<EmployeeRecord, "email" | "phone"> | EmployeePayload) {
  return Boolean(employee.email?.trim() || employee.phone?.trim())
}

const EMPLOYEE_IMPORT_FIELDS: CsvImportField[] = [
  { key: "name", label: "Nome", required: true },
  { key: "email", label: "E-mail", required: false },
  { key: "cpf", label: "CPF", required: true },
  { key: "phone", label: "Telefone" },
  { key: "role", label: "Cargo" },
  { key: "status", label: "Status" },
]

export function EmployeesContent({ viewMode, openDialog, onDialogChange, viewToggle, openImport = false, onImportChange }: EmployeesContentProps) {
  const queryClient = useQueryClient()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(() => getStoredUser())
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null)
  const [systemUserEmployee, setSystemUserEmployee] = useState<EmployeeRecord | null>(null)
  const [pendingAction, setPendingAction] = useState<
    | { kind: "deactivate"; id: string; label: string }
    | { kind: "delete"; id: string; label: string }
    | { kind: "revoke"; id: string; label: string }
    | null
  >(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const deferredSearchTerm = useDeferredValue(searchTerm)
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

  const canManageSettings = Boolean(currentUser?.permissions.includes("settings_manage"))
  const shouldLoadPermissionProfiles = canManageSettings && (isDialogOpen || isSystemUserDialogOpen || createSystemUser)

  const employeesQuery = useQuery({
    queryKey: ["employees", "page", deferredSearchTerm, statusFilter, currentPage, pageSize],
    queryFn: () => listEmployeesPage({
      search: deferredSearchTerm,
      status: statusFilter === "all" ? undefined : (statusFilter as "active" | "inactive"),
      page: currentPage,
      limit: pageSize,
    }),
    enabled: Boolean(currentUser),
    staleTime: 60_000,
  })

  const permissionProfilesQuery = useQuery({
    queryKey: ["settings", "permission-profiles", "employees"],
    queryFn: () => listPermissionProfiles(""),
    enabled: shouldLoadPermissionProfiles,
    staleTime: 5 * 60_000,
  })

  const employeesPage = employeesQuery.data?.data
  const employees = employeesPage?.items ?? []
  const permissionProfiles = permissionProfilesQuery.data?.data.items ?? []
  const loading = employeesQuery.isLoading && !employeesQuery.data

  const refreshEmployees = async () => {
    await queryClient.invalidateQueries({ queryKey: ["employees"] })
  }

  const updateEmployeeQueries = (updater: (items: EmployeeRecord[]) => EmployeeRecord[]) => {
    queryClient.setQueriesData<{ success: true; data: EmployeeRecord[] | PaginatedEmployees }>(
      { queryKey: ["employees"] },
      (current) => {
        if (!current) return current
        if (Array.isArray(current.data)) {
          return { ...current, data: updater(current.data) }
        }
        if (Array.isArray(current.data.items)) {
          return { ...current, data: { ...current.data, items: updater(current.data.items) } }
        }
        return current
      },
    )
  }

  const importEmployees = async (rows: Array<Record<string, string>>) => {
    try {
      for (const row of rows) {
        await createEmployee({
          name: row.name,
          email: row.email,
          cpf: row.cpf,
          phone: row.phone,
          role: row.role,
          status: row.status?.toLowerCase() === "inactive" || row.status?.toLowerCase() === "inativo" ? "inactive" : "active",
        })
      }
      await refreshEmployees()
      toast.success("Funcionários importados.", {
        description: `${rows.length} registro(s) foram inseridos no banco de dados.`,
      })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível importar os funcionários."))
      throw error
    }
  }

  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser())
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  useEffect(() => {
    if (employeesQuery.isError) {
      toast.error(getApiErrorMessage(employeesQuery.error, "Não foi possível carregar os funcionários."))
    }
  }, [employeesQuery.error, employeesQuery.isError])

  useEffect(() => {
    if (permissionProfiles.length === 0 || (!createSystemUser && !isSystemUserDialogOpen)) return
    setSystemUserForm((current) => (
      current.permissionProfileId ? current : { ...current, permissionProfileId: permissionProfiles[0].id }
    ))
  }, [createSystemUser, isSystemUserDialogOpen, permissionProfiles.length, permissionProfiles[0]?.id])

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

  const totalItems = employeesPage?.total ?? 0
  const totalPages = employeesPage?.totalPages ?? 1
  const paginatedEmployees = employees

  const canDeleteEmployees = Boolean(
    currentUser?.permissions.includes("employees_delete") || currentUser?.permissions.includes("settings_manage"),
  )
  const canEditEmployees = Boolean(
    currentUser?.permissions.includes("employees_edit") || currentUser?.permissions.includes("settings_manage"),
  )
  const canManageEmployeeSystemAccess = canManageSettings

  const upsertEmployee = (record: EmployeeRecord) => {
    updateEmployeeQueries((current) => current.some((item) => item.id === record.id)
      ? current.map((item) => (item.id === record.id ? record : item))
      : [...current, record])
    void refreshEmployees()
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

    if (target.kind === "delete") {
      await handleDelete(target.id)
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
      if (!hasSystemAccessContact(formData)) {
        toast.error("Informe um e-mail ou telefone/WhatsApp para criar usuário do sistema.")
        return
      }
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
      updateEmployeeQueries((current) => current.map((item) => item.id === id ? { ...item, status: "inactive", isSystemUser: item.isSystemUser } : item))
      void refreshEmployees()
      toast.success("Funcionário inativado.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível inativar o funcionário."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (saving) return
    setSaving(true)
    const toastId = toast.loading("Excluindo funcionário...")
    try {
      await deleteEmployee(id)
      updateEmployeeQueries((current) => current.filter((item) => item.id !== id))
      void refreshEmployees()
      toast.success("Funcionário excluído.", { id: toastId })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir o funcionário."), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleMakeSystemUser = (employee: EmployeeRecord) => {
    if (!hasSystemAccessContact(employee)) {
      toast.error("Informe um e-mail ou telefone/WhatsApp no cadastro antes de transformar em usuário do sistema.")
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
    if (!hasSystemAccessContact(systemUserEmployee)) {
      toast.error("Informe um e-mail ou telefone/WhatsApp no cadastro antes de transformar em usuário do sistema.")
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
        <Select
          value={systemUserForm.permissionProfileId}
          onValueChange={(value) => setSystemUserForm({ ...systemUserForm, permissionProfileId: value })}
          disabled={permissionProfilesQuery.isLoading || permissionProfiles.length === 0}
        >
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
      <CsvImportDialog
        open={openImport}
        onOpenChange={(open) => onImportChange?.(open)}
        title="Importar funcionários"
        description="Mapeie as colunas do CSV antes de inserir os funcionários."
        fields={EMPLOYEE_IMPORT_FIELDS}
        onImport={importEmployees}
      />

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(90dvh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <form autoComplete="off" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <DialogTitle>{editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="-mr-2 rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Fechar"
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="employee-name">Nome Completo *</Label>
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
                  placeholder="Ex: mauricio@depcleanrs.com.br"
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
            </div>
            <div className="shrink-0 bg-background px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => handleDialogChange(false)} disabled={saving}>Cancelar</Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
                  {saving ? "Salvando..." : editingEmployee ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
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

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className={`${mobileFiltersOpen ? "grid" : "hidden"} -m-1 shrink-0 grid-cols-2 gap-2 overflow-visible p-1 sm:flex sm:items-center`}>
          <div className="relative focus-within:z-[70] sm:w-80">
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
          <div className="rounded-md md:min-h-0 md:flex-1 md:overflow-hidden">
            <Table containerClassName="md:h-full">
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
                  paginatedEmployees.map((employee) => {
                    const canShowDeleteEmployee = canDeleteEmployees && currentUser?.employeeId !== employee.id
                    const canShowEmployeeActions = canManageEmployeeSystemAccess || canEditEmployees || canShowDeleteEmployee

                    return (
                    <TableRow key={employee.id}>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/10">
                            <AvatarImage src={resolveAvatarUrl(employee.avatar)} alt={employee.name} />
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {getInitials(employee.name)}
                            </AvatarFallback>
                          </Avatar>
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
                        {canShowEmployeeActions ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(event) => event.stopPropagation()}
                                aria-label="Ações do funcionário"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            {canManageEmployeeSystemAccess && !employee.isSystemUser ? (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleMakeSystemUser(employee)
                                }}
                              >
                                <UserCog className="mr-2 h-4 w-4" />
                                Tornar usuário
                              </DropdownMenuItem>
                            ) : canManageEmployeeSystemAccess ? (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setPendingAction({ kind: "revoke", id: employee.id, label: employee.name })
                                }}
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Remover acesso
                              </DropdownMenuItem>
                            ) : null}
                            {canEditEmployees ? (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleEdit(employee)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            ) : null}
                            {canEditEmployees && employee.status === "active" ? (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setPendingAction({ kind: "deactivate", id: employee.id, label: employee.name })
                                }}
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Inativar
                              </DropdownMenuItem>
                            ) : null}
                            {canShowDeleteEmployee ? (
                              <DropdownMenuItem
                                className="cursor-pointer text-destructive focus:text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setPendingAction({ kind: "delete", id: employee.id, label: employee.name })
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {loading ? (
                <CardSkeletonGrid cards={4} />
              ) : paginatedEmployees.map((employee) => {
                const canShowDeleteEmployee = canDeleteEmployees && currentUser?.employeeId !== employee.id
                const canShowEmployeeActions = canManageEmployeeSystemAccess || canEditEmployees || canShowDeleteEmployee

                return (
                <Card key={employee.id} className="h-full overflow-hidden">
                  <CardContent className="flex h-full flex-col px-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/10">
                          <AvatarImage src={resolveAvatarUrl(employee.avatar)} alt={employee.name} />
                          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                            {getInitials(employee.name)}
                          </AvatarFallback>
                        </Avatar>
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

                    {canShowEmployeeActions ? (
                      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      {canManageEmployeeSystemAccess && !employee.isSystemUser ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="col-span-2 h-8 rounded-full"
                          onClick={() => handleMakeSystemUser(employee)}
                        >
                          <UserCog className="mr-2 h-4 w-4" />
                          Tornar usuário
                        </Button>
                      ) : canManageEmployeeSystemAccess ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="col-span-2 h-8 rounded-full"
                          onClick={() => setPendingAction({ kind: "revoke", id: employee.id, label: employee.name })}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Remover acesso
                        </Button>
                      ) : null}
                      {canEditEmployees ? (
                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" onClick={() => handleEdit(employee)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                      ) : null}
                      {canEditEmployees && employee.status === "active" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => setPendingAction({ kind: "deactivate", id: employee.id, label: employee.name })}
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Inativar
                        </Button>
                      ) : null}
                      {canShowDeleteEmployee ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="col-span-2 h-8 rounded-full text-destructive hover:text-destructive"
                          onClick={() => setPendingAction({ kind: "delete", id: employee.id, label: employee.name })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                )
              })}
            </div>
          </div>
        )}

        {!loading ? (
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
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
          title={
            pendingAction?.kind === "deactivate"
              ? "Inativar funcionário"
              : pendingAction?.kind === "delete"
                ? "Excluir funcionário"
                : "Remover acesso de usuário"
          }
          description={
            pendingAction?.kind === "deactivate"
              ? `Esta ação vai inativar o funcionário "${pendingAction.label}".`
              : pendingAction?.kind === "delete"
                ? `Esta ação vai excluir definitivamente o funcionário "${pendingAction.label}" e remover o acesso de usuário vinculado.`
                : `Esta ação vai remover o acesso de usuário de "${pendingAction?.label}".`
          }
          confirmLabel={
            pendingAction?.kind === "deactivate"
              ? "Inativar"
              : pendingAction?.kind === "delete"
                ? "Excluir"
                : "Remover acesso"
          }
          onConfirm={confirmPendingAction}
          busy={saving}
        />
      </div>
    </>
  )
}

