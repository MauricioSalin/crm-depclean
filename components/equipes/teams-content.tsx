"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Edit, Search, Trash2, Users, X } from "lucide-react"

import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataPagination } from "@/components/ui/data-pagination"
import { toast } from "@/components/ui/use-toast"
import { listEmployees, type EmployeeRecord } from "@/lib/api/employees"
import { createTeam, deleteTeam, listTeams, updateTeam, type TeamRecord } from "@/lib/api/teams"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { cn } from "@/lib/utils"

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
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamView | null>(null)
  const [memberSearchOpen, setMemberSearchOpen] = useState(false)
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formData, setFormData] = useState({
    name: "",
    color: "#84cc16",
    memberIds: [] as string[],
  })

  const teamsQuery = useQuery({
    queryKey: ["teams", searchTerm],
    queryFn: () => listTeams(searchTerm),
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "teams"],
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
      setIsDialogOpen(true)
      onDialogChange?.(false)
    }
  }, [onDialogChange, openDialog])

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
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTeam>[1] }) => updateTeam(id, payload),
    onSuccess: () => {
      toast({ title: "Equipe atualizada", description: "As alterações foram salvas com sucesso." })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      toast({ title: "Equipe excluída", description: "A equipe foi removida com sucesso." })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      setPendingDelete(null)
    },
  })

  const busy = createMutation.isPending || updateMutation.isPending

  function resetForm() {
    setFormData({ name: "", color: "#84cc16", memberIds: [] })
    setEditingTeam(null)
    setIsDialogOpen(false)
    setMemberSearchTerm("")
    setMemberSearchOpen(false)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const payload = {
      name: formData.name.trim(),
      color: formData.color,
      memberIds: formData.memberIds,
      description: "",
    }

    if (!payload.name) {
      toast({ title: "Nome obrigatório", description: "Informe o nome da equipe." })
      return
    }

    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, payload })
      return
    }

    createMutation.mutate(payload)
  }

  function handleEdit(team: TeamView) {
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
    deleteMutation.mutate(pendingDelete.id)
  }

  return (
    <div className="space-y-6">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
          </DialogHeader>

          <form autoComplete="off" onSubmit={handleSubmit} className="space-y-6">
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
                    return (
                      <Badge key={memberId} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                        <span>{employee.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => toggleMember(memberId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {editingTeam ? "Salvar" : "Criar"}
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

      <div>
        <div className="mb-6 flex items-center gap-2">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar equipes..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10"
            />
          </div>
          {viewToggle ? <div className="hidden shrink-0 sm:block">{viewToggle}</div> : null}
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedTeams.map((team) => (
              <Card key={team.id} className="overflow-hidden transition-shadow hover:shadow-lg">
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

                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDelete({ id: team.id, label: team.name })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
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
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe / Funcionários</TableHead>
                  <TableHead className="hidden sm:table-cell">Membros</TableHead>
                  <TableHead className="hidden md:table-cell">Integrantes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTeams.map((team) => (
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete({ id: team.id, label: team.name })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!teamsQuery.isLoading && teamsView.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">Nenhuma equipe encontrada</h3>
            <p className="text-muted-foreground">Crie uma nova equipe para começar.</p>
          </div>
        ) : null}

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
      </div>
    </div>
  )
}
