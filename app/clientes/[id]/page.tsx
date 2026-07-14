import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ClientProfile } from "@/components/clientes/client-profile"
import { ClientProfileHeaderActions } from "@/components/clientes/client-profile-header-actions"
import { getFirstSearchParam, getSafeReturnTo } from "@/lib/navigation"

interface ClientPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ClientPage({ params, searchParams }: ClientPageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const backHref = getSafeReturnTo(getFirstSearchParam(resolvedSearchParams?.returnTo), "/clientes")

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Perfil do Cliente"
          description="Visualize e gerencie todas as informações do cliente"
          actions={<ClientProfileHeaderActions clientId={id} backHref={backHref} />}
        />

        <div className="mt-4 md:mt-5">
          <ClientProfile clientId={id} />
        </div>
      </main>
    </div>
  )
}
