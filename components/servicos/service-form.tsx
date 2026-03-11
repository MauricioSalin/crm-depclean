"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"
import { cn, getColorFromClass } from "@/lib/utils"
import { Plus, X, Check, ChevronsUpDown, ClipboardList, Save, ArrowLeft, Clock, DollarSign, Users, FileText } from "lucide-react"
import { mockServiceTypes, mockTeams, mockEmployees } from "@/lib/mock-data"
import Link from "next/link"

interface ServiceFormProps {
  serviceId?: string
  isEditing?: boolean
}

export function ServiceForm({ serviceId, isEditing }: ServiceFormProps) {
  const router = useRouter()

  const existingService = serviceId
    ? mockServiceTypes.find(s => s.id === serviceId)
    : null

  const [formData, setFormData] = useState({
    name: existingService?.name || "",
    description: existingService?.description || "",
    defaultDuration: existingService?.defaultDuration || 60,
    pricePerHour: existingService?.pricePerHour || 0,
    teamIds: (existingService as any)?.teamIds || [] as string[],
    employeeIds: (existingService as any)?.employeeIds || [] as string[],
    clauses: (existingService as any)?.clauses || [] as string[],
    newClause: "",
  })

  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false)
  const [employeesPopoverOpen, setEmployeesPopoverOpen] = useState(false)
  const [teamSearchTerm, setTeamSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")

  const filteredTeams = mockTeams.filter(t =>
    t.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
  )
  const filteredEmployees = mockEmployees.filter(e =>
    e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  )

  const toggleTeam = (teamId: string) => {
    if (formData.teamIds.includes(teamId)) {
      setFormData({ ...formData, teamIds: formData.teamIds.filter((id: string) => id !== teamId) })
    } else {
      setFormData({ ...formData, teamIds: [...formData.teamIds, teamId] })
    }
  }

  const toggleEmployee = (empId: string) => {
    if (formData.employeeIds.includes(empId)) {
      setFormData({ ...formData, employeeIds: formData.employeeIds.filter((id: string) => id !== empId) })
    } else {
      setFormData({ ...formData, employeeIds: [...formData.employeeIds, empId] })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Saving service:", formData)
    router.push("/servicos")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Service Data */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Dados do Serviço</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Nome do Serviço</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Limpeza Geral"
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição detalhada do serviço"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Duração Padrão (min)
              </div>
            </Label>
            <Input
              id="duration"
              type="number"
              value={formData.defaultDuration}
              onChange={(e) => setFormData({ ...formData, defaultDuration: Number(e.target.value) })}
              min={15}
              step={15}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                Preço Padrão (R$)
              </div>
            </Label>
            <Input
              id="price"
              type="number"
              value={formData.pricePerHour}
              onChange={(e) => setFormData({ ...formData, pricePerHour: Number(e.target.value) })}
              min={0}
              step={0.01}
            />
          </div>
        </div>
      </Card>

      {/* Teams & Employees */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Equipes e Funcionários</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Equipes Responsáveis</Label>
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
                      {filteredTeams.map((team) => (
                        <CommandItem
                          key={team.id}
                          value={team.name}
                          onSelect={() => toggleTeam(team.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.teamIds.includes(team.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span>{team.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formData.teamIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.teamIds.map((teamId: string) => {
                  const team = mockTeams.find(t => t.id === teamId)
                  return team ? (
                    <Badge
                      key={teamId}
                      variant="secondary"
                      className="px-3 py-1 flex items-center gap-2 text-foreground/80"
                      style={{ backgroundColor: `${team.color}1A` }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: getColorFromClass(team.color) }}
                      />
                      <span>{team.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-3.5 w-3.5 p-0 hover:bg-transparent"
                        onClick={() => toggleTeam(teamId)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Funcionários Avulsos</Label>
            <Popover open={employeesPopoverOpen} onOpenChange={setEmployeesPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="text-muted-foreground">Buscar e adicionar funcionários...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar funcionário..."
                    value={employeeSearchTerm}
                    onValueChange={setEmployeeSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredEmployees.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={emp.name}
                          onSelect={() => toggleEmployee(emp.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.employeeIds.includes(emp.id) ? "opacity-100" : "opacity-0"
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
            {formData.employeeIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.employeeIds.map((empId: string) => {
                  const emp = mockEmployees.find(e => e.id === empId)
                  return emp ? (
                    <Badge key={empId} variant="outline" className="px-3 py-1 flex items-center gap-2">
                      <span>{emp.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-3.5 w-3.5 p-0 hover:bg-transparent"
                        onClick={() => toggleEmployee(empId)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Contract Clauses */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Cláusulas do Contrato</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Estas cláusulas serão incluídas automaticamente nos contratos que utilizarem este serviço
        </p>

        <div className="space-y-3">
          {formData.clauses.map((clause: string, index: number) => (
            <div key={index} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm flex-1 whitespace-pre-wrap">{clause}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setFormData({
                  ...formData,
                  clauses: formData.clauses.filter((_: string, i: number) => i !== index)
                })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2 items-end">
            <Textarea
              placeholder="Adicionar nova cláusula..."
              value={formData.newClause}
              onChange={(e) => setFormData({ ...formData, newClause: e.target.value })}
              rows={3}
              className="resize-y"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                if (formData.newClause.trim()) {
                  setFormData({
                    ...formData,
                    clauses: [...formData.clauses, formData.newClause.trim()],
                    newClause: ""
                  })
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href="/servicos">
          <Button type="button" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <Button type="submit">
          <Save className="w-4 h-4 mr-2" />
          {isEditing ? "Salvar Alterações" : "Cadastrar Serviço"}
        </Button>
      </div>
    </form>
  )
}
