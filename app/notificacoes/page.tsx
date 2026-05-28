"use client"

import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"

import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { NotificacoesContent } from "@/components/notificacoes/notificacoes-content"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsUnread,
  type NotificationRecord,
} from "@/lib/api/notifications"
import { getApiErrorMessage } from "@/lib/api/errors"
import { buildPathWithSearchParams } from "@/lib/navigation"
import { getNotificationHref } from "@/lib/notification-navigation"

export default function NotificacoesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentHref = buildPathWithSearchParams(pathname, searchParams)
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    refetchInterval: 60_000,
  })

  const notificationsList = notificationsQuery.data?.data ?? []
  const unreadCount = useMemo(
    () => notificationsList.filter((notification) => !notification.isRead).length,
    [notificationsList],
  )

  const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: ["notifications"] })

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      void invalidateNotifications()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível marcar a notificação como lida."))
    },
  })

  const markAsUnreadMutation = useMutation({
    mutationFn: markNotificationAsUnread,
    onMutate: () => {
      const toastId = toast.loading("Marcando notificação como não lida...")
      return { toastId }
    },
    onSuccess: (_data, _variables, context) => {
      void invalidateNotifications()
      toast.success("Notificação marcada como não lida.", { id: context?.toastId })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível marcar a notificação como não lida."), {
        id: context?.toastId,
      })
    },
  })

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      void invalidateNotifications()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível marcar as notificações como lidas."))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onMutate: () => {
      const toastId = toast.loading("Excluindo notificação...")
      return { toastId }
    },
    onSuccess: (_data, _variables, context) => {
      void invalidateNotifications()
      toast.success("Notificação excluída.", { id: context?.toastId })
    },
    onError: (error, _variables, context) => {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir a notificação."), {
        id: context?.toastId,
      })
    },
  })

  const openNotification = (notification: NotificationRecord) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id)
    }
    router.push(getNotificationHref(notification, currentHref))
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title="Notificações"
          description="Acompanhe todas as notificações e alertas do sistema"
          titleAddon={
            unreadCount > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} novas
              </Badge>
            ) : null
          }
          headerActions={
            unreadCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllMutation.mutate()}
                className="bg-white"
                disabled={markAllMutation.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            ) : null
          }
        />

        <div className="mt-4 md:mt-5">
          <NotificacoesContent
            notificationsList={notificationsList}
            isLoading={notificationsQuery.isLoading}
            onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
            onMarkAsUnread={(id) => markAsUnreadMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onOpenNotification={openNotification}
          />
        </div>
      </main>
    </div>
  )
}
