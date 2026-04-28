"use client"

import { useParams } from "next/navigation"

import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { CertificateEditorContent } from "@/components/certificados/certificate-editor-content"

export default function CertificadoEditorPage() {
  const params = useParams<{ scheduleId: string }>()
  const scheduleId = String(params.scheduleId ?? "")

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:ml-60 lg:px-5">
        <Header title="Gerar Certificado" description="Revise o documento final antes do envio ao cliente" />
        <div className="mt-4 md:mt-5">
          <CertificateEditorContent scheduleId={scheduleId} />
        </div>
      </main>
    </div>
  )
}
