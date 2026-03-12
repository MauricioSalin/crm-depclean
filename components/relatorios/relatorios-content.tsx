"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  BarChart3,
  FileText,
  Download,
  Users,
  DollarSign,
  Wrench,
  TrendingUp,
  FileDown,
} from "lucide-react"
import {
  dashboardStats,
  monthlyRevenueData,
  servicesByPeriodData,
  servicesByTeamData,
  clients,
  contracts,
  teams,
} from "@/lib/mock-data"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

const REPORT_TYPES = [
  { id: "services", label: "Serviços Realizados", icon: Wrench, description: "Relatório de serviços executados por período" },
  { id: "financial", label: "Financeiro", icon: DollarSign, description: "Faturamento, recebimentos e inadimplência" },
  { id: "clients", label: "Clientes", icon: Users, description: "Listagem e análise de clientes" },
  { id: "teams", label: "Equipes", icon: Users, description: "Produtividade e desempenho das equipes" },
  { id: "contracts", label: "Contratos", icon: FileText, description: "Contratos ativos, vencendo e vencidos" },
]

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export function RelatoriosContent() {
  const [selectedReport, setSelectedReport] = useState("services")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [teamFilter, setTeamFilter] = useState("all")

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
  }

  const handleExport = (format: "pdf" | "excel") => {
    alert(`Exportando relatório em formato ${format.toUpperCase()}...`)
  }

  return (
    <div className="space-y-6">
      {/* Report Type Selection */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {REPORT_TYPES.map((type) => (
          <Card
            key={type.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedReport === type.id ? "ring-2 ring-primary bg-primary/5" : ""
            }`}
            onClick={() => setSelectedReport(type.id)}
          >
            <CardContent className="p-4 text-center">
              <type.icon className={`h-8 w-8 mx-auto mb-2 ${
                selectedReport === type.id ? "text-primary" : "text-muted-foreground"
              }`} />
              <h3 className="font-medium text-sm">{type.label}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap sm:flex-nowrap items-end gap-3">
            <div className="flex flex-col gap-2 w-full sm:w-[160px] shrink-0">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-[160px] shrink-0">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-[200px] shrink-0">
              <Label>Equipe</Label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full sm:w-auto h-10 px-4 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground">
              Gerar relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {selectedReport === "services" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Serviços por Período</CardTitle>
              <CardDescription>Comparativo de serviços agendados vs realizados</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={servicesByPeriodData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "var(--card)", 
                      border: "1px solid var(--border)",
                      borderRadius: "8px"
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="completed" fill="var(--primary)" name="Concluídos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="scheduled" fill="#C9CCD1" name="Agendados" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Serviços por Equipe</CardTitle>
              <CardDescription>Distribuição de serviços entre as equipes</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={servicesByTeamData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="services"
                    nameKey="team"
                  >
                    {servicesByTeamData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => [`${value} serviços`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 w-full">
                {servicesByTeamData.map((entry, index) => {
                  const total = servicesByTeamData.reduce((acc, curr) => acc + curr.services, 0)
                  return (
                    <div key={entry.team} className="flex items-center gap-1.5 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-muted-foreground whitespace-nowrap">
                        {entry.team}: {Math.round((entry.services / total) * 100)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Resumo de Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-3xl font-bold text-primary">{dashboardStats.completedServices}</div>
                  <div className="text-sm text-muted-foreground">Serviços Concluídos</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-3xl font-bold text-blue-600">{dashboardStats.scheduledServices}</div>
                  <div className="text-sm text-muted-foreground">Serviços Agendados</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                  <div className="text-3xl font-bold text-yellow-600">2</div>
                  <div className="text-sm text-muted-foreground">Emergências</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="text-3xl font-bold text-green-600">98%</div>
                  <div className="text-sm text-muted-foreground">Taxa de Conclusão</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedReport === "financial" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Faturamento Mensal</CardTitle>
              <CardDescription>Evolução do faturamento nos últimos meses</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)} 
                    contentStyle={{ 
                      backgroundColor: "var(--card)", 
                      border: "1px solid var(--border)",
                      borderRadius: "8px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="var(--primary)" 
                    strokeWidth={3}
                    dot={{ fill: "var(--primary)", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
                  <span className="text-green-700 font-medium">Faturamento do Mês</span>
                  <span className="font-bold text-green-700">{formatCurrency(dashboardStats.monthlyRevenue)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-blue-700 font-medium">Recebido</span>
                  <span className="font-bold text-blue-700">{formatCurrency(dashboardStats.monthlyRevenue * 0.85)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <span className="text-yellow-700 font-medium">A Receber</span>
                  <span className="font-bold text-yellow-700">{formatCurrency(dashboardStats.monthlyRevenue * 0.15)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                  <span className="text-red-700 font-medium">Inadimplencia</span>
                  <span className="font-bold text-red-700">{formatCurrency(dashboardStats.overdueInstallmentsValue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Indicadores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Taxa de Adimplência</span>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">95.7%</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Ticket Medio</span>
                  <span className="font-medium">{formatCurrency(dashboardStats.monthlyRevenue / dashboardStats.activeClients)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Crescimento</span>
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/20">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {dashboardStats.monthlyRevenueChange}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Contratos Ativos</span>
                  <span className="font-medium">{contracts.filter(c => c.status === "active").length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedReport === "clients" && (
        <Card>
          <CardHeader>
            <CardTitle>Listagem de Clientes</CardTitle>
            <CardDescription>Total de {clients.length} clientes cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <h4 className="font-medium">{client.companyName}</h4>
                    <p className="text-sm text-muted-foreground">{client.responsibleName} - {client.phone}</p>
                  </div>
                  <Badge className={client.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-700 hover:bg-gray-100"}>
                    {client.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedReport === "teams" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {dashboardStats.teamProductivity.map((team) => (
            <Card key={team.teamId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {team.teamName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Serviços Realizados</span>
                    <span className="text-2xl font-bold">{team.completedServices}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Serviços Agendados</span>
                    <span className="text-2xl font-bold text-blue-600">{team.scheduledServices}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all"
                      style={{ width: `${(team.completedServices / (team.completedServices + team.scheduledServices)) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedReport === "contracts" && (
        <Card>
          <CardHeader>
            <CardTitle>Contratos</CardTitle>
            <CardDescription>Total de {contracts.length} contratos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {contracts.map((contract) => {
                const client = clients.find(c => c.id === contract.clientId)
                return (
                  <div key={contract.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <h4 className="font-medium">{contract.contractNumber}</h4>
                      <p className="text-sm text-muted-foreground">{client?.companyName}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(contract.totalValue)}</div>
                      <Badge className={
                        contract.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-100" :
                        contract.status === "expired" ? "bg-red-100 text-red-700 hover:bg-red-100" :
                        "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                      }>
                        {contract.status === "active" ? "Ativo" :
                         contract.status === "expired" ? "Vencido" :
                         contract.status === "pending_signature" ? "Pendente" : contract.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
