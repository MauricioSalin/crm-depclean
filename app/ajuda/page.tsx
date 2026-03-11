import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { AjudaContent } from "@/components/ajuda/ajuda-content"

export default function AjudaPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Ajuda"
          description="Central de ajuda e suporte do sistema Depclean"
        />

        <div className="mt-4 md:mt-5">
          <AjudaContent />
        </div>
      </main>
    </div>
  )
}
