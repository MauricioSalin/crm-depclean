"use client"

import { use } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ServiceForm } from "@/components/servicos/service-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditServicePage({ params }: PageProps) {
  const { id } = use(params)

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Editar Serviço"
          description="Atualize as informações do serviço"
          actions={
            <Link href={`/servicos/${id}`}>
              <Button variant="outline" className="w-full sm:w-auto h-9 text-sm bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
          }
        />
        <div className="mt-4 md:mt-5">
          <ServiceForm serviceId={id} isEditing />
        </div>
      </main>
    </div>
  )
}
