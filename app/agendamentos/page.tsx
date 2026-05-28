"use client"

import { Suspense, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUp, Plus, List, LayoutGrid } from "lucide-react"
import { AgendamentosContent } from "@/components/agendamentos/agendamentos-content"
import { useResponsiveDefaultViewMode } from "@/hooks/use-responsive-default-view-mode"

export default function AgendamentosPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [viewMode, setViewMode] = useResponsiveDefaultViewMode("table", "cards")

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

      <main className="flex min-h-screen flex-1 flex-col px-3 pb-4 md:h-screen md:min-h-0 md:overflow-hidden md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Agendamentos"
          description="Gerencie todos os agendamentos de serviços."
          hasFilters
          viewToggle={toggle}
          actions={
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="h-9 w-9 shrink-0 px-0 sm:w-auto sm:px-4"
                aria-label="Importar agendamentos"
                title="Importar agendamentos"
              >
                <FileUp className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Importar</span>
              </Button>
              <Button
                onClick={() => setDialogOpen(true)}
                className="h-9 min-w-0 flex-1 text-sm bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:flex-none"
              >
                <Plus className="h-4 w-4 shrink-0 sm:mr-2" />
                <span className="truncate">Novo Agendamento</span>
              </Button>
            </div>
          }
        />
        <Suspense fallback={<ContentLoadingSkeleton className="mt-4 md:mt-5" />}>
          <AgendamentosContent
            viewMode={viewMode}
            viewToggle={toggle}
            openDialog={dialogOpen}
            onDialogChange={setDialogOpen}
            openImport={importOpen}
            onImportChange={setImportOpen}
          />
        </Suspense>
      </main>
    </div>
  )
}
