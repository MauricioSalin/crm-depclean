"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  FileText,
  Download,
  ExternalLink,
  Building2,
  Calendar,
  CalendarCheck,
  DollarSign
} from "lucide-react"
import { HeaderFiltersPortal } from "@/components/ui/header-filters-portal"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DataPagination } from "@/components/ui/data-pagination"
import { 
  contracts, 
  getClientById, 
  formatCurrency, 
  formatDate 
} from "@/lib/mock-data"
import Link from "next/link"

interface ContractsContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
}

export function ContractsContent({ viewMode, viewToggle }: ContractsContentProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      const client = getClientById(contract.clientId)
      const matchesSearch = 
        contract.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client?.companyName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [searchTerm, statusFilter])

  const totalPages = Math.ceil(filteredContracts.length / pageSize)
  const paginatedContracts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredContracts.slice(start, start + pageSize)
  }, [filteredContracts, currentPage, pageSize])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Assinado</Badge>
      case "pending_signature":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Aguardando Assinatura</Badge>
      case "overdue":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Em Atraso</Badge>
      case "refused":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Recusado</Badge>
      case "expired":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Expirado</Badge>
      case "deadline_expired":
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Prazo Expirado</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelado</Badge>
      default:
        return <Badge variant="secondary">Rascunho</Badge>
    }
  }

  return (
    <div>
        <HeaderFiltersPortal>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou cliente..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            <SearchableSelect
              value={statusFilter}
              onValueChange={(value) => { setStatusFilter(value); setCurrentPage(1) }}
              options={[
                { value: "draft", label: "Rascunho" },
                { value: "pending_signature", label: "Aguardando Assinatura" },
                { value: "active", label: "Assinado" },
                { value: "overdue", label: "Em Atraso" },
                { value: "refused", label: "Recusado" },
                { value: "expired", label: "Expirados" },
                { value: "deadline_expired", label: "Prazo Expirado" },
                { value: "cancelled", label: "Cancelados" },
              ]}
              placeholder="Status"
              searchPlaceholder="Buscar status..."
              allLabel="Todos os status"
              className="flex-1 sm:flex-none sm:w-[160px]"
            />
            {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
          </div>
        </HeaderFiltersPortal>

        {viewMode === "table" ? (
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Contrato</TableHead>
                  <TableHead className="hidden sm:table-cell w-[300px]">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Vigência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nenhum contrato encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContracts.map((contract) => {
                    const client = getClientById(contract.clientId)
                    const paidInstallments = contract.installments.filter(i => i.status === "paid").length

                    return (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <Link href={`/contratos/${contract.id}`} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{contract.contractNumber}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{client?.companyName}</p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Link href={`/clientes/${client?.id}`} className="flex items-center gap-2 hover:text-primary">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate max-w-[250px]">{client?.companyName}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div>
                            <p className="font-medium">{formatCurrency(contract.totalValue)}</p>
                            <p className="text-xs text-muted-foreground">
                              {paidInstallments}/{contract.installmentsCount} parcelas
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(contract.startDate)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <CalendarCheck className="h-3 w-3" />
                              <span>{formatDate(contract.endDate)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(contract.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/contratos/${contract.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver Detalhes
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/contratos/${contract.id}/editar`}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                              {contract.documentUrl && (
                                <DropdownMenuItem>
                                  <Download className="w-4 h-4 mr-2" />
                                  Baixar PDF
                                </DropdownMenuItem>
                              )}
                              {contract.signatureUrl && (
                                <DropdownMenuItem>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Ver no ClickSign
                                </DropdownMenuItem>
                              )}
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
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedContracts.map((contract) => {
              const client = getClientById(contract.clientId)
              const paidInstallments = contract.installments.filter(i => i.status === "paid").length
              const progress = (paidInstallments / contract.installmentsCount) * 100

              return (
                <Card key={contract.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <Link href={`/contratos/${contract.id}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate text-sm">{contract.contractNumber}</h3>
                          <p className="text-xs text-muted-foreground truncate">{client?.companyName}</p>
                        </div>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground">{formatCurrency(contract.totalValue)}</p>
                          {getStatusBadge(contract.status)}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(contract.startDate)} - {formatDate(contract.endDate)}</span>
                        </div>
                        <div className="flex justify-between text-xs mt-2 mb-2">
                          <span>{paidInstallments}/{contract.installmentsCount} parcelas pagas</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/contratos/${contract.id}/editar`}>
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Link>
                      </Button>
                      <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                        <Link href={`/contratos/${contract.id}`}>
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredContracts.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
        />
    </div>
  )
}
