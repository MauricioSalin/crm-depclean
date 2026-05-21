"use client"

import { Suspense, useState } from "react"
import { LayoutGrid, List } from "lucide-react"

import { CertificatesContent } from "@/components/certificados/certificates-content"
import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function CertificadosPage() {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")

  const toggle = (
    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "table" | "cards")}>
      <TabsList>
        <TabsTrigger value="table"><List className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="cards"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
      </TabsList>
    </Tabs>
  )

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex h-screen min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 md:px-4 lg:ml-60 lg:px-5">
        <Header
          title="Certificados"
          description="Gere e envie certificados de visitas concluídas."
          hasFilters
          viewToggle={toggle}
        />
        <Suspense fallback={<ContentLoadingSkeleton className="mt-4 md:mt-5" />}>
          <CertificatesContent viewMode={viewMode} viewToggle={toggle} />
        </Suspense>
      </main>
    </div>
  )
}
