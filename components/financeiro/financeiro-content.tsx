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
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Calendar,
  Receipt,
} from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DataPagination } from "@/components/ui/data-pagination"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"
import { 
  contracts, 
  getClientById, 
  formatCurrency, 
  formatDate,
  monthlyRevenueData
} from "@/lib/mock-data"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface FinanceiroContentProps {
  viewMode: "table" | "cards"
  viewToggle?: React.ReactNode
}

export function FinanceiroContent({ viewMode, viewToggle }: FinanceiroContentProps) {
  const [searchTerm, setSearchTerm] = useUrlQueryState("q")
  const [tabFilter, setTabFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const FINANCE_COLORS = ["#22C55E", "#F59E0B", "#EF4444"]

  // Get all installments with contract info
  const allInstallments = useMemo(() => {
    return contracts.flatMap(contract => 
      contract.installments.map(installment => ({
        ...installment,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        clientId: contract.clientId,
        client: getClientById(contract.clientId),
      }))
    )
  }, [])

  const filteredInstallments = useMemo(() => {
    return allInstallments.filter(installment => {
      const companyName = installment.client?.companyName ?? ""
      const matchesSearch = 
        installment.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        companyName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesTab = tabFilter === "all" || installment.status === tabFilter
      return matchesSearch && matchesTab
    }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [allInstallments, searchTerm, tabFilter])

  const totalPages = Math.ceil(filteredInstallments.length / pageSize)
  const paginatedInstallments = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredInstallments.slice(start, start + pageSize)
  }, [filteredInstallments, currentPage, pageSize])

  // Calculate summary stats
  const paidInstallments = allInstallments.filter(i => i.status === "paid")
  const pendingInstallments = allInstallments.filter(i => i.status === "pending")
  const overdueInstallments = allInstallments.filter(i => i.status === "overdue")

  const totalPaid = paidInstallments.reduce((acc, i) => acc + (i.paidValue || i.value), 0)
  const totalPending = pendingInstallments.reduce((acc, i) => acc + i.value, 0)
  const totalOverdue = overdueInstallments.reduce((acc, i) => acc + i.value, 0)

  const financeHealthData = useMemo(() => {
    const total = allInstallments.length || 1
    const paid = Math.round((paidInstallments.length / total) * 100)
    const pending = Math.round((pendingInstallments.length / total) * 100)
    const overdue = Math.max(0, 100 - paid - pending)
    return [
      { name: "Pagas", value: paid },
      { name: "Pendentes", value: pending },
      { name: "Vencidas", value: overdue },
    ]
  }, [allInstallments.length, paidInstallments.length, pendingInstallments.length])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paga</Badge>
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendente</Badge>
      case "overdue":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Vencida</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">A Receber</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencidas</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Adimplência</p>
              <p className="text-xl font-bold">{Math.round((paidInstallments.length / allInstallments.length) * 100)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Revenue Chart + Financial Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <h3 className="font-semibold text-base mb-4">Faturamento Mensal</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <h3 className="font-semibold text-base mb-4">Saúde Financeira</h3>
          <div className="flex flex-col items-center">
            <div className="relative w-56 h-56 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financeHealthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {financeHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={FINANCE_COLORS[index % FINANCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value}%`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{Math.round((paidInstallments.length / allInstallments.length) * 100)}%</span>
                <span className="text-xs text-muted-foreground mt-1">Adimplência</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-xs">
              {financeHealthData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: FINANCE_COLORS[index] }}
                  />
                  <span className="text-muted-foreground whitespace-nowrap">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Installments Table */}
      <div className="space-y-4">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <div className="relative sm:flex-none sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por contrato ou cliente..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                  className="pl-10"
                />
              </div>
              <SearchableSelect
                value={tabFilter}
                onValueChange={(value) => { setTabFilter(value); setCurrentPage(1) }}
                options={[
                  { value: "pending", label: "Pendentes" },
                  { value: "overdue", label: "Vencidas" },
                  { value: "paid", label: "Pagas" },
                ]}
                placeholder="Status"
                searchPlaceholder="Buscar status..."
                allLabel="Todas"
                className="sm:flex-none sm:w-[140px]"
              />
              {viewToggle && <div className="hidden sm:block shrink-0">{viewToggle}</div>}
          </div>

          {viewMode === "table" ? (
            <div className="rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Contrato</TableHead>
                    <TableHead className="hidden sm:table-cell">Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInstallments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        Nenhuma parcela encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedInstallments.map((installment) => (
                      <TableRow key={installment.id}>
                        <TableCell>
                          <Link href={`/clientes/${installment.clientId}`} className="hover:text-primary">
                            <p className="font-medium truncate max-w-[140px] sm:max-w-[280px]">{installment.client?.companyName}</p>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          <Link href={`/contratos/${installment.contractId}`} className="hover:text-primary">
                            {installment.contractNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm">{installment.number}</span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(installment.value)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {formatDate(installment.dueDate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(installment.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {installment.status !== "paid" && (
                                <DropdownMenuItem>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Marcar como Paga
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <Receipt className="w-4 h-4 mr-2" />
                                Gerar Boleto
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedInstallments.map((installment) => (
                <Card key={installment.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      {getStatusBadge(installment.status)}
                    </div>
                    <h3 className="font-semibold mb-1 truncate">{installment.client?.companyName}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{installment.contractNumber} - Parcela {installment.number}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Valor:</span>
                        <span className="font-medium">{formatCurrency(installment.value)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Vencimento:</span>
                        <span>{formatDate(installment.dueDate)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      {installment.status !== "paid" && (
                        <Button variant="outline" size="sm" className="flex-1">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Pagar
                        </Button>
                      )}
                      <Button size="sm" className={`${installment.status === "paid" ? "flex-1" : ""} bg-primary hover:bg-primary/90 text-primary-foreground`}>
                        <Receipt className="w-4 h-4 mr-1" />
                        Boleto
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <DataPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredInstallments.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
          />
      </div>
    </div>
  )
}
