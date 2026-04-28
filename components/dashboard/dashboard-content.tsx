"use client"

import { useState } from "react"

import { Header } from "@/components/dashboard/header"
import { StatsCards, ProductivityCards } from "@/components/dashboard/stats-cards"
import { ProjectAnalytics } from "@/components/dashboard/project-analytics"
import { UpcomingServices } from "@/components/dashboard/reminders"
import { ClientList } from "@/components/dashboard/project-list"
import { TeamCollaboration } from "@/components/dashboard/team-collaboration"
import { ServiceDistribution } from "@/components/dashboard/project-progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const PERIOD_OPTIONS = [30, 60, 90] as const
type DashboardPeriod = (typeof PERIOD_OPTIONS)[number]

export function DashboardContent() {
  const [periodDays, setPeriodDays] = useState<DashboardPeriod>(30)

  return (
    <>
      <Header
        title="Dashboard"
        description="Visão geral da operação da Depclean"
        actions={
          <Tabs
            value={String(periodDays)}
            onValueChange={(value) => setPeriodDays(Number(value) as DashboardPeriod)}
            className="shrink-0"
          >
            <TabsList className="grid grid-cols-3">
              {PERIOD_OPTIONS.map((days) => (
                <TabsTrigger key={days} value={String(days)} className="cursor-pointer text-xs">
                  {days} dias
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <div className="mt-4 md:mt-5 space-y-3 md:space-y-4">
        <StatsCards days={periodDays} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 items-stretch">
          <div className="order-1 lg:order-none lg:col-span-2">
            <ProjectAnalytics />
          </div>

          <div className="order-3 lg:order-none">
            <ServiceDistribution showDescription={false} />
          </div>

          <div className="order-2 lg:order-none lg:col-span-2">
            <TeamCollaboration />
          </div>

          <div className="order-4 lg:order-none">
            <UpcomingServices />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <ClientList />
          <ProductivityCards />
        </div>
      </div>
    </>
  )
}
