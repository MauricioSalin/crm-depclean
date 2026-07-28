"use client"

import { Suspense, useEffect, useState } from "react"
import { Download, LayoutGrid, List, Plus } from "lucide-react"

import { AgendamentosContent } from "@/components/agendamentos/agendamentos-content"
import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useResponsiveDefaultViewMode } from "@/hooks/use-responsive-default-view-mode"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"

type AgendamentosPageClientProps = {
  initialScheduleId?: string
}

export function AgendamentosPageClient({ initialScheduleId }: AgendamentosPageClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useResponsiveDefaultViewMode("table", "cards")
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const canManageAgenda = hasAnyPermission(currentUser, ["agenda_manage"])

  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  const toggle = (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "cards")}>
      <TabsList>
        <TabsTrigger value="table" aria-label="Visualizar agendamentos em tabela"><List className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="cards" aria-label="Visualizar agendamentos em cartões"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
      </TabsList>
    </Tabs>
  )

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex min-h-screen flex-1 flex-col px-3 pb-4 md:h-screen md:min-h-0 md:overflow-hidden md:px-4 md:[@media(max-height:799px)]:h-[calc(100dvh+100px)] md:[@media(max-height:799px)]:min-h-[calc(100dvh+100px)] lg:ml-60 lg:px-5">
        <Header
          title="Agendamentos"
          description="Gerencie todos os agendamentos de serviços."
          hasFilters
          viewToggle={toggle}
          actions={canManageAgenda ? (
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExportDialogOpen(true)}
                className="h-9 min-w-0 flex-1 text-sm sm:w-auto sm:flex-none"
              >
                <Download className="h-4 shrink-0 sm:mr-2" />
                <span className="truncate">Exportar</span>
              </Button>
              <Button
                onClick={() => setDialogOpen(true)}
                className="h-9 min-w-0 flex-1 bg-primary text-sm text-primary-foreground hover:bg-primary/90 sm:w-auto sm:flex-none"
              >
                <Plus className="h-4 shrink-0 sm:mr-2" />
                <span className="truncate">Novo Agendamento</span>
              </Button>
            </div>
          ) : undefined}
        />
        <Suspense fallback={<ContentLoadingSkeleton className="mt-4 md:mt-5" />}>
          <AgendamentosContent
            viewMode={viewMode}
            viewToggle={toggle}
            openDialog={canManageAgenda && dialogOpen}
            onDialogChange={setDialogOpen}
            openExport={canManageAgenda && exportDialogOpen}
            onExportChange={setExportDialogOpen}
            initialScheduleId={initialScheduleId}
          />
        </Suspense>
      </main>
    </div>
  )
}
