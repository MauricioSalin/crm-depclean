"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { TeamsContent } from "@/components/equipes/teams-content"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { List, LayoutGrid } from "lucide-react"

export default function EquipesPage() {
  const [openDialog, setOpenDialog] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  const toggle = (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "table")}>
      <TabsList>
        <TabsTrigger value="table"><List className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="grid"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
      </TabsList>
    </Tabs>
  )

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Equipes"
          description="Gerencie as equipes de serviço da Depclean"
          viewToggle={toggle}
          actions={
            <Button
              onClick={() => setOpenDialog(true)}
              className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + Nova Equipe
            </Button>
          }
        />
        <TeamsContent viewMode={viewMode} viewToggle={toggle} openDialog={openDialog} onDialogChange={setOpenDialog} />
      </main>
    </div>
  )
}
