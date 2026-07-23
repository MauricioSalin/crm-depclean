"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Edit, MoreHorizontal, Search, Trash2, Users, X } from "lucide-react"

import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { FilterSearchInput } from "@/components/ui/filter-search-input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataPagination } from "@/components/ui/data-pagination"
import { EmptyState, TableEmptyState } from "@/components/ui/empty-state"
import { CardSkeletonGrid, TableSkeletonRows } from "@/components/ui/table-skeleton"
import { toast } from "@/components/ui/use-toast"
import { listEmployees, type EmployeeRecord } from "@/lib/api/employees"
import { getApiErrorMessage } from "@/lib/api/errors"
import { createTeam, deleteTeam, listTeams, updateTeam, type TeamRecord } from "@/lib/api/teams"
import { useMobileFiltersOpen } from "@/lib/hooks/use-mobile-filters"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { cn } from "@/lib/utils"
import { useHasAnyPermission } from "@/hooks/use-permissions"

type TeamView = TeamRecord & {
  members: EmployeeRecord[]
}

interface TeamsContentProps {
  viewMode: "grid" | "table"
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
  viewToggle?: React.ReactNode
}

export function TeamsContent({ viewMode, openDialog, onDialogChange, viewToggle }: TeamsContentProps) {
  const queryClient = useQueryClient()
  const mobileFiltersOpen = useMobileFiltersOpen()
  const canManageTeams = useHasAnyPermission(["teams_manage"])
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamView | null>(null)
  const [memberSearchOpen, setMemberSearchOpen] = useState(false)
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const dialogResetTimeoutRef = useRef<number | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    color: "#84cc16",
    memberIds: [] as string[],
  })

  const teamsQuery = useQuery({
    queryKey: ["teams", "list", searchTerm],
    queryFn: () => listTeams(searchTerm),
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "catalog"],
    queryFn: () => listEmployees(""),
  })

  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []

  const teamsView = useMemo<TeamView[]>(() => {
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))
    return teams.map((team) => ({
      ...team,
      members: team.memberIds.map((memberId) => employeeMap.get(memberId)).filter(Boolean) as EmployeeRecord[],
    }))
  }, [employees, teams])

  useEffect(() => {
    if (openDialog) {
      clearDialogResetTimeout()
      resetFormFields()
      setIsDialogOpen(true)
      onDialogChange?.(false)
    }
  }, [onDialogChange, openDialog])

  useEffect(() => {
    return () => clearDialogResetTimeout()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const totalPages = Math.max(1, Math.ceil(teamsView.length / pageSize))
  const paginatedTeams = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return teamsView.slice(start, start + pageSize)
  }, [currentPage, pageSize, teamsView])

  const availableEmployees = useMemo(() => employees.filter((employee) => employee.status === "active"), [employees])
  const filteredAvailableEmployees = useMemo(
    () =>
      availableEmployees.filter((employee) =>
        employee.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
        employee.role.toLowerCase().includes(memberSearchTerm.toLowerCase()),
      ),
    [availableEmployees, memberSearchTerm],
  )

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      toast({ title: "Equipe criada", description: "A equipe foi salva com sucesso." })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      closeDialog()
    },
    onError: (error) => {
      toast({
        title: getApiErrorMessage(error, "Não foi possível criar a equipe."),
        variant: "destructive",
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTeam>[1] }) => updateTeam(id, payload),
    onSuccess: () => {
      toast({ title: "Equipe atualizada", description: "As alterações foram salvas com sucesso." })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      closeDialog()
    },
    onError: (error) => {
      toast({
        title: getApiErrorMessage(error, "Não foi possível atualizar a equipe."),
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      toast({ title: "Equipe excluída", description: "A equipe foi removida com sucesso." })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      setPendingDelete(null)
    },
    onError: (error) => {
      toast({
        title: getApiErrorMessage(error, "Não foi possível excluir a equipe."),
        variant: "destructive",
      })
    },
  })

  const busy = createMutation.isPending || updateMutation.isPending

  function clearDialogResetTimeout() {
    if (dialogResetTimeoutRef.current) {
      window.clearTimeout(dialogResetTimeoutRef.current)
      dialogResetTimeoutRef.current = null
    }
  }

  function resetFormFields() {
    setFormData({ name: "", color: "#84cc16", memberIds: [] })
    setEditingTeam(null)
    setMemberSearchTerm("")
    setMemberSearchOpen(false)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    clearDialogResetTimeout()
    dialogResetTimeoutRef.current = window.setTimeout(() => {
      resetFormFields()
      dialogResetTimeoutRef.current = null
    }, 200)
  }

  function handleDialogChange(open: boolean) {
    if (open) {
      clearDialogResetTimeout()
      setIsDialogOpen(true)
      return
    }

    closeDialog()
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return

    const payload = {
      name: formData.name.trim(),
      color: formData.color,
      memberIds: formData.memberIds,
      description: "",
    }

    if (!payload.name) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome da equipe.",
        variant: "destructive",
      })
      return
    }

    if (!/^#[0-9a-f]{6}$/i.test(payload.color)) {
      toast({
        title: "Cor inválida",
        description: "Informe uma cor hexadecimal válida no formato #RRGGBB.",
        variant: "destructive",
      })
      return
    }

    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, payload })
      return
    }

    createMutation.mutate(payload)
  }

  function handleEdit(team: TeamView) {
    clearDialogResetTimeout()
    setEditingTeam(team)
    setFormData({
      name: team.name,
      color: team.color,
      memberIds: team.memberIds,
    })
    setIsDialogOpen(true)
  }

  function toggleMember(employeeId: string) {
    setFormData((current) => ({
      ...current,
      memberIds: current.memberIds.includes(employeeId)
        ? current.memberIds.filter((id) => id !== employeeId)
        : [...current.memberIds, employeeId],
    }))
  }

  function confirmDelete() {
    if (!pendingDelete) return
    if (deleteMutation.isPending) return
    deleteMutation.mutate(pendingDelete.id)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
          </DialogHeader>

          <form autoComplete="off" noValidate onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="team-name">Nome da Equipe</Label>
              <Input
                id="team-name"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ex: Equipe Alpha"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-color">Cor</Label>
              <div className="flex gap-2">
                <Input
                  id="team-color"
                  type="color"
                  value={formData.color}
                  onChange={(event) => setFormData((current) => ({ ...current, color: event.target.value }))}
                  className="h-10 w-16 p-1"
                />
                <Input
                  value={formData.color}
                  onChange={(event) => setFormData((current) => ({ ...current, color: event.target.value }))}
                  className="flex-1 font-mono"
                  placeholder="#84cc16"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Membros</Label>
              <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    <span className="text-muted-foreground">Buscar e adicionar membros...</span>
                    <Search className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar funcionário..."
                      value={memberSearchTerm}
                      onValueChange={setMemberSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {filteredAvailableEmployees.map((employee) => (
                          <CommandItem
                            key={employee.id}
                            value={employee.name}
                            onSelect={() => toggleMember(employee.id)}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.memberIds.includes(employee.id) ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{employee.name}</span>
                              <span className="text-sm text-muted-foreground">{employee.role}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {formData.memberIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.memberIds.map((memberId) => {
                    const employee = employees.find((item) => item.id === memberId)
                    if (!employee) return null
                    const employeeDisplayName = employee.name.split(" ").slice(0, 2).join(" ")
                    return (
                      <Badge key={memberId} variant="outline" className="flex items-center gap-1.5 text-xs">
                        <span>{employeeDisplayName}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => toggleMember(memberId)}
                          aria-label={`Remover ${employeeDisplayName}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={closeDialog} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
                {busy ? "Salvando..." : editingTeam ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Excluir equipe"
        description={`Esta ação vai excluir a equipe "${pendingDelete?.label}".`}
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        busy={deleteMutation.isPending}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className={`${mobileFiltersOpen ? "flex" : "hidden"} -m-1 shrink-0 items-center gap-2 overflow-visible p-1 sm:flex`}>
          <FilterSearchInput
            wrapperClassName="w-full sm:max-w-sm"
            placeholder="Buscar equipes..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
        </div>

        {viewMode === "grid" ? (
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {teamsQuery.isLoading ? (
              <CardSkeletonGrid cards={4} />
            ) : teamsView.length === 0 ? (
              <EmptyState icon={Users} title="Nenhuma equipe encontrada." className="sm:col-span-2" />
            ) : paginatedTeams.map((team) => (
              <Card key={team.id} className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${team.color}1A` }}
                      >
                        <Users className="h-5 w-5" style={{ color: team.color }} />
                      </div>
                      <CardTitle className="text-base leading-tight">{team.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{team.members.length} membros</span>
                    </div>

                    <div className="relative flex max-h-[52px] flex-wrap gap-1.5 overflow-hidden">
                      {team.members.map((member) => (
                        <Badge key={member.id} variant="outline" className="text-xs">
                          {member.name.split(" ").slice(0, 2).join(" ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {canManageTeams ? (
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" onClick={() => handleEdit(team)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete({ id: team.id, label: team.name })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md md:min-h-0 md:flex-1 md:overflow-hidden">
            <Table containerClassName="md:h-full" onSortChange={() => setCurrentPage(1)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead className="hidden sm:table-cell">Membros</TableHead>
                  <TableHead className="hidden md:table-cell">Integrantes</TableHead>
                  {canManageTeams ? <TableHead className="text-right">Ações</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody page={!teamsQuery.isLoading && teamsView.length > 0 ? currentPage : undefined} pageSize={!teamsQuery.isLoading && teamsView.length > 0 ? pageSize : undefined}>
                {teamsQuery.isLoading ? (
                  <TableSkeletonRows
                    rows={5}
                    columns={[
                      { withIcon: true, width: "w-36" },
                      { className: "hidden sm:table-cell", width: "w-24" },
                      { className: "hidden md:table-cell", width: "w-44" },
                      ...(canManageTeams ? [{ align: "right" as const, width: "w-16" }] : []),
                    ]}
                  />
                ) : teamsView.length === 0 ? (
                  <TableEmptyState colSpan={canManageTeams ? 4 : 3} icon={Users} title="Nenhuma equipe encontrada." />
                ) : teamsView.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${team.color}1A` }}
                        >
                          <Users className="h-5 w-5" style={{ color: team.color }} />
                        </div>
                        <div>
                          <p className="font-medium">{team.name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{team.members.length} membros</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{team.members.length} membros</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex max-h-[52px] flex-wrap gap-1.5 overflow-hidden">
                        {team.members.map((member) => (
                          <Badge key={member.id} variant="outline" className="text-xs">
                            {member.name.split(" ").slice(0, 2).join(" ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    {canManageTeams ? (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => event.stopPropagation()}
                              aria-label="Ações da equipe"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEdit(team)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPendingDelete({ id: team.id, label: team.name })
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!teamsQuery.isLoading ? (
          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={teamsView.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
