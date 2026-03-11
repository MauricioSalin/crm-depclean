"use client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ContractForm } from "@/components/contratos/contract-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NewContractPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Novo Contrato"
          description="Crie um novo contrato para um cliente"
          actions={
            <Link href="/contratos">
              <Button variant="outline" className="w-full sm:w-auto h-9 text-sm bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
          }
        />
        <div className="mt-4 md:mt-5">
          <ContractForm />
        </div>
      </main>
    </div>
  )
}
