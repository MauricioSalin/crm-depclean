"use client"

import { Suspense, useEffect, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { AgendaContent } from "@/components/agenda/agenda-content"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"
import { Plus } from "lucide-react"

export default function AgendaPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
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

  return (
    <div className="flex min-h-dvh bg-background lg:h-screen lg:overflow-hidden [@media(max-height:719px)]:h-auto [@media(max-height:719px)]:min-h-screen [@media(max-height:719px)]:overflow-visible">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 md:px-4 lg:ml-60 lg:overflow-hidden lg:px-5 [@media(max-height:719px)]:overflow-visible">
        <Header
          title="Agenda"
          description="Gerencie os agendamentos e compromissos da equipe."
          hasFilters
          actions={canManageAgenda ? (
            <Button
              onClick={() => setDialogOpen(true)}
              className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          ) : undefined}
        />

        <Suspense fallback={<ContentLoadingSkeleton className="mt-4" />}>
          <AgendaContent openDialog={canManageAgenda && dialogOpen} onDialogChange={setDialogOpen} />
        </Suspense>
      </main>
    </div>
  )
}
