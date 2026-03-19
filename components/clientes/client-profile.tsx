"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
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
  Edit,
  Download,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  MoreHorizontal
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
import type { InstallmentStatus } from "@/lib/types"

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
  const clientServices = scheduledServices.filter(s => s.clientId === client.id)

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
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${getColorFromClass(clientType?.color || '')}1A` }}
            >
              <Building2 className="w-8 h-8" style={{ color: getColorFromClass(clientType?.color || '') }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{client.companyName}</h2>
                <Badge className={`${clientType?.color} text-white`}>
                  {clientType?.name}
                </Badge>
              </div>
              <p className="text-muted-foreground mb-2">{formatCNPJ(client.cnpj)}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{client.email}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/clientes/${client.id}/editar`}>
              <Button variant="outline" className="bg-transparent">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
            <Link href={`/contratos/novo?cliente=${client.id}`}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Contrato
              </Button>
            </Link>
          </div>
        </div>
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
              <p className="text-2xl font-bold">{clientContracts.filter(c => c.status === "active").length}</p>
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
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
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
      </Tabs>
    </div>
  )
}
