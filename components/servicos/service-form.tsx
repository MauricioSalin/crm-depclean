"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Check, ChevronsUpDown, Clock, ClipboardList, FileText, Plus, Save, Users, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { listEmployees } from "@/lib/api/employees"
import { createService, getServiceById, updateService } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"
import { cn } from "@/lib/utils"

interface ServiceFormProps {
  serviceId?: string
  isEditing?: boolean
}

export function ServiceForm({ serviceId, isEditing }: ServiceFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    defaultDuration: 1,
    durationType: "hours" as "hours" | "shift" | "days",
    defaultRecurrence: "monthly",
    teamIds: [] as string[],
    employeeIds: [] as string[],
    clauses: [] as string[],
    newClause: "",
  })
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [employeesPopoverOpen, setEmployeesPopoverOpen] = useState(false)
  const [teamSearchTerm, setTeamSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")

  const serviceQuery = useQuery({
    queryKey: ["service", serviceId],
    queryFn: () => getServiceById(serviceId!),
    enabled: Boolean(serviceId),
  })
  const teamsQuery = useQuery({
    queryKey: ["teams", "service-form"],
    queryFn: () => listTeams(""),
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "service-form"],
    queryFn: () => listEmployees(""),
  })

  useEffect(() => {
    const service = serviceQuery.data?.data
    if (!service) return
    setFormData({
      name: service.name,
      description: service.description,
      defaultDuration: service.defaultDuration,
      durationType: service.durationType,
      defaultRecurrence: service.defaultRecurrence,
      teamIds: service.teamIds,
      employeeIds: service.employeeIds,
      clauses: service.clauses,
      newClause: "",
    })
  }, [serviceQuery.data])

  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []
  const filteredTeams = useMemo(
    () => teams.filter((team) => team.name.toLowerCase().includes(teamSearchTerm.toLowerCase())),
    [teamSearchTerm, teams],
  )
  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) =>
        employee.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
        employee.role.toLowerCase().includes(employeeSearchTerm.toLowerCase()),
      ),
    [employeeSearchTerm, employees],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        defaultDuration: Number(formData.defaultDuration),
        durationType: formData.durationType,
        defaultRecurrence: formData.defaultRecurrence,
        teamIds: formData.teamIds,
        employeeIds: formData.employeeIds,
        clauses: formData.clauses,
      }

      if (serviceId) {
        return updateService(serviceId, payload)
      }
      return createService(payload)
    },
    onSuccess: () => {
      toast({
        title: serviceId ? "Serviço atualizado" : "Serviço criado",
        description: "Os dados foram salvos com sucesso.",
      })
      queryClient.invalidateQueries({ queryKey: ["services"] })
      router.push("/servicos")
    },
  })

  function toggleTeam(teamId: string) {
    setFormData((current) => ({
      ...current,
      teamIds: current.teamIds.includes(teamId)
        ? current.teamIds.filter((id) => id !== teamId)
        : [...current.teamIds, teamId],
    }))
  }

  function toggleEmployee(employeeId: string) {
    setFormData((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(employeeId)
        ? current.employeeIds.filter((id) => id !== employeeId)
        : [...current.employeeIds, employeeId],
    }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!formData.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do serviço." })
      return
    }
    if (formData.clauses.length === 0) {
      toast({ title: "Cláusulas obrigatórias", description: "Adicione ao menos uma cláusula para o contrato." })
      return
    }
    saveMutation.mutate()
  }

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Dados do Serviço</h3>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div className="space-y-2 md:max-w-[50%]">
            <Label htmlFor="name">Nome do Serviço</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Limpeza Geral"
              required
            />
          </div>

          <div className="space-y-2 md:max-w-[50%]">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
              placeholder="Descrição detalhada do serviço"
              rows={3}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Duração</h3>
        </div>

        <div className="flex items-start gap-3">
          <div className="space-y-2">
            <Label htmlFor="durationType">Tipo de Duração</Label>
            <Select
              value={formData.durationType}
              onValueChange={(value) =>
                setFormData((current) => ({ ...current, durationType: value as "hours" | "shift" | "days" }))
              }
            >
              <SelectTrigger id="durationType" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="shift">Turno</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duração Padrão</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={formData.defaultDuration}
              onChange={(event) =>
                setFormData((current) => ({ ...current, defaultDuration: Number(event.target.value) || 1 }))
              }
              className="w-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence">Recorrência Padrão</Label>
            <Select
              value={formData.defaultRecurrence}
              onValueChange={(value) => setFormData((current) => ({ ...current, defaultRecurrence: value }))}
            >
              <SelectTrigger id="recurrence" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="bimonthly">Bimestral</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="semiannual">Semestral</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
                <SelectItem value="custom">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Equipes e Funcionários</h3>
        </div>

        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>Equipes Responsáveis</Label>
            <Popover open={teamsPopoverOpen} onOpenChange={setTeamsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full max-w-[320px] justify-between font-normal">
                  <span className="text-muted-foreground">Buscar e adicionar equipes...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar equipe..." value={teamSearchTerm} onValueChange={setTeamSearchTerm} />
                  <CommandList>
                    <CommandEmpty>Nenhuma equipe encontrada.</CommandEmpty>
                    <CommandGroup>
                      {filteredTeams.map((team) => (
                        <CommandItem key={team.id} value={team.name} onSelect={() => toggleTeam(team.id)} className="cursor-pointer">
                          <Check className={cn("mr-2 h-4 w-4", formData.teamIds.includes(team.id) ? "opacity-100" : "opacity-0")} />
                          <span>{team.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {formData.teamIds.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.teamIds.map((teamId) => {
                  const team = teams.find((item) => item.id === teamId)
                  if (!team) return null
                  return (
                    <Badge
                      key={teamId}
                      variant="secondary"
                      className="flex items-center gap-2 px-3 py-1 text-foreground/80"
                      style={{ backgroundColor: `${team.color}1A` }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                      <span>{team.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-3.5 w-3.5 p-0 hover:bg-transparent" onClick={() => toggleTeam(teamId)}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Funcionários Avulsos</Label>
            <Popover open={employeesPopoverOpen} onOpenChange={setEmployeesPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full max-w-[320px] justify-between font-normal">
                  <span className="text-muted-foreground">Buscar e adicionar funcionários...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar funcionário..."
                    value={employeeSearchTerm}
                    onValueChange={setEmployeeSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredEmployees.map((employee) => (
                        <CommandItem
                          key={employee.id}
                          value={employee.name}
                          onSelect={() => toggleEmployee(employee.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.employeeIds.includes(employee.id) ? "opacity-100" : "opacity-0",
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

            {formData.employeeIds.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.employeeIds.map((employeeId) => {
                  const employee = employees.find((item) => item.id === employeeId)
                  if (!employee) return null
                  return (
                    <Badge key={employeeId} variant="outline" className="flex items-center gap-2 px-3 py-1">
                      <span>{employee.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-3.5 w-3.5 p-0 hover:bg-transparent" onClick={() => toggleEmployee(employeeId)}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Cláusulas do Contrato</h3>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Estas cláusulas serão incluídas automaticamente nos contratos que utilizarem este serviço.
        </p>

        <div className="space-y-3">
          {formData.clauses.map((clause, index) => (
            <div key={`${clause}-${index}`} className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <span className="flex-1 whitespace-pre-wrap text-sm">{clause}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() =>
                  setFormData((current) => ({
                    ...current,
                    clauses: current.clauses.filter((_, clauseIndex) => clauseIndex !== index),
                  }))
                }
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-2">
            <Textarea
              placeholder="Adicionar nova cláusula..."
              value={formData.newClause}
              onChange={(event) => setFormData((current) => ({ ...current, newClause: event.target.value }))}
              rows={3}
              className="w-full max-w-[50%] resize-y"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                if (!formData.newClause.trim()) return
                setFormData((current) => ({
                  ...current,
                  clauses: [...current.clauses, current.newClause.trim()],
                  newClause: "",
                }))
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/servicos">
          <Button type="button" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <Button type="submit" disabled={saveMutation.isPending || serviceQuery.isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isEditing ? "Salvar Alterações" : "Cadastrar Serviço"}
        </Button>
      </div>
    </form>
  )
}
