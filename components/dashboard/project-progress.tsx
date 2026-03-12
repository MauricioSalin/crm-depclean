"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { servicesByTeamData } from "@/lib/mock-data"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export function ServiceDistribution({ showDescription = true }: { showDescription?: boolean }) {
  const total = servicesByTeamData.reduce((acc, curr) => acc + curr.services, 0)

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Serviços por Equipe</CardTitle>
        {showDescription && (
          <CardDescription>Distribuição de serviços entre as equipes</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <ResponsiveContainer width="100%" height={200}>
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
              {servicesByTeamData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [`${value} serviços`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 w-full">
          {servicesByTeamData.map((entry, index) => (
            <div key={entry.team} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-muted-foreground whitespace-nowrap">
                {entry.team}: {Math.round((entry.services / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const FINANCE_COLORS = ['#22C55E', '#F59E0B', '#EF4444']
const financeData = [
  { name: 'Pagas', value: 85 },
  { name: 'Pendentes', value: 10 },
  { name: 'Vencidas', value: 5 },
]

export function FinancialOverview() {
  const total = financeData.reduce((acc, curr) => acc + curr.value, 0)
  const paidPercentage = Math.round((financeData[0].value / total) * 100)

  return (
    <Card
      className="p-4 transition-all duration-500 hover:shadow-xl overflow-hidden"
    >
      <h2 className="text-lg font-semibold text-foreground mb-4">Saúde Financeira</h2>
      <div className="flex flex-col items-center">
        <div className="relative w-40 h-40 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={financeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {financeData.map((entry, index) => (
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
            <span className="text-3xl font-bold text-foreground">{paidPercentage}%</span>
            <span className="text-xs text-muted-foreground mt-1">Adimplência</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          {financeData.map((item, index) => (
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
  )
}

// Keep backward compatibility
export { ServiceDistribution as ProjectProgress }
