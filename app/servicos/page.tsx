"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ServicesContent } from "@/components/servicos/services-content"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, List, LayoutGrid } from "lucide-react"
import Link from "next/link"

export default function ServicosPage() {
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
          title="Serviços"
          description="Gerencie os serviços oferecidos pela Depclean"
          hasFilters
          viewToggle={toggle}
          actions={
            <Link href="/servicos/novo">
              <Button className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Novo Serviço
              </Button>
            </Link>
          }
        />
        <ServicesContent viewMode={viewMode} viewToggle={toggle} />
      </main>
    </div>
  )
}
