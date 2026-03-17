"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { AgendaContent } from "@/components/agenda/agenda-content"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, LayoutGrid, List } from "lucide-react"
import { SchedulingFormDialog, type SchedulingFormData } from "@/components/agendamentos/scheduling-form-dialog"
import { mockClients, mockServiceTypes, formatCurrency } from "@/lib/mock-data"

export default function AgendaPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"month" | "list">("month")

  const toggle = (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "month" | "list")}>
      <TabsList>
        <TabsTrigger value="month"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="list"><List className="h-4 w-4" /></TabsTrigger>
      </TabsList>
    </Tabs>
  )

  const handleFormSubmit = (formData: SchedulingFormData) => {
    const client = mockClients.find(c => c.id === formData.clientId)
    const serviceType = mockServiceTypes.find(st => st.id === formData.serviceTypeId)
    if (!client || !serviceType) return

    if (formData.createContract && formData.value > 0) {
      alert(`Agendamento criado! Cobrança de ${formatCurrency(formData.value)} gerada no financeiro.`)
    }

    setDialogOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Agenda"
          description="Gerencie os agendamentos e compromissos da equipe"
          viewToggle={toggle}
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

        <SchedulingFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleFormSubmit}
        />

        <AgendaContent viewMode={viewMode} viewToggle={toggle} />
      </main>
    </div>
  )
}
