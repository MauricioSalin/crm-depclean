"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Plus, Search, Users, Edit, Trash2, UserPlus, Check, ChevronsUpDown, X } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataPagination } from "@/components/ui/data-pagination"
import { mockTeams, mockEmployees } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type TeamRow = (typeof mockTeams)[number]

interface TeamsContentProps {
  viewMode: "grid" | "table"
  openDialog?: boolean
  onDialogChange?: (open: boolean) => void
  viewToggle?: React.ReactNode
}

export function TeamsContent({ viewMode, openDialog, onDialogChange, viewToggle }: TeamsContentProps) {
  const [teams, setTeams] = useState<TeamRow[]>(mockTeams)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Sync dialog state with parent
  useEffect(() => {
    if (openDialog !== undefined && openDialog) {
      setIsDialogOpen(true)
      onDialogChange?.(false)
    }
  }, [openDialog, onDialogChange])
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null)
  const [memberSearchOpen, setMemberSearchOpen] = useState(false)
  const [memberSearchTerm, setMemberSearchTerm] = useState("")
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formData, setFormData] = useState({
    name: "",
    color: "#F59E0B",
    memberIds: [] as string[],
  })

  const filteredTeams = useMemo(() => {
    return teams.filter(team =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [teams, searchTerm])

  const totalPages = Math.ceil(filteredTeams.length / pageSize)
  const paginatedTeams = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTeams.slice(start, start + pageSize)
  }, [filteredTeams, currentPage, pageSize])

  const availableEmployees = mockEmployees.filter(e => e.status === "active")
  
  const filteredAvailableEmployees = useMemo(() => {
    return availableEmployees.filter(emp =>
      emp.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(memberSearchTerm.toLowerCase())
    )
  }, [availableEmployees, memberSearchTerm])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingTeam) {
      setTeams(teams.map(t => 
        t.id === editingTeam.id 
          ? { ...t, ...formData, members: mockEmployees.filter(e => formData.memberIds.includes(e.id)) }
          : t
      ))
    } else {
      const newTeam: TeamRow = {
        id: `team-${Date.now()}`,
        name: formData.name,
        description: "",
        permissionId: "",
        employees: formData.memberIds,
        color: formData.color,
        isActive: true,
        members: mockEmployees.filter(e => formData.memberIds.includes(e.id)),
        createdAt: new Date(),
      }
      setTeams([...teams, newTeam])
    }
    resetForm()
  }

  const resetForm = () => {
    setFormData({ name: "", color: "#F59E0B", memberIds: [] })
    setEditingTeam(null)
    setIsDialogOpen(false)
    setMemberSearchTerm("")
  }

  const handleEdit = (team: TeamRow) => {
    setEditingTeam(team)
    setFormData({
      name: team.name,
      color: team.color,
      memberIds: team.members.map(m => m.id),
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta equipe?")) {
      setTeams(teams.filter(t => t.id !== id))
    }
  }

  const toggleMember = (employeeId: string) => {
    if (formData.memberIds.includes(employeeId)) {
      setFormData({
        ...formData,
        memberIds: formData.memberIds.filter(id => id !== employeeId)
      })
    } else {
      setFormData({
        ...formData,
        memberIds: [...formData.memberIds, employeeId]
      })
    }
  }

  const removeMember = (employeeId: string) => {
    setFormData({
      ...formData,
      memberIds: formData.memberIds.filter(id => id !== employeeId)
    })
  }

  return (
    <div className="space-y-6">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTeam ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Equipe</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Equipe Alpha"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Cor</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 font-mono"
                    placeholder="#F59E0B"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Membros</Label>
                <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={memberSearchOpen}
                      className="w-full justify-between"
                    >
                      <span className="text-muted-foreground">
                        Buscar e adicionar membros...
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                          {filteredAvailableEmployees.map((emp) => (
                            <CommandItem
                              key={emp.id}
                              value={emp.name}
                              onSelect={() => toggleMember(emp.id)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.memberIds.includes(emp.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{emp.name}</span>
                                <span className="text-sm text-muted-foreground">{emp.role}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {formData.memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.memberIds.map(id => {
                      const emp = mockEmployees.find(e => e.id === id)
                      return emp ? (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="pl-2 pr-1 py-1 flex items-center gap-1"
                        >
                          <span>{emp.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => removeMember(id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {editingTeam ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar equipes..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
          </div>

          {viewMode === "grid" ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedTeams.map((team) => (
              <Card key={team.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 min-w-[2.5rem] rounded-full flex items-center justify-center shrink-0"
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
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(team.id)}>
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
                    <div className="flex flex-wrap gap-1.5 max-h-[52px] overflow-hidden relative">
                      {team.members.map((member: any) => (
                        <Badge
                          key={member.id}
                          variant="outline"
                          className="text-xs"
                        >
                          {member.name.split(' ').slice(0, 2).join(' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          ) : (
            <div className="rounded-md overflow-x-auto">
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
                            className="w-10 h-10 min-w-[2.5rem] rounded-full flex items-center justify-center shrink-0"
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
                        <div className="flex flex-wrap gap-1.5 max-h-[52px] overflow-hidden">
                          {team.members.map((member: any) => (
                            <Badge
                              key={member.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {member.name.split(' ').slice(0, 2).join(' ')}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(team.id)}>
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

          {filteredTeams.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhuma equipe encontrada</h3>
              <p className="text-muted-foreground">Crie uma nova equipe para começar</p>
            </div>
          )}

          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredTeams.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
          />
      </div>
    </div>
  )
}
