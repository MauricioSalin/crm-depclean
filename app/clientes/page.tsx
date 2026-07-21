"use client"

import { Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ClientsContent } from "@/components/clientes/clients-content"
import { Button } from "@/components/ui/button"
import { ContentLoadingSkeleton } from "@/components/ui/content-loading-skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Plus, List, LayoutGrid } from "lucide-react"
import { buildPathWithSearchParams, withReturnTo } from "@/lib/navigation"
import { useResponsiveDefaultViewMode } from "@/hooks/use-responsive-default-view-mode"
import { useHasAnyPermission } from "@/hooks/use-permissions"

export default function ClientesPage() {
  const [viewMode, setViewMode] = useResponsiveDefaultViewMode("table", "cards")
  const canCreateClients = useHasAnyPermission(["clients_create"])
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentHref = buildPathWithSearchParams(pathname, searchParams)

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

      <main className="flex min-h-screen flex-1 flex-col px-3 pb-4 md:h-screen md:min-h-0 md:overflow-hidden md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Clientes"
          description="Gerencie todos os clientes da Depclean."
          hasFilters
          viewToggle={toggle}
          actions={canCreateClients ? (
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <Link href={withReturnTo("/clientes/novo", currentHref)} className="min-w-0 flex-1 sm:flex-none">
                <Button className="h-9 w-full min-w-0 text-sm bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                  <Plus className="h-4 w-4 shrink-0 sm:mr-2" />
                  <span className="truncate">Novo Cliente</span>
                </Button>
              </Link>
            </div>
          ) : undefined}
        />
        <Suspense fallback={<ContentLoadingSkeleton className="mt-4 md:mt-5" />}>
          <ClientsContent
            viewMode={viewMode}
            viewToggle={toggle}
          />
        </Suspense>
      </main>
    </div>
  )
}
