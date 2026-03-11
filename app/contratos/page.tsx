import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ContractsContent } from "@/components/contratos/contracts-content"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function ContratosPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Contratos"
          description="Gerencie todos os contratos da Depclean"
          actions={
            <Link href="/contratos/novo">
              <Button className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                + Novo Contrato
              </Button>
            </Link>
          }
        />

        <div className="mt-4 md:mt-5">
          <ContractsContent />
        </div>
      </main>
    </div>
  )
}
