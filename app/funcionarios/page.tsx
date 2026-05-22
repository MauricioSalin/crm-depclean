"use client"

import { Suspense, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { EmployeesContent } from "@/components/funcionarios/employees-content"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUp, Plus, List, LayoutGrid } from "lucide-react"

export default function FuncionariosPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")

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
          title="Funcionários"
          description="Gerencie os funcionários da Depclean."
          hasFilters
          viewToggle={toggle}
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)} className="w-full sm:w-auto h-9 text-sm">
                <FileUp className="w-4 h-4 mr-2" />
                Importar
              </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Funcionário
            </Button>
            </div>
          }
        />
        <Suspense fallback={<ContentLoadingSkeleton className="mt-4 md:mt-5" />}>
          <EmployeesContent
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
