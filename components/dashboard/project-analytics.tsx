"use client"

import {
  FinancialPeriodBarChart,
  ServicesPeriodLineChart,
} from "@/components/analytics/operational-charts"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDashboardAnalytics, type DashboardAnalyticsParams } from "@/lib/api/analytics"
import { useQuery } from "@tanstack/react-query"

export function ProjectAnalytics(period: DashboardAnalyticsParams = {}) {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", period],
    queryFn: () => getDashboardAnalytics(period),
  })
  const isLoading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data)
  const monthlyRevenueData = dashboardQuery.data?.data.monthlyRevenueData ?? []
  const servicesByPeriodData = dashboardQuery.data?.data.servicesByPeriodData ?? []

  return (
    <Card className="flex h-full min-h-[360px] flex-col p-4 md:p-5">
      <Tabs defaultValue="faturamento" className="flex h-full w-full flex-col">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold">Análise Operacional</h3>
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="faturamento" className="text-xs">Faturamento</TabsTrigger>
            <TabsTrigger value="servicos" className="text-xs">Serviços</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="faturamento" className="mt-0">
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <div className="h-[280px] min-w-[540px] sm:min-w-0">
              {isLoading ? (
                <div className="flex h-full items-end gap-3 px-4 pb-6 pt-10">
                  {[58, 82, 46, 72, 64, 88].map((height, index) => (
                    <Skeleton key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%` }} />
                  ))}
                </div>
              ) : (
                <FinancialPeriodBarChart data={monthlyRevenueData} />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="servicos" className="mt-0">
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <div className="h-[280px] min-w-[540px] sm:min-w-0">
              {isLoading ? (
                <div className="flex h-full flex-col justify-end gap-5 px-4 pb-8 pt-10">
                  <Skeleton className="h-3 w-11/12 rotate-[-6deg] rounded-full" />
                  <Skeleton className="h-3 w-10/12 translate-x-4 rotate-[4deg] rounded-full" />
                  <div className="grid grid-cols-4 gap-3">
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-3 rounded-full" />
                    ))}
                  </div>
                </div>
              ) : (
                <ServicesPeriodLineChart data={servicesByPeriodData} />
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
