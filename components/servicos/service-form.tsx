"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Check, ChevronsUpDown, Clock, ClipboardList, FileText, Plus, Save, Users, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { listEmployees } from "@/lib/api/employees"
import { getApiErrorMessage } from "@/lib/api/errors"
import { createService, getServiceById, updateService } from "@/lib/api/services"
import { listTeams } from "@/lib/api/teams"
import { listTemplates } from "@/lib/api/templates"
import {
  isEmployeeCoveredBySelectedTeams,
  normalizeTeamEmployeeSelection,
  removeEmployeesCoveredByTeams,
} from "@/lib/team-member-selection"
import { cn } from "@/lib/utils"

interface ServiceFormProps {
  serviceId?: string
  isEditing?: boolean
}

const NO_INFORMATIVE_TEMPLATE_VALUE = "__none__"
const NO_CERTIFICATE_TEMPLATE_VALUE = "__none__"

export function ServiceForm({ serviceId, isEditing }: ServiceFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    defaultDuration: 1,
    durationType: "hours" as "hours" | "shift" | "days",
    defaultRecurrence: "monthly",
    dailyScheduleLimit: "unlimited",
    defaultInformativeTemplateId: "",
    defaultCertificateTemplateId: "",
    autoSendInformative: false,
    generateCertificateRequest: false,
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
    queryKey: ["teams", "catalog"],
    queryFn: () => listTeams(""),
  })
  const employeesQuery = useQuery({
    queryKey: ["employees", "catalog"],
    queryFn: () => listEmployees(""),
  })
  const informativeTemplatesQuery = useQuery({
    queryKey: ["templates", "service-form", "informative"],
    queryFn: () => listTemplates("", "informative"),
  })
  const certificateTemplatesQuery = useQuery({
    queryKey: ["templates", "service-form", "certificate"],
    queryFn: () => listTemplates("", "certificate"),
  })

  const teams = teamsQuery.data?.data ?? []
  const employees = employeesQuery.data?.data ?? []
  const informativeTemplates = informativeTemplatesQuery.data?.data ?? []
  const certificateTemplates = certificateTemplatesQuery.data?.data ?? []

  useEffect(() => {
    const service = serviceQuery.data?.data
    if (!service) return
    const selection = normalizeTeamEmployeeSelection({
      teamIds: service.teamIds,
      employeeIds: service.employeeIds,
      teams,
    })
    const defaultInformativeTemplateId = service.defaultInformativeTemplateId ?? ""
    const defaultCertificateTemplateId = service.defaultCertificateTemplateId ?? ""

    setFormData({
      name: service.name,
      description: service.description,
      defaultDuration: service.defaultDuration,
      durationType: service.durationType,
      defaultRecurrence: service.defaultRecurrence,
      dailyScheduleLimit: service.dailyScheduleLimit ? String(service.dailyScheduleLimit) : "unlimited",
      defaultInformativeTemplateId,
      defaultCertificateTemplateId,
      autoSendInformative: Boolean(defaultInformativeTemplateId) || service.autoSendInformative === true,
      generateCertificateRequest: Boolean(defaultCertificateTemplateId) || service.generateCertificateRequest === true,
      teamIds: selection.teamIds,
      employeeIds: selection.employeeIds,
      clauses: service.clauses,
      newClause: "",
    })
  }, [serviceQuery.data, teams])

  const activeInformativeTemplates = useMemo(
    () => informativeTemplates.filter((template) => template.isActive && template.format === "docx"),
    [informativeTemplates],
  )
  const activeCertificateTemplates = useMemo(
    () => certificateTemplates.filter((template) => template.isActive && template.format === "docx"),
    [certificateTemplates],
  )
  const filteredTeams = useMemo(
    () => teams.filter((team) => team.name.toLowerCase().includes(teamSearchTerm.toLowerCase())),
    [teamSearchTerm, teams],
  )
  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (isEmployeeCoveredBySelectedTeams(employee.id, formData.teamIds, teams)) return false
        const term = employeeSearchTerm.toLowerCase()
        return employee.name.toLowerCase().includes(term) || employee.role.toLowerCase().includes(term)
      }),
    [employeeSearchTerm, employees, formData.teamIds, teams],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        defaultDuration: Number(formData.defaultDuration),
        durationType: formData.durationType,
        defaultRecurrence: formData.defaultRecurrence,
        dailyScheduleLimit: formData.dailyScheduleLimit === "unlimited" ? null : Number(formData.dailyScheduleLimit),
        defaultInformativeTemplateId: formData.autoSendInformative ? formData.defaultInformativeTemplateId : "",
        defaultCertificateTemplateId: formData.generateCertificateRequest ? formData.defaultCertificateTemplateId : "",
        autoSendInformative: formData.autoSendInformative,
        generateCertificateRequest: formData.generateCertificateRequest,
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
    onError: (error) => {
      toast({
        title: getApiErrorMessage(error, "Não foi possível salvar o serviço."),
        variant: "destructive",
      })
    },
  })

  function toggleTeam(teamId: string) {
    setFormData((current) => {
      const teamIds = current.teamIds.includes(teamId)
        ? current.teamIds.filter((id) => id !== teamId)
        : [...current.teamIds, teamId]

      return {
        ...current,
        teamIds,
        employeeIds: removeEmployeesCoveredByTeams(current.employeeIds, teamIds, teams),
      }
    })
  }

  function toggleEmployee(employeeId: string) {
    if (!formData.employeeIds.includes(employeeId) && isEmployeeCoveredBySelectedTeams(employeeId, formData.teamIds, teams)) {
      return
    }

    setFormData((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(employeeId)
        ? current.employeeIds.filter((id) => id !== employeeId)
        : [...current.employeeIds, employeeId],
    }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (saveMutation.isPending) return
    if (!formData.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do serviço." })
      return
    }
    if (!Number.isInteger(formData.defaultDuration) || formData.defaultDuration < 1) {
      toast({
        title: "Duração inválida",
        description: "Informe uma duração padrão inteira e maior que zero.",
        variant: "destructive",
      })
      return
    }
    if (!formData.defaultRecurrence) {
      toast({
        title: "Recorrência obrigatória",
        description: "Selecione a recorrência padrão do serviço.",
        variant: "destructive",
      })
      return
    }
    const dailyScheduleLimit = formData.dailyScheduleLimit === "unlimited"
      ? null
      : Number(formData.dailyScheduleLimit)
    if (dailyScheduleLimit !== null && (!Number.isInteger(dailyScheduleLimit) || dailyScheduleLimit < 1 || dailyScheduleLimit > 5)) {
      toast({
        title: "Limite diário inválido",
        description: "Escolha um limite entre 1 e 5 serviços por dia ou selecione ilimitado.",
        variant: "destructive",
      })
      return
    }
    if (formData.autoSendInformative && !formData.defaultInformativeTemplateId) {
      toast({
        title: "Informativo não selecionado",
        description: "Selecione o template padrão ou desative o envio automático de informativo.",
        variant: "destructive",
      })
      return
    }
    if (formData.generateCertificateRequest && !formData.defaultCertificateTemplateId) {
      toast({
        title: "Certificado não selecionado",
        description: "Selecione o template padrão ou desative a geração de certificado.",
        variant: "destructive",
      })
      return
    }
    if (formData.clauses.length === 0) {
      toast({
        title: "Cláusulas obrigatórias",
        description: "Adicione ao menos uma cláusula para o contrato.",
        variant: "destructive",
      })
      return
    }
    saveMutation.mutate()
  }

  return (
    <form autoComplete="off" noValidate onSubmit={handleSubmit} className="space-y-6">
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

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[180px_120px_180px_180px]">
          <div className="space-y-2">
            <Label htmlFor="durationType">Tipo de Duração</Label>
            <Select
              value={formData.durationType}
              onValueChange={(value) =>
                setFormData((current) => ({ ...current, durationType: value as "hours" | "shift" | "days" }))
              }
            >
              <SelectTrigger id="durationType" className="w-full">
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
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence">Recorrência Padrão</Label>
            <Select
              value={formData.defaultRecurrence}
              onValueChange={(value) => setFormData((current) => ({ ...current, defaultRecurrence: value }))}
            >
              <SelectTrigger id="recurrence" className="w-full">
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

          <div className="space-y-2">
            <Label htmlFor="dailyScheduleLimit">Limite de serviços no dia</Label>
            <Select
              value={formData.dailyScheduleLimit}
              onValueChange={(value) => setFormData((current) => ({ ...current, dailyScheduleLimit: value }))}
            >
              <SelectTrigger id="dailyScheduleLimit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlimited">Ilimitado</SelectItem>
                {[1, 2, 3, 4, 5].map((limit) => (
                  <SelectItem key={limit} value={String(limit)}>{limit} por dia</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Documentos automáticos</h3>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
              <Checkbox
                checked={formData.autoSendInformative}
                onCheckedChange={(checked) => {
                  const autoSendInformative = checked === true
                  setFormData((current) => ({
                    ...current,
                    autoSendInformative,
                    defaultInformativeTemplateId: autoSendInformative ? current.defaultInformativeTemplateId : "",
                  }))
                }}
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">Enviar informativo automaticamente</span>
                <span className="text-xs text-muted-foreground">Só será enviado quando houver template selecionado.</span>
              </span>
            </label>
            {formData.autoSendInformative ? (
              <div className="space-y-2">
                <Label htmlFor="defaultInformativeTemplateId">Template do informativo</Label>
                <SearchableSelect
                  id="defaultInformativeTemplateId"
                  value={formData.defaultInformativeTemplateId || NO_INFORMATIVE_TEMPLATE_VALUE}
                  onValueChange={(value) => {
                    const defaultInformativeTemplateId = value === NO_INFORMATIVE_TEMPLATE_VALUE ? "" : value
                    setFormData((current) => ({
                      ...current,
                      defaultInformativeTemplateId,
                      autoSendInformative: Boolean(defaultInformativeTemplateId),
                    }))
                  }}
                  options={[
                    { value: NO_INFORMATIVE_TEMPLATE_VALUE, label: "Sem informativo padrão" },
                    ...activeInformativeTemplates.map((template) => ({ value: template.id, label: template.name })),
                  ]}
                  placeholder={activeInformativeTemplates.length > 0 ? "Selecione um template" : "Nenhum template ativo"}
                  searchPlaceholder="Buscar template..."
                  emptyMessage="Nenhum template encontrado."
                  includeAll={false}
                  disabled={activeInformativeTemplates.length === 0}
                  className="w-full"
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
              <Checkbox
                checked={formData.generateCertificateRequest}
                onCheckedChange={(checked) => {
                  const generateCertificateRequest = checked === true
                  setFormData((current) => ({
                    ...current,
                    generateCertificateRequest,
                    defaultCertificateTemplateId: generateCertificateRequest ? current.defaultCertificateTemplateId : "",
                  }))
                }}
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">Gerar solicitação de certificado</span>
                <span className="text-xs text-muted-foreground">Quando ativo, visitas concluídas entram na fila de certificados.</span>
              </span>
            </label>
            {formData.generateCertificateRequest ? (
              <div className="space-y-2">
                <Label htmlFor="defaultCertificateTemplateId">Template do certificado</Label>
                <SearchableSelect
                  id="defaultCertificateTemplateId"
                  value={formData.defaultCertificateTemplateId || NO_CERTIFICATE_TEMPLATE_VALUE}
                  onValueChange={(value) => {
                    const defaultCertificateTemplateId = value === NO_CERTIFICATE_TEMPLATE_VALUE ? "" : value
                    setFormData((current) => ({
                      ...current,
                      defaultCertificateTemplateId,
                      generateCertificateRequest: Boolean(defaultCertificateTemplateId),
                    }))
                  }}
                  options={[
                    { value: NO_CERTIFICATE_TEMPLATE_VALUE, label: "Sem certificado padrão" },
                    ...activeCertificateTemplates.map((template) => ({ value: template.id, label: template.name })),
                  ]}
                  placeholder={activeCertificateTemplates.length > 0 ? "Selecione um template" : "Nenhum template ativo"}
                  searchPlaceholder="Buscar template..."
                  emptyMessage="Nenhum template encontrado."
                  includeAll={false}
                  disabled={activeCertificateTemplates.length === 0}
                  className="w-full"
                />
              </div>
            ) : null}
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
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal md:max-w-[320px]">
                  <span className="min-w-0 truncate text-muted-foreground">Buscar e adicionar equipes...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(calc(100vw-2.5rem),320px)] p-0" align="start">
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
                      <Button type="button" variant="ghost" size="icon" className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground" onClick={() => toggleTeam(teamId)}>
                        <X className="h-3 w-3" />
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
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal md:max-w-[320px]">
                  <span className="min-w-0 truncate text-muted-foreground">Buscar e adicionar funcionários...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(calc(100vw-2.5rem),320px)] p-0" align="start">
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
                      <Button type="button" variant="ghost" size="icon" className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground" onClick={() => toggleEmployee(employeeId)}>
                        <X className="h-3 w-3" />
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

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
            <Textarea
              placeholder="Adicionar nova cláusula..."
              value={formData.newClause}
              onChange={(event) => setFormData((current) => ({ ...current, newClause: event.target.value }))}
              rows={3}
              className="w-full resize-y md:max-w-[50%]"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="self-end shrink-0"
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
          <Button type="button" variant="outline" disabled={saveMutation.isPending}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <Button type="submit" disabled={saveMutation.isPending || serviceQuery.isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar Serviço"}
        </Button>
      </div>
    </form>
  )
}
