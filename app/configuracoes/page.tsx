import { Suspense } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ConfiguracoesContent } from "@/components/configuracoes/configuracoes-content"

export default function ConfiguracoesPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Configurações"
          description="Personalize as configurações do sistema Depclean"
        />

        <div className="mt-4 md:mt-5">
          <Suspense fallback={<div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Carregando configurações...</div>}>
            <ConfiguracoesContent />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
