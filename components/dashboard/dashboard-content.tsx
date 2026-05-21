"use client"

import { useState } from "react"
import { format, subDays } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import type { DateRange } from "react-day-picker"

import { Header } from "@/components/dashboard/header"
import { StatsCards, ProductivityCards } from "@/components/dashboard/stats-cards"
import { ProjectAnalytics } from "@/components/dashboard/project-analytics"
import { UpcomingServices } from "@/components/dashboard/reminders"
import { ClientList } from "@/components/dashboard/project-list"
import { TeamCollaboration } from "@/components/dashboard/team-collaboration"
import { ServiceDistribution } from "@/components/dashboard/project-progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { DashboardAnalyticsParams } from "@/lib/api/analytics"

const PERIOD_OPTIONS = [30, 60, 90] as const
type DashboardPeriod = (typeof PERIOD_OPTIONS)[number]
type DashboardPeriodTab = DashboardPeriod | "custom"

function getRangeForDays(days: DashboardPeriod): DateRange {
  const today = new Date()

  return {
    from: subDays(today, days - 1),
    to: today,
  }
}

function formatDateParam(date?: Date) {
  return date ? format(date, "yyyy-MM-dd") : undefined
}

export function DashboardContent() {
  const [periodTab, setPeriodTab] = useState<DashboardPeriodTab>(30)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => getRangeForDays(30))

  const handlePeriodChange = (value: string) => {
    if (value === "custom") {
      setPeriodTab("custom")
      return
    }

    const nextPeriod = PERIOD_OPTIONS.find((period) => String(period) === value)

    if (!nextPeriod) return

    setPeriodTab(nextPeriod)
    setDateRange(getRangeForDays(nextPeriod))
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range)
    setPeriodTab("custom")
  }

  const dashboardParams: DashboardAnalyticsParams = {
    days: typeof periodTab === "number" ? periodTab : undefined,
    dateFrom: formatDateParam(dateRange?.from),
    dateTo: formatDateParam(dateRange?.to ?? dateRange?.from),
  }

  const periodControls = (
    <motion.div layout className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Tabs value={String(periodTab)} onValueChange={handlePeriodChange} className="shrink-0">
        <TabsList className="grid grid-cols-4">
          {PERIOD_OPTIONS.map((days) => (
            <TabsTrigger key={days} value={String(days)} className="cursor-pointer text-xs">
              {days} dias
            </TabsTrigger>
          ))}
          <TabsTrigger value="custom" className="cursor-pointer text-xs">
            Outro
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <AnimatePresence initial={false}>
        {periodTab === "custom" && (
          <motion.div
            key="dashboard-date-range"
            layout
            initial={{ opacity: 0, height: 0, x: -10, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", x: 0, scale: 1 }}
            exit={{ opacity: 0, height: 0, x: -10, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="w-full origin-left overflow-hidden sm:w-auto"
          >
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              className="w-full sm:w-[218px]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )

  return (
    <>
      <Header
        title="Dashboard"
        description="Visão geral da operação da Depclean"
      />

      <div className="mt-3">
        {periodControls}
      </div>

      <div className="mt-4 md:mt-5 space-y-3 md:space-y-4">
        <StatsCards {...dashboardParams} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 items-stretch">
          <div className="order-1 lg:order-none lg:col-span-2">
            <ProjectAnalytics {...dashboardParams} />
          </div>

          <div className="order-3 lg:order-none">
            <ServiceDistribution showDescription={false} {...dashboardParams} />
          </div>

          <div className="order-2 lg:order-none lg:col-span-2">
            <TeamCollaboration {...dashboardParams} />
          </div>

          <div className="order-4 lg:order-none">
            <UpcomingServices {...dashboardParams} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <ClientList {...dashboardParams} />
          <ProductivityCards {...dashboardParams} />
        </div>
      </div>
    </>
  )
}
