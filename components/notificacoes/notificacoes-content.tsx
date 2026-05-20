"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Bell,
  Check,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
  FileText,
  Trash2,
  MessageCircle,
} from "lucide-react"
import type { NotificationType, NotificationChannel } from "@/lib/types"
import type { NotificationRecord } from "@/lib/api/notifications"

const NOTIFICATION_TYPES: { value: NotificationType; label: string; icon: typeof Bell }[] = [
  { value: "new_schedule", label: "Novo Agendamento", icon: Calendar },
  { value: "schedule_change", label: "Alteração de Agendamento", icon: Clock },
  { value: "schedule_cancel", label: "Cancelamento", icon: AlertTriangle },
  { value: "emergency", label: "Emergência", icon: AlertTriangle },
  { value: "daily_services", label: "Serviços do Dia", icon: Calendar },
  { value: "contract_signature", label: "Assinatura de Contrato", icon: FileText },
  { value: "informative", label: "Informativo", icon: FileText },
  { value: "certificate", label: "Certificado", icon: FileText },
  { value: "certificate_ready", label: "Certificado Pronto", icon: FileText },
  { value: "payment_due", label: "Parcela Vencendo", icon: DollarSign },
  { value: "payment_overdue", label: "Parcela Vencida", icon: DollarSign },
  { value: "contract_expiring", label: "Contrato Vencendo", icon: FileText },
]

const CHANNELS: { value: NotificationChannel; label: string; icon: typeof Bell }[] = [
  { value: "system", label: "Sistema", icon: Bell },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
]

export function NotificacoesContent({
  notificationsList,
  onMarkAsRead,
  onDelete,
  onOpenNotification,
  isLoading = false,
}: {
  notificationsList: NotificationRecord[]
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  onOpenNotification: (notification: NotificationRecord) => void
  isLoading?: boolean
}) {

  const getNotificationIcon = (type: NotificationType) => {
    const typeConfig = NOTIFICATION_TYPES.find(t => t.value === type)
    const Icon = typeConfig?.icon || Bell
    return <Icon className="h-5 w-5" />
  }

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case "emergency":
        return "text-red-500 bg-red-50"
      case "payment_overdue":
        return "text-orange-500 bg-orange-50"
      case "payment_due":
        return "text-yellow-500 bg-yellow-50"
      case "new_schedule":
      case "daily_services":
        return "text-blue-500 bg-blue-50"
      case "contract_signature":
      case "informative":
      case "certificate":
      case "certificate_ready":
        return "text-emerald-600 bg-emerald-50"
      case "contract_expiring":
        return "text-purple-500 bg-purple-50"
      default:
        return "text-gray-500 bg-gray-50"
    }
  }

  return (
    <div className="space-y-6">
      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-full space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-full max-w-xl" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notificationsList.length > 0 ? (
        <div className="space-y-4">
          {[...notificationsList]
            .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
            .map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-all hover:bg-muted/30 ${!notification.isRead ? "border-l-4 border-l-primary" : ""}`}
                onClick={() => onOpenNotification(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`font-medium ${!notification.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                            {notification.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation()
                                onMarkAsRead(notification.id)
                              }}
                              title="Marcar como lida"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation()
                              onDelete(notification.id)
                            }}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.sentAt).toLocaleString("pt-BR")}
                        </span>
                        <div className="flex gap-1">
                          {notification.channels.map(channel => {
                            const channelConfig = CHANNELS.find(c => c.value === channel)
                            return channelConfig ? (
                              <Badge key={channel} variant="outline" className="text-xs">
                                <channelConfig.icon className="h-3 w-3 mr-1" />
                                {channelConfig.label}
                              </Badge>
                            ) : null
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="Você não tem notificações no momento."
          className="min-h-[260px]"
        />
      )}
    </div>
  )
}
