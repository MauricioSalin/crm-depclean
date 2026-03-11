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
            <div className="flex gap-2">
              <Link href="/contratos">
                <Button variant="outline" className="w-full sm:w-auto h-9 text-sm bg-transparent">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              </Link>
              <Link href={`/contratos/${id}/editar`}>
                <Button className="bg-primary hover:bg-primary/90">
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Contrato
                </Button>
              </Link>
            </div>
          }
        />
        <div className="mt-4 md:mt-5">
          <ContractDetail contractId={id} />
        </div>
      </main>
    </div>
  )
}
