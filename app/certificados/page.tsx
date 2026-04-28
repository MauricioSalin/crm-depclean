"use client"

import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { CertificatesContent } from "@/components/certificados/certificates-content"

export default function CertificadosPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:ml-60 lg:px-5">
        <Header title="Certificados" description="Gere e envie certificados de visitas concluídas" />
        <div className="mt-4 md:mt-5">
          <CertificatesContent />
        </div>
      </main>
    </div>
  )
}
