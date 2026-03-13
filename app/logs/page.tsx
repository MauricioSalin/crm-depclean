import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { LogsContent } from "@/components/logs/logs-content"

export default function LogsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Logs do Sistema"
          description="Histórico completo de ações realizadas no sistema"
        />

        <div className="mt-4 md:mt-5">
          <LogsContent />
        </div>
      </main>
    </div>
  )
}
