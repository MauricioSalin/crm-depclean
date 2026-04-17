import { DepAIContent } from "@/components/depai/depai-content"
import { DepAIHeaderActions } from "@/components/depai/depai-header-actions"
import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"

export default function DepAIPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex h-screen flex-1 flex-col overflow-hidden px-3 pb-3 md:px-4 lg:ml-60 lg:px-5">
        <Header title="DepAI" description="Chat de IA para documentos, clientes e operações do CRM" headerActions={<DepAIHeaderActions />} />
        <DepAIContent />
      </main>
    </div>
  )
}
