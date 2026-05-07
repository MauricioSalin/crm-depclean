import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ContractDetail } from "@/components/contratos/contract-detail"
import { ContractDetailHeaderActions } from "@/components/contratos/contract-detail-header-actions"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ContractDetailPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Detalhes do Contrato"
          description="Visualize todas as informações do contrato"
          actions={<ContractDetailHeaderActions contractId={id} />}
        />
        <div className="mt-4 md:mt-5">
          <ContractDetail contractId={id} />
        </div>
      </main>
    </div>
  )
}
