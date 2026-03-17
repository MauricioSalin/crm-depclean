"use client"

import { use } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ContractDetail } from "@/components/contratos/contract-detail"
import { Button } from "@/components/ui/button"
import { Edit, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ContractDetailPage({ params }: PageProps) {
  const { id } = use(params)
  
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Detalhes do Contrato"
          description="Visualize todas as informações do contrato"
          actions={
            <>
              <Link href="/contratos" className="flex-1 sm:flex-initial">
                <Button variant="outline" className="w-full h-9 text-sm bg-transparent">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              </Link>
              <Link href={`/contratos/${id}/editar`} className="flex-1 sm:flex-initial">
                <Button className="w-full bg-primary hover:bg-primary/90">
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Contrato
                </Button>
              </Link>
            </>
          }
        />
        <div className="mt-4 md:mt-5">
          <ContractDetail contractId={id} />
        </div>
      </main>
    </div>
  )
}
