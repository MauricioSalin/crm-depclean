"use client"

import { ArrowUpRight, ArrowDownRight, ArrowRight, Users, DollarSign, Calendar, CheckCircle, AlertTriangle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { dashboardStats, formatCurrency, teams } from "@/lib/mock-data"
import Link from "next/link"
import { getColorFromClass } from "@/lib/utils"

export function StatsCards() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const stats = [
    {
      title: "Clientes Ativos",
      value: dashboardStats.activeClients.toString(),
      change: `+${dashboardStats.activeClientsChange}%`,
      isPositive: true,
      icon: Users,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "0ms",
    },
    {
      title: "Faturamento Mensal",
      value: formatCurrency(dashboardStats.monthlyRevenue),
      change: `+${dashboardStats.monthlyRevenueChange}%`,
      isPositive: true,
      icon: DollarSign,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "100ms",
    },
    {
      title: "Serviços Agendados",
      value: dashboardStats.scheduledServices.toString(),
      change: `+${dashboardStats.scheduledServicesChange}%`,
      isPositive: true,
      icon: Calendar,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "200ms",
    },
    {
      title: "Serviços Realizados",
      value: dashboardStats.completedServices.toString(),
      change: `+${dashboardStats.completedServicesChange}%`,
      isPositive: true,
      icon: CheckCircle,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "300ms",
    },
    {
      title: "Parcelas Vencidas",
      value: dashboardStats.overdueInstallments.toString(),
      subtitle: formatCurrency(dashboardStats.overdueInstallmentsValue),
      isPositive: false,
      icon: AlertTriangle,
      bgColor: "bg-card",
      textColor: "text-foreground",
      delay: "400ms",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card
            key={stat.title}
            onMouseEnter={() => setHoveredCard(index)}
            onMouseLeave={() => setHoveredCard(null)}
            className={`${stat.bgColor} ${stat.textColor} p-4 transition-all duration-500 ease-out cursor-pointer ${hoveredCard === index ? "scale-105 shadow-2xl" : "shadow-lg"
              }`}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xs font-medium opacity-90">{stat.title}</h3>
              <div
                className={`w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center transition-transform duration-300 ${hoveredCard === index ? "scale-110" : ""
                  }`}
              >
                <Icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold mb-2">{stat.value}</p>
            <div className="flex items-center gap-1.5 text-xs opacity-80">
              {stat.change && (
                <>
                  {stat.isPositive ? (
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                  )}
                  <span className={stat.isPositive ? "text-green-500" : "text-red-500"}>{stat.change}</span>
                </>
              )}
              {stat.subtitle && (
                <span className="text-destructive font-medium">{stat.subtitle}</span>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function ProductivityCards() {
  return (
    <Card className="p-4 transition-all duration-500 hover:shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Produtividade das Equipes</h2>
        <Link href="/equipes">
          <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80">
            Ver todas
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="space-y-3">
        {dashboardStats.teamProductivity.map((team) => {
          const teamColorClass = teams.find((t) => t.id === team.teamId)?.color
          const color = getColorFromClass(teamColorClass || "bg-lime-500")
          const total = team.completedServices + team.scheduledServices
          const completedPct = total > 0 ? Math.round((team.completedServices / total) * 100) : 0
          return (
            <div
              key={team.teamId}
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 min-w-[2.5rem] rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}1A` }}
                >
                  <Users className="h-5 w-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{team.teamName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-medium text-foreground">{team.completedServices} realizados</span>
                    <span className="text-xs text-muted-foreground">{team.scheduledServices} agendados</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Conclusão</p>
                  <p className="text-sm font-semibold">{completedPct}%</p>
                </div>
              </div>
              <div className="mt-3 w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${completedPct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
