"use client"

import { Suspense, useState } from "react"
import { LayoutGrid, List, Plus } from "lucide-react"

import { CertificatesContent } from "@/components/certificados/certificates-content"
import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function CertificadosPage() {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [createOpen, setCreateOpen] = useState(false)

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

      <main className="flex min-h-screen flex-1 flex-col px-3 pb-4 md:h-screen md:min-h-0 md:overflow-hidden md:px-4 lg:ml-60 lg:px-5">
        <Header
          title="Certificados"
          description="Gere e envie certificados de visitas concluídas."
          hasFilters
          viewToggle={toggle}
          actions={
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-9 w-full bg-primary text-sm text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar novo
            </Button>
          }
        />
        <Suspense fallback={<ContentLoadingSkeleton className="mt-4 md:mt-5" />}>
          <CertificatesContent
            viewMode={viewMode}
            viewToggle={toggle}
            createOpen={createOpen}
            onCreateOpenChange={setCreateOpen}
          />
        </Suspense>
      </main>
    </div>
  )
}
