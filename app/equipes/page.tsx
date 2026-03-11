"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { TeamsContent } from "@/components/equipes/teams-content"
import { Button } from "@/components/ui/button"

export default function EquipesPage() {
  const [openDialog, setOpenDialog] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Equipes"
          description="Gerencie as equipes de serviço da Depclean"
          actions={
            <Button 
              onClick={() => setOpenDialog(true)}
              className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + Nova Equipe
            </Button>
          }
        />

        <div className="mt-4 md:mt-5">
          <TeamsContent openDialog={openDialog} onDialogChange={setOpenDialog} />
        </div>
      </main>
    </div>
  )
}
