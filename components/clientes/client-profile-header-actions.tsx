"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowLeft, Edit } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useHasAnyPermission } from "@/hooks/use-permissions"
import { buildPathWithSearchParams, withReturnTo } from "@/lib/navigation"

interface ClientProfileHeaderActionsProps {
  clientId: string
  backHref: string
}

export function ClientProfileHeaderActions({ clientId, backHref }: ClientProfileHeaderActionsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const canEditClients = useHasAnyPermission(["clients_edit"])
  const currentHref = buildPathWithSearchParams(pathname, searchParams)

  return (
    <>
      <Link href={backHref}>
        <Button variant="outline" className="w-full sm:w-auto h-9 text-sm bg-transparent">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </Link>
      {canEditClients ? (
        <Link href={withReturnTo(`/clientes/${clientId}/editar`, currentHref)}>
          <Button className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90">
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </Link>
      ) : null}
    </>
  )
}
