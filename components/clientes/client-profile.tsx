"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  DollarSign,
  Download,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertTriangle,
  MoreHorizontal,
  Paperclip,
  FileCheck2
} from "lucide-react"
import { 
  clients, 
  contracts, 
  scheduledServices,
  getClientTypeById, 
  getServiceTypeById,
  getTeamById,
  formatCNPJ, 
  formatCurrency, 
  formatDate 
} from "@/lib/mock-data"
import { getColorFromClass } from "@/lib/utils"
import Link from "next/link"
import type { ClientAttachmentType, InstallmentStatus } from "@/lib/types"
import { getClientAttachments } from "@/lib/client-attachments-store"

interface ClientProfileProps {
  clientId: string
}

export function ClientProfile({ clientId }: ClientProfileProps) {
  const client = clients.find(c => c.id === clientId)
  
  if (!client) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Cliente não encontrado</h3>
        <p className="text-sm text-muted-foreground mb-4">
          O cliente solicitado não existe ou foi removido
        </p>
        <Link href="/clientes">
          <Button>Voltar para Clientes</Button>
        </Link>
      </Card>
    )
  }

  const clientType = getClientTypeById(client.clientTypeId)
  const clientContracts = contracts.filter(c => c.clientId === client.id)
  const activeContracts = clientContracts.filter(c => c.status === "active").length
  const clientServices = scheduledServices.filter(s => s.clientId === client.id)
  const clientAttachments = getClientAttachments(client.id)

  const [installmentOverrides, setInstallmentOverrides] = useState<Record<
    string,
    { status: InstallmentStatus; paidDate?: Date; paidValue?: number }
  >>({})

  const allInstallments = useMemo(() => {
    return clientContracts.flatMap((c) =>
      c.installments.map((i) => {
        const ov = installmentOverrides[i.id]
        return ov ? { ...i, ...ov } : i
      })
    )
  }, [clientContracts, installmentOverrides])
  
  // Calculate financial status
  const paidInstallments = allInstallments.filter(i => i.status === "paid")
  const overdueInstallments = allInstallments.filter(i => i.status === "overdue")
  const pendingInstallments = allInstallments.filter(i => i.status === "pending")
  const totalPaid = paidInstallments.reduce((acc, i) => acc + (i.paidValue || 0), 0)
  const totalOverdue = overdueInstallments.reduce((acc, i) => acc + i.value, 0)
  const totalPending = pendingInstallments.reduce((acc, i) => acc + i.value, 0)


  const getAttachmentTypeLabel = (type: ClientAttachmentType) => {
    switch (type) {
      case "service_na":
        return "NA"
      case "certificate":
        return "Certificado"
      case "informative":
        return "Informativo"
      case "contract":
        return "Contrato"
      default:
        return "Outro"
    }
  }

  const formatAttachmentSize = (size?: number) => {
    if (!size) return "-"
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const setInstallmentStatus = (installmentId: string, status: InstallmentStatus) => {
    setInstallmentOverrides((prev) => {
      if (status === "paid") {
        const original = clientContracts.flatMap((c) => c.installments).find((i) => i.id === installmentId)
        const value = original?.value ?? 0
        return {
          ...prev,
          [installmentId]: {
            status,
            paidDate: new Date(),
            paidValue: value,
          },
        }
      }
      if (status === "overdue") {
        return {
          ...prev,
          [installmentId]: { status, paidDate: undefined, paidValue: undefined },
        }
      }
      return {
        ...prev,
        [installmentId]: { status: "pending", paidDate: undefined, paidValue: undefined },
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Client Header */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${getColorFromClass(clientType?.color || "")}1A` }}
            >
              <Building2 className="w-5 h-5" style={{ color: getColorFromClass(clientType?.color || "") }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate text-sm">{client.companyName}</h3>
              <p className="text-xs text-muted-foreground font-mono">{formatCNPJ(client.cnpj)}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 shrink-0" />
                <span>{client.phone}</span>
              </div>
              <Badge
                style={{ backgroundColor: getColorFromClass(clientType?.color || "") }}
                className="text-white border-0 hover:opacity-90 shrink-0 text-xs"
              >
                {clientType?.name}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4 shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4 shrink-0" />
              <span>{activeContracts} contrato(s) ativo(s)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contratos Ativos</p>
              <p className="text-2xl font-bold">{activeContracts}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Pago</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendente</p>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencido</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="flex h-auto w-full justify-start gap-2 overflow-x-auto bg-transparent p-0 sm:grid sm:grid-cols-2 lg:grid-cols-6">
          <TabsTrigger onFocus={(event) => event.currentTarget.focus({ preventScroll: true })} value="dados" className="shrink-0 rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:min-h-[130px] sm:flex-col sm:items-start sm:justify-start sm:gap-3 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-6 sm:text-left sm:shadow-none sm:data-[state=active]:border-primary sm:data-[state=active]:bg-primary/5 sm:data-[state=active]:text-foreground sm:data-[state=active]:ring-1 sm:data-[state=active]:ring-primary">
            <span className="hidden rounded-lg bg-primary/10 p-2 sm:inline-flex">
              <Building2 className="h-5 w-5 text-primary" />
            </span>
            <span className="text-sm font-semibold sm:text-base">Dados</span>
            <span className="hidden text-sm font-normal leading-relaxed text-muted-foreground sm:block">Informações gerais</span>
          </TabsTrigger>
          <TabsTrigger onFocus={(event) => event.currentTarget.focus({ preventScroll: true })} value="contratos" className="shrink-0 rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:min-h-[130px] sm:flex-col sm:items-start sm:justify-start sm:gap-3 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-6 sm:text-left sm:shadow-none sm:data-[state=active]:border-primary sm:data-[state=active]:bg-primary/5 sm:data-[state=active]:text-foreground sm:data-[state=active]:ring-1 sm:data-[state=active]:ring-primary">
            <span className="hidden rounded-lg bg-primary/10 p-2 sm:inline-flex">
              <FileText className="h-5 w-5 text-primary" />
            </span>
            <span className="text-sm font-semibold sm:text-base">Contratos</span>
            <span className="hidden text-sm font-normal leading-relaxed text-muted-foreground sm:block">Histórico contratual</span>
          </TabsTrigger>
          <TabsTrigger onFocus={(event) => event.currentTarget.focus({ preventScroll: true })} value="parcelas" className="shrink-0 rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:min-h-[130px] sm:flex-col sm:items-start sm:justify-start sm:gap-3 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-6 sm:text-left sm:shadow-none sm:data-[state=active]:border-primary sm:data-[state=active]:bg-primary/5 sm:data-[state=active]:text-foreground sm:data-[state=active]:ring-1 sm:data-[state=active]:ring-primary">
            <span className="hidden rounded-lg bg-primary/10 p-2 sm:inline-flex">
              <DollarSign className="h-5 w-5 text-primary" />
            </span>
            <span className="text-sm font-semibold sm:text-base">Parcelas</span>
            <span className="hidden text-sm font-normal leading-relaxed text-muted-foreground sm:block">Financeiro do cliente</span>
          </TabsTrigger>
          <TabsTrigger onFocus={(event) => event.currentTarget.focus({ preventScroll: true })} value="servicos" className="shrink-0 rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:min-h-[130px] sm:flex-col sm:items-start sm:justify-start sm:gap-3 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-6 sm:text-left sm:shadow-none sm:data-[state=active]:border-primary sm:data-[state=active]:bg-primary/5 sm:data-[state=active]:text-foreground sm:data-[state=active]:ring-1 sm:data-[state=active]:ring-primary">
            <span className="hidden rounded-lg bg-primary/10 p-2 sm:inline-flex">
              <CheckCircle className="h-5 w-5 text-primary" />
            </span>
            <span className="text-sm font-semibold sm:text-base">Serviços</span>
            <span className="hidden text-sm font-normal leading-relaxed text-muted-foreground sm:block">Serviços realizados</span>
          </TabsTrigger>
          <TabsTrigger onFocus={(event) => event.currentTarget.focus({ preventScroll: true })} value="agenda" className="shrink-0 rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:min-h-[130px] sm:flex-col sm:items-start sm:justify-start sm:gap-3 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-6 sm:text-left sm:shadow-none sm:data-[state=active]:border-primary sm:data-[state=active]:bg-primary/5 sm:data-[state=active]:text-foreground sm:data-[state=active]:ring-1 sm:data-[state=active]:ring-primary">
            <span className="hidden rounded-lg bg-primary/10 p-2 sm:inline-flex">
              <Calendar className="h-5 w-5 text-primary" />
            </span>
            <span className="text-sm font-semibold sm:text-base">Agenda</span>
            <span className="hidden text-sm font-normal leading-relaxed text-muted-foreground sm:block">Próximos serviços</span>
          </TabsTrigger>
          <TabsTrigger onFocus={(event) => event.currentTarget.focus({ preventScroll: true })} value="anexos" className="shrink-0 rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:min-h-[130px] sm:flex-col sm:items-start sm:justify-start sm:gap-3 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-6 sm:text-left sm:shadow-none sm:data-[state=active]:border-primary sm:data-[state=active]:bg-primary/5 sm:data-[state=active]:text-foreground sm:data-[state=active]:ring-1 sm:data-[state=active]:ring-primary">
            <span className="hidden rounded-lg bg-primary/10 p-2 sm:inline-flex">
              <Paperclip className="h-5 w-5 text-primary" />
            </span>
            <span className="text-sm font-semibold sm:text-base">Anexos</span>
            <span className="hidden text-sm font-normal leading-relaxed text-muted-foreground sm:block">NAs e documentos</span>
          </TabsTrigger>
        </TabsList>

        {/* Dados Tab */}
        <TabsContent value="dados">
          <div className="space-y-4">
            <div className="rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead colSpan={2}>Informações do Cliente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground w-[220px]">Razão Social</TableCell>
                    <TableCell className="font-medium">{client.companyName}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">CNPJ</TableCell>
                    <TableCell className="font-medium">{formatCNPJ(client.cnpj)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Responsável</TableCell>
                    <TableCell className="font-medium">{client.responsibleName}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Telefone</TableCell>
                    <TableCell className="font-medium">{client.phone}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">E-mail</TableCell>
                    <TableCell className="font-medium">{client.email}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Tipo</TableCell>
                    <TableCell>
                      <Badge className={`${clientType?.color} text-white`}>
                        {clientType?.name}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filial</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.units.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nenhuma filial cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    client.units.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            {unit.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {unit.address.street}, {unit.address.number}
                          {unit.address.complement ? ` - ${unit.address.complement}` : ""},{" "}
                          {unit.address.neighborhood} - {unit.address.city}/{unit.address.state} (CEP: {unit.address.zipCode})
                        </TableCell>
                        <TableCell>
                          {unit.unitCount ?? "-"}
                        </TableCell>
                        <TableCell>
                          {unit.isPrimary ? <Badge variant="secondary">Matriz</Badge> : <Badge variant="outline">Filial</Badge>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Contratos Tab */}
        <TabsContent value="contratos">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead className="hidden md:table-cell">Vigência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contract.contractNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {contract.services.length} serviço(s)
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(contract.totalValue)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        contract.status === "active" ? "bg-green-100 text-green-700" :
                        contract.status === "pending_signature" ? "bg-amber-100 text-amber-700" :
                        contract.status === "overdue" ? "bg-red-100 text-red-700" :
                        contract.status === "refused" ? "bg-orange-100 text-orange-700" :
                        contract.status === "deadline_expired" ? "bg-purple-100 text-purple-700" :
                        contract.status === "cancelled" ? "bg-red-100 text-red-700" :
                        contract.status === "expired" ? "bg-gray-100 text-gray-700" :
                        "bg-gray-100 text-gray-600"
                      }>
                        {contract.status === "active" ? "Assinado" :
                         contract.status === "pending_signature" ? "Aguardando Assinatura" :
                         contract.status === "overdue" ? "Em Atraso" :
                         contract.status === "refused" ? "Recusado" :
                         contract.status === "deadline_expired" ? "Prazo Expirado" :
                         contract.status === "expired" ? "Expirado" :
                         contract.status === "cancelled" ? "Cancelado" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/contratos/${contract.id}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                        {contract.documentUrl && (
                          <Button variant="ghost" size="icon">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {clientContracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhum contrato encontrado</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Parcelas Tab */}
        <TabsContent value="parcelas">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientContracts.flatMap(contract => 
                  contract.installments.map(installment => {
                    const ov = installmentOverrides[installment.id]
                    const display = ov ? { ...installment, ...ov } : installment
                    return (
                      <TableRow key={installment.id}>
                      <TableCell className="text-sm">{contract.contractNumber}</TableCell>
                      <TableCell>{installment.number}/{contract.installmentsCount}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(installment.value)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {formatDate(installment.dueDate)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            display.status === "paid" ? "default" :
                            display.status === "overdue" ? "destructive" : "secondary"
                          }
                        >
                          {display.status === "paid" ? "Paga" :
                           display.status === "overdue" ? "Vencida" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setInstallmentStatus(installment.id, "paid")}>
                              Marcar como paga
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setInstallmentStatus(installment.id, "overdue")}>
                              Marcar como atrasada
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setInstallmentStatus(installment.id, "pending")}>
                              Marcar como pendente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Serviços Tab (Histórico) */}
        <TabsContent value="servicos">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="hidden md:table-cell">Equipe</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientServices.filter(s => s.status === "completed").map(service => {
                  const serviceType = getServiceTypeById(service.serviceTypeId)
                  const team = getTeamById(service.teamIds[0])
                  return (
                    <TableRow key={service.id}>
                      <TableCell>
                        <p className="font-medium">{serviceType?.name}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {team?.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(service.completedAt || service.scheduledDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Concluído
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {clientServices.filter(s => s.status === "completed").length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <CheckCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhum serviço realizado ainda</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Agenda Tab */}
        <TabsContent value="agenda">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="hidden md:table-cell">Equipe</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientServices.filter(s => s.status === "scheduled" || s.status === "in_progress").map(service => {
                  const serviceType = getServiceTypeById(service.serviceTypeId)
                  const team = getTeamById(service.teamIds[0])
                  return (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{serviceType?.name}</p>
                          {service.isEmergency && (
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {team?.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(service.scheduledDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {service.scheduledTime || "08:00"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.status === "in_progress" ? "default" : "secondary"}>
                          {service.status === "in_progress" ? "Em Andamento" : "Agendado"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {clientServices.filter(s => s.status === "scheduled" || s.status === "in_progress").length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhum serviço agendado</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Anexos Tab */}
        <TabsContent value="anexos">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="hidden md:table-cell">Origem</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientAttachments.map((attachment) => (
                  <TableRow key={attachment.id}>
                    <TableCell>
                      <Badge variant="secondary">{getAttachmentTypeLabel(attachment.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileCheck2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{attachment.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {attachment.fileName} - {formatAttachmentSize(attachment.fileSize)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {attachment.source === "agenda" ? "Agenda" : attachment.source === "ai" ? "IA" : "Manual"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {new Date(attachment.uploadedAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <Download className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {clientAttachments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Paperclip className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhum anexo vinculado a este cliente</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
