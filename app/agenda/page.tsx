"use client"

import { Suspense, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { AgendaContent } from "@/components/agenda/agenda-content"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { Plus } from "lucide-react"

export default function AgendaPage() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex h-dvh bg-background overflow-hidden lg:h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 md:px-4 lg:ml-60 lg:overflow-hidden lg:px-5">
        <Header
          title="Agenda"
          description="Gerencie os agendamentos e compromissos da equipe."
          hasFilters
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

        <Suspense fallback={<ContentLoadingSkeleton className="mt-4" />}>
          <AgendaContent openDialog={dialogOpen} onDialogChange={setDialogOpen} />
        </Suspense>
      </main>
    </div>
  )
}
