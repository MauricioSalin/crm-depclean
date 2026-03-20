"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ContractsContent } from "@/components/contratos/contracts-content"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { List, LayoutGrid } from "lucide-react"

export default function ContratosPage() {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")

  const toggle = (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "cards")}>
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

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Contratos"
          description="Gerencie todos os contratos da Depclean"
          hasFilters
          viewToggle={toggle}
          actions={
            <Link href="/contratos/novo">
              <Button className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                + Novo Contrato
              </Button>
            </Link>
          }
        />
        <ContractsContent viewMode={viewMode} viewToggle={toggle} />
      </main>
    </div>
  )
}
