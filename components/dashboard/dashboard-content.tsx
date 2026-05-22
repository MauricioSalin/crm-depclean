"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { format, subDays } from "date-fns"
import { AnimatePresence, motion, Reorder } from "framer-motion"
import { Check, Grip, Pencil, RotateCcw } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Header } from "@/components/dashboard/header"
import { StatsCards, ProductivityCards } from "@/components/dashboard/stats-cards"
import { ProjectAnalytics } from "@/components/dashboard/project-analytics"
import { UpcomingServices } from "@/components/dashboard/reminders"
import { ClientList } from "@/components/dashboard/project-list"
import { TeamCollaboration } from "@/components/dashboard/team-collaboration"
import { ServiceDistribution } from "@/components/dashboard/project-progress"
import { ContractsPulseWidget, LiveServicesWidget } from "@/components/dashboard/custom-dashboard-widgets"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { DashboardAnalyticsParams } from "@/lib/api/analytics"
import { getStoredUser } from "@/lib/auth/session"
import { cn } from "@/lib/utils"

const PERIOD_OPTIONS = [30, 60, 90] as const
type DashboardPeriod = (typeof PERIOD_OPTIONS)[number]
type DashboardPeriodTab = DashboardPeriod | "custom"
type DashboardWidgetId =
  | "analytics"
  | "serviceDistribution"
  | "teamCollaboration"
  | "liveServices"
  | "upcoming"
  | "contractsPulse"
  | "clients"
  | "productivity"

const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [
  "analytics",
  "serviceDistribution",
  "teamCollaboration",
  "liveServices",
  "upcoming",
  "contractsPulse",
  "clients",
  "productivity",
]

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
  const [isEditingDashboard, setIsEditingDashboard] = useState(false)
  const [widgetOrder, setWidgetOrder] = useState<DashboardWidgetId[]>(DEFAULT_WIDGET_ORDER)
  const dashboardStorageKey = useMemo(() => {
    const user = getStoredUser()
    return `depclean:dashboard-widgets:${user?.id ?? user?.email ?? "default"}`
  }, [])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(dashboardStorageKey)
      if (!stored) return
      const parsed = JSON.parse(stored) as DashboardWidgetId[]
      const valid = parsed.filter((id): id is DashboardWidgetId => DEFAULT_WIDGET_ORDER.includes(id))
      const missing = DEFAULT_WIDGET_ORDER.filter((id) => !valid.includes(id))
      setWidgetOrder([...valid, ...missing])
    } catch {
      setWidgetOrder(DEFAULT_WIDGET_ORDER)
    }
  }, [dashboardStorageKey])

  useEffect(() => {
    window.localStorage.setItem(dashboardStorageKey, JSON.stringify(widgetOrder))
  }, [dashboardStorageKey, widgetOrder])

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

  const widgets: Record<DashboardWidgetId, { className: string; node: ReactNode }> = {
    analytics: {
      className: "lg:col-span-2",
      node: <ProjectAnalytics {...dashboardParams} />,
    },
    serviceDistribution: {
      className: "",
      node: <ServiceDistribution showDescription={false} {...dashboardParams} />,
    },
    teamCollaboration: {
      className: "lg:col-span-2",
      node: <TeamCollaboration {...dashboardParams} />,
    },
    liveServices: {
      className: "",
      node: <LiveServicesWidget storageKey={`${dashboardStorageKey}:live-services-status`} />,
    },
    upcoming: {
      className: "",
      node: <UpcomingServices {...dashboardParams} />,
    },
    contractsPulse: {
      className: "lg:col-span-2",
      node: <ContractsPulseWidget {...dashboardParams} />,
    },
    clients: {
      className: "",
      node: <ClientList {...dashboardParams} />,
    },
    productivity: {
      className: "",
      node: <ProductivityCards {...dashboardParams} />,
    },
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
        description="Visão geral da operação da Depclean."
      />

      <div className="mt-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {periodControls}
          <div className="flex flex-wrap gap-2">
            {isEditingDashboard ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setWidgetOrder(DEFAULT_WIDGET_ORDER)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </Button>
            ) : null}
            <Button
              type="button"
              className="rounded-full"
              variant={isEditingDashboard ? "default" : "outline"}
              onClick={() => setIsEditingDashboard((value) => !value)}
            >
              {isEditingDashboard ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Concluir
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar dashboard
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 md:mt-5 space-y-3 md:space-y-4">
        <StatsCards {...dashboardParams} />

        <Reorder.Group
          axis="y"
          values={widgetOrder}
          onReorder={setWidgetOrder}
          className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3"
        >
          {widgetOrder.map((widgetId) => (
            <Reorder.Item
              key={widgetId}
              value={widgetId}
              dragListener={isEditingDashboard}
              whileDrag={{ scale: 1.02, rotate: 0.35, zIndex: 30 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className={cn("relative list-none", widgets[widgetId].className)}
            >
              {isEditingDashboard ? (
                <div className="absolute right-3 top-3 z-10 flex h-9 w-9 cursor-grab items-center justify-center rounded-full border bg-background/95 shadow-sm active:cursor-grabbing">
                  <Grip className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : null}
              <motion.div
                animate={isEditingDashboard ? { y: [0, -1, 1, 0] } : { y: 0 }}
                transition={isEditingDashboard ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : undefined}
                className={cn(isEditingDashboard ? "rounded-2xl ring-1 ring-primary/20" : "")}
              >
                {widgets[widgetId].node}
              </motion.div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    </>
  )
}
