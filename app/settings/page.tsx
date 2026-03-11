import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { SettingsContent } from "@/components/settings/settings-content"

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header title="Configurações" description="Gerencie suas preferências e configurações do sistema." />

        <div className="mt-4 md:mt-5">
          <SettingsContent />
        </div>
      </main>
    </div>
  )
}
