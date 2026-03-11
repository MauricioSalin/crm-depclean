import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ServicesContent } from "@/components/servicos/services-content"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export default function ServicosPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Serviços"
          description="Gerencie os serviços oferecidos pela Depclean"
          actions={
            <Link href="/servicos/novo">
              <Button
                className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Serviço
              </Button>
            </Link>
          }
        />

        <div className="mt-4 md:mt-5">
          <ServicesContent />
        </div>
      </main>
    </div>
  )
}
