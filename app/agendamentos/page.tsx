"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { AgendamentosContent } from "@/components/agendamentos/agendamentos-content"

export default function AgendamentosPage() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Agendamentos"
          description="Gerencie todos os agendamentos de serviços"
          actions={
            <Button
              onClick={() => setDialogOpen(true)}
              className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          }
        />

        <div className="mt-4 md:mt-5">
          <AgendamentosContent
            openDialog={dialogOpen}
            onDialogChange={setDialogOpen}
          />
        </div>
      </main>
    </div>
  )
}
