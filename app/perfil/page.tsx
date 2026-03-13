import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { PerfilContent } from "@/components/perfil/perfil-content"

export default function PerfilPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Meu Perfil"
          description="Gerencie suas informações pessoais e configurações de conta"
        />

        <div className="mt-4 md:mt-5">
          <PerfilContent />
        </div>
      </main>
    </div>
  )
}
