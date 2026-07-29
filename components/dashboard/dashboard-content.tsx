"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { DateRange } from "react-day-picker"

import { Header } from "@/components/dashboard/header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { ProjectAnalytics } from "@/components/dashboard/project-analytics"
import { UpcomingServices } from "@/components/dashboard/reminders"
import { ContractStatusChart } from "@/components/dashboard/contract-status-chart"
import { ContractRenewalChart } from "@/components/dashboard/contract-renewal-chart"
import { ServiceDistribution } from "@/components/dashboard/project-progress"
import { LiveServicesWidget } from "@/components/dashboard/custom-dashboard-widgets"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { DashboardAnalyticsParams } from "@/lib/api/analytics"
import { getStoredUser } from "@/lib/auth/session"
import { toCivilDateKey } from "@/lib/date-utils"
import { useUrlDateRangeState } from "@/lib/hooks/use-url-date-range-state"
import { useUrlQueryState } from "@/lib/hooks/use-url-query-state"

const PERIOD_OPTIONS = [30, 60, 90] as const
type DashboardPeriod = (typeof PERIOD_OPTIONS)[number]
type DashboardPeriodTab = DashboardPeriod | "custom"

function formatDateParam(date?: Date) {
  return date ? toCivilDateKey(date) : undefined
}

export function DashboardContent() {
  const [periodParam, setPeriodParam] = useUrlQueryState("period", "30", { debounceMs: 0 })
  const periodTab: DashboardPeriodTab = periodParam === "custom"
    ? "custom"
    : PERIOD_OPTIONS.find((period) => String(period) === periodParam) ?? 30
  const [dateRange, setDateRange] = useUrlDateRangeState()
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false)
  const dashboardStorageKey = useMemo(() => {
    const user = getStoredUser()
    return `depclean:dashboard-widgets:${user?.id ?? user?.email ?? "default"}`
  }, [])

  const openCustomDatePicker = () => {
    setPeriodParam("custom")
    setDateRange(undefined)
    setIsCustomDatePickerOpen(true)
  }

  const handlePeriodChange = (value: string) => {
    if (value === "custom") {
      openCustomDatePicker()
      return
    }

    const nextPeriod = PERIOD_OPTIONS.find((period) => String(period) === value)

    if (!nextPeriod) return

    setPeriodParam(String(nextPeriod))
    setDateRange(undefined)
    setIsCustomDatePickerOpen(false)
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range)
    setPeriodParam("custom")

    if (range?.from && range?.to) {
      setIsCustomDatePickerOpen(false)
      return
    }

    setIsCustomDatePickerOpen(true)
  }

  const dashboardParams: DashboardAnalyticsParams =
    periodTab === "custom" && dateRange?.from && dateRange?.to
      ? {
          dateFrom: formatDateParam(dateRange.from),
          dateTo: formatDateParam(dateRange.to),
        }
      : { days: periodTab === "custom" ? 30 : periodTab }

  const periodControls = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Tabs value={String(periodTab)} onValueChange={handlePeriodChange} className="shrink-0">
        <TabsList className="grid grid-cols-4">
          {PERIOD_OPTIONS.map((days) => (
            <TabsTrigger key={days} value={String(days)} className="cursor-pointer text-xs">
              {days} dias
            </TabsTrigger>
          ))}
          <TabsTrigger value="custom" className="cursor-pointer text-xs" onClick={openCustomDatePicker}>
            Outro
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <AnimatePresence initial={false}>
        {periodTab === "custom" && (
          <motion.div
            key="dashboard-date-range"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20 w-full overflow-visible sm:w-auto"
          >
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              open={isCustomDatePickerOpen}
              onOpenChange={setIsCustomDatePickerOpen}
              className="w-full sm:w-[360px]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <>
      <Header
        title="Dashboard"
        description="Visão geral da operação da Depclean."
      />

      <div className="mt-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {periodControls}
        </div>
      </div>

      <div className="mt-4 md:mt-5 space-y-3 md:space-y-4">
        <StatsCards {...dashboardParams} />

        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
          <div className="h-full lg:col-span-2">
            <ProjectAnalytics {...dashboardParams} />
          </div>
          <div className="h-full">
            <ServiceDistribution showDescription={false} {...dashboardParams} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
          <div className="h-full">
            <LiveServicesWidget storageKey={`${dashboardStorageKey}:live-services-status`} />
          </div>
          <div className="h-full">
            <UpcomingServices {...dashboardParams} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
          <div className="h-full">
            <ContractStatusChart />
          </div>
          <div className="h-full">
            <ContractRenewalChart />
          </div>
        </div>
      </div>
    </>
  )
}
