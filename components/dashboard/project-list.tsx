"use client"

import { Card } from "@/components/ui/card"
import { Plus, ArrowRight, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { clients, clientTypes, contracts, getClientTypeById } from "@/lib/mock-data"
import { getColorFromClass } from "@/lib/utils"
import Link from "next/link"

export function ClientList() {
  const recentClients = clients.slice(0, 5)

  return (
    <Card
      className="p-4 transition-all duration-500 hover:shadow-xl"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Clientes Recentes</h2>
        <Link href="/clientes">
          <Button variant="ghost" size="sm" className="text-xs text-foreground hover:text-foreground/80">
            Ver todos
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="space-y-3">
        {recentClients.map((client, index) => {
          const clientType = getClientTypeById(client.clientTypeId)
          const clientContracts = contracts.filter(c => c.clientId === client.id)
          const activeContracts = clientContracts.filter(c => ["signed", "active"].includes(c.status)).length
          
          return (
            <Link 
              key={client.id}
              href={`/clientes/${client.id}`}
              className="block"
            >
              <div
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-all duration-300 cursor-pointer group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shrink-0"
                  style={{ backgroundColor: `${getColorFromClass(clientType?.color || '')}1A` }}
                >
                  <Building2 className="w-5 h-5" style={{ color: getColorFromClass(clientType?.color || '') }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{client.companyName}</p>
                  <p className="text-xs text-muted-foreground truncate">{client.responsibleName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    style={{ backgroundColor: getColorFromClass(clientType?.color || '') }}
                    className="text-[10px] text-white border-0 hover:opacity-90"
                  >
                    {clientType?.name}
                  </Badge>
                  {activeContracts > 0 && (
                    <span className="text-[10px] text-muted-foreground">{activeContracts} contrato(s)</span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

// Keep backward compatibility
export { ClientList as ProjectList }
