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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  Trash2,
  Building2,
  Phone,
  Mail,
  FileText,
} from "lucide-react"
import { DataPagination } from "@/components/ui/data-pagination"
import { clients, contracts, clientTypes, getClientTypeById, formatCNPJ } from "@/lib/mock-data"
import { getColorFromClass } from "@/lib/utils"
import Link from "next/link"

interface ClientsContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
}

export function ClientsContent({ viewMode, viewToggle }: ClientsContentProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.responsibleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.cnpj.includes(searchTerm)
      const matchesType = typeFilter === "all" || client.clientTypeId === typeFilter
      return matchesSearch && matchesType
    })
  }, [searchTerm, typeFilter])

  const totalPages = Math.ceil(filteredClients.length / pageSize)
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredClients.slice(start, start + pageSize)
  }, [filteredClients, currentPage, pageSize])

  return (
    <>
      {/* <CardContent className="p-3 sm:p-4 md:p-6"> */}
      <div className="flex gap-2 mb-6 items-center">
        <div className="relative flex-1 sm:flex-initial sm:w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, responsável ou CNPJ..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setCurrentPage(1) }}>
          <SelectTrigger className="flex-1 sm:flex-initial sm:w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {clientTypes.map(type => (
              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
      </div>

      {viewMode === "table" ? (
        <div className="rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                <TableHead className="hidden lg:table-cell">Responsável</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="hidden lg:table-cell">Contratos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((client) => {
                  const clientType = getClientTypeById(client.clientTypeId)
                  const clientContracts = contracts.filter(c => c.clientId === client.id)
                  const activeContracts = clientContracts.filter(c => c.status === "active").length

                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link href={`/clientes/${client.id}`} className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${getColorFromClass(clientType?.color || '')}1A` }}
                          >
                            <Building2 className="w-5 h-5" style={{ color: getColorFromClass(clientType?.color || '') }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{client.companyName}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{formatCNPJ(client.cnpj)}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground font-mono">
                        {formatCNPJ(client.cnpj)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div>
                          <p className="text-sm">{client.responsibleName}</p>
                          <p className="text-xs text-muted-foreground">{client.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          style={{ backgroundColor: getColorFromClass(clientType?.color || '') }}
                          className="text-white border-0 hover:opacity-90"
                        >
                          {clientType?.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>{activeContracts} ativo(s)</span>
                        </div>
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
                              <Link href={`/clientes/${client.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/clientes/${client.id}/editar`}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
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
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedClients.map((client) => {
            const clientType = getClientTypeById(client.clientTypeId)
            const clientContracts = contracts.filter(c => c.clientId === client.id)
            const activeContracts = clientContracts.filter(c => c.status === "active").length

            return (
              <Card key={client.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <Link href={`/clientes/${client.id}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${getColorFromClass(clientType?.color || '')}1A` }}
                      >
                        <Building2 className="w-6 h-6" style={{ color: getColorFromClass(clientType?.color || '') }} />
                      </div>
                      <Badge
                        style={{ backgroundColor: getColorFromClass(clientType?.color || '') }}
                        className="text-white border-0 hover:opacity-90"
                      >
                        {clientType?.name}
                      </Badge>
                    </div>
                    <h3 className="font-semibold mb-1 truncate">{client.companyName}</h3>
                    <p className="text-sm text-muted-foreground mb-3 font-mono">{formatCNPJ(client.cnpj)}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>{client.phone}</span>
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
                  </Link>
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/clientes/${client.id}/editar`}>
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Link>
                    </Button>
                    <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                      <Link href={`/clientes/${client.id}`}>
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
        totalItems={filteredClients.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
      />
      {/* </CardContent> */}
    </>
  )
}
