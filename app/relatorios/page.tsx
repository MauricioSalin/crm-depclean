import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { RelatoriosContent } from "@/components/relatorios/relatorios-content"
import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"

export default function RelatoriosPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Relatórios"
          description="Visualize e exporte relatórios de desempenho"
        />

        <div className="mt-4 md:mt-5">
          <RelatoriosContent />
        </div>
      </main>
    </div>
  )
}
