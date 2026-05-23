import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ClientForm } from "@/components/clientes/client-form"
import { Button } from "@/components/ui/button"
import { getFirstSearchParam, getSafeReturnTo } from "@/lib/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface EditClientPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function EditClientPage({ params, searchParams }: EditClientPageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const backHref = getSafeReturnTo(getFirstSearchParam(resolvedSearchParams?.returnTo), `/clientes/${id}`)

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Editar Cliente"
          description="Atualize as informações do cliente"
          actions={
            <Link href={backHref}>
              <Button variant="outline" className="w-full sm:w-auto h-9 text-sm bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
          }
        />

        <div className="mt-4 md:mt-5">
          <ClientForm clientId={id} isEditing returnTo={backHref} />
        </div>
      </main>
    </div>
  )
}
