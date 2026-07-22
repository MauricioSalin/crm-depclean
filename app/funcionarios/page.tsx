"use client"

import { Suspense, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { EmployeesContent } from "@/components/funcionarios/employees-content"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, List, LayoutGrid } from "lucide-react"
import { useResponsiveDefaultViewMode } from "@/hooks/use-responsive-default-view-mode"
import { useHasAnyPermission } from "@/hooks/use-permissions"

export default function FuncionariosPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useResponsiveDefaultViewMode("table", "cards")
  const canCreateEmployees = useHasAnyPermission(["employees_create"])

  const toggle = (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "cards")}>
      <TabsList>
        <TabsTrigger value="table"><List className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="cards"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
      </TabsList>
    </Tabs>
  )

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex min-h-screen flex-1 flex-col px-3 pb-4 md:h-screen md:min-h-0 md:overflow-hidden md:px-4 md:[@media(max-height:799px)]:h-[calc(100dvh+140px)] md:[@media(max-height:799px)]:min-h-[calc(100dvh+140px)] lg:ml-60 lg:px-5">
        <Header
          title="Funcionários"
          description="Gerencie os funcionários da Depclean."
          hasFilters
          viewToggle={toggle}
          actions={canCreateEmployees ? (
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <Button
                onClick={() => setDialogOpen(true)}
                className="h-9 min-w-0 flex-1 bg-primary text-sm text-primary-foreground hover:bg-primary/90 sm:w-auto sm:flex-none"
              >
                <Plus className="h-4 w-4 shrink-0 sm:mr-2" />
                <span className="truncate">Novo Funcionário</span>
              </Button>
            </div>
          ) : undefined}
        />
        <Suspense fallback={<ContentLoadingSkeleton className="mt-4 md:mt-5" />}>
          <EmployeesContent
            viewMode={viewMode}
            viewToggle={toggle}
            openDialog={canCreateEmployees && dialogOpen}
            onDialogChange={setDialogOpen}
          />
        </Suspense>
      </main>
    </div>
  )
}
