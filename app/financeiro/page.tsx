import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { FinanceiroContent } from "@/components/financeiro/financeiro-content"
import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"

export default function FinanceiroPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Financeiro"
          description="Controle financeiro e parcelas de contratos"
          actions={
            <>
              <Button className="w-full sm:w-auto h-9 text-sm">
                <FileText className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
              <Button variant="outline" className="w-full sm:w-auto h-9 text-sm bg-transparent">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </>
          }
        />

        <div className="mt-4 md:mt-5">
          <FinanceiroContent />
        </div>
      </main>
    </div>
  )
}
