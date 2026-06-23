"use client"

import { Suspense, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import {
  ConfiguracoesContent,
  SETTINGS_CREATE_ACTION_EVENT,
  type SettingsCreateAction,
} from "@/components/configuracoes/configuracoes-content"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"

type SettingsSection = "empresa" | "tipos-cliente" | "permissoes" | "usuarios" | "notificações"

const DEFAULT_SECTION: SettingsSection = "tipos-cliente"

const SETTINGS_ACTIONS: Partial<Record<SettingsSection, { label: string; action: SettingsCreateAction }>> = {
  "tipos-cliente": { label: "Novo Tipo", action: "client-type" },
  permissoes: { label: "Novo Perfil", action: "profile" },
  usuarios: { label: "Novo Usuário", action: "user" },
}

function getSettingsSection(value: string | null): SettingsSection {
  if (value === "empresa" || value === "tipos-cliente" || value === "permissoes" || value === "usuarios" || value === "notificações") {
    return value
  }

  return DEFAULT_SECTION
}

export default function ConfiguracoesPage() {
  const searchParams = useSearchParams()
  const activeSection = getSettingsSection(searchParams.get("section"))
  const actionConfig = SETTINGS_ACTIONS[activeSection]
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const canManageSettings = hasAnyPermission(currentUser, ["settings_manage"])

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
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Configurações"
          description="Personalize as configurações do sistema Depclean."
          hasFilters={activeSection !== "empresa"}
          actions={
            canManageSettings && actionConfig ? (
              <Button
                type="button"
                className="h-9 w-full min-w-0 bg-primary text-sm text-primary-foreground hover:bg-primary/90 sm:w-auto"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent(SETTINGS_CREATE_ACTION_EVENT, {
                      detail: { action: actionConfig.action },
                    }),
                  )
                }}
              >
                <Plus className="h-4 w-4 shrink-0 sm:mr-2" />
                <span className="truncate">{actionConfig.label}</span>
              </Button>
            ) : null
          }
        />

        <div className="mt-4 md:mt-5">
          <Suspense fallback={<ContentLoadingSkeleton />}>
            <ConfiguracoesContent />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
