"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, ArrowRight } from "lucide-react"
import { scheduledServices, clients, serviceTypes, getClientById, getServiceTypeById } from "@/lib/mock-data"
import Link from "next/link"

export function UpcomingServices() {
  const today = new Date()
  const upcomingServices = scheduledServices
    .filter(s => s.status === "scheduled" || s.status === "in_progress")
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
    .slice(0, 3)

  return (
    <Card
      className="p-4 transition-all duration-500 hover:shadow-xl"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Próximos Serviços</h2>
        <Link href="/agenda">
          <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80">
            Ver todos
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="space-y-3">
        {upcomingServices.map((service, index) => {
          const client = getClientById(service.clientId)
          const serviceType = getServiceTypeById(service.serviceTypeId)
          const isToday = service.scheduledDate.toDateString() === today.toDateString()
          
          return (
            <div 
              key={service.id}
              className="p-3 rounded-lg border border-border transition-all duration-300 hover:shadow-md hover:border-primary/30 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{serviceType?.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{client?.companyName}</p>
                </div>
                <Badge 
                  className={`text-[10px] flex-shrink-0 ${
                    service.status === "in_progress" 
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-100" 
                      : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {service.status === "in_progress" ? "Em andamento" : "Agendado"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{service.scheduledTime || "08:00"}</span>
                </div>
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{client?.units[0]?.address.neighborhood}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// Keeping original name for backward compatibility
export { UpcomingServices as Reminders }
