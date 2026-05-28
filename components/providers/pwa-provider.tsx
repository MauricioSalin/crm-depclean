"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Bell } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getPushPublicKey,
  markNotificationAsRead,
  savePushSubscription,
  type PushSubscriptionPayload,
} from "@/lib/api/notifications"
import { getStoredAccessToken } from "@/lib/auth/session"

export function PwaProvider() {
  const queryClient = useQueryClient()
  const isSyncingRef = useRef(false)
  const markedFromPushRef = useRef(new Set<string>())
  const [publicKey, setPublicKey] = useState("")
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissedThisSession, setDismissedThisSession] = useState(false)
  const [isEnabling, setIsEnabling] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const body = document.body
    const documentElement = document.documentElement
    const legacyLockedByCustomHook = body.style.position === "fixed" && body.style.top.startsWith("-")
    const lockedByDialogLibrary = body.hasAttribute("data-scroll-locked")
    if (!legacyLockedByCustomHook || lockedByDialogLibrary) return

    const scrollY = Math.abs(Number.parseInt(body.style.top, 10) || 0)
    documentElement.style.overflow = ""
    body.style.overflow = ""
    body.style.position = ""
    body.style.top = ""
    body.style.left = ""
    body.style.right = ""
    body.style.width = ""
    body.style.paddingRight = ""

    if (scrollY > 0) {
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (!window.isSecureContext) return

    const registerServiceWorker = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined)
    }

    if (document.readyState === "complete") {
      registerServiceWorker()
      return
    }

    window.addEventListener("load", registerServiceWorker, { once: true })

    return () => {
      window.removeEventListener("load", registerServiceWorker)
    }
  }, [])

  useEffect(() => {
    const markClickedNotificationAsRead = async (notificationId: string | null | undefined) => {
      if (!notificationId) return
      if (!getStoredAccessToken()) return
      if (markedFromPushRef.current.has(notificationId)) return

      markedFromPushRef.current.add(notificationId)

      try {
        await markNotificationAsRead(notificationId)
        await queryClient.invalidateQueries({ queryKey: ["notifications"] })
      } catch {
        markedFromPushRef.current.delete(notificationId)
      }
    }

    const consumeReadNotificationParam = () => {
      const url = new URL(window.location.href)
      const notificationId = url.searchParams.get("readNotification")
      if (!notificationId) return

      url.searchParams.delete("readNotification")
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
      void markClickedNotificationAsRead(notificationId)
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "DEPCLEAN_PUSH_NOTIFICATION_CLICKED") return
      void markClickedNotificationAsRead(event.data.notificationId)
    }

    consumeReadNotificationParam()
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage)
    window.addEventListener("focus", consumeReadNotificationParam)

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage)
      window.removeEventListener("focus", consumeReadNotificationParam)
    }
  }, [queryClient])

  useEffect(() => {
    const syncPush = async () => {
      if (isSyncingRef.current) return
      if (!canUsePush()) return
      if (!getStoredAccessToken()) return
      if (isIosBrowserWithoutStandalone()) return

      isSyncingRef.current = true

      try {
        const config = await getPushPublicKey()
        const publicKey = config.data.publicKey
        if (!config.data.enabled || !publicKey) return

        if (Notification.permission === "granted") {
          await subscribeCurrentBrowser(publicKey)
          return
        }

        if (Notification.permission === "default" && !dismissedThisSession) {
          setPublicKey(publicKey)
          setShowPrompt(true)
        }
      } catch {
        // Push não deve bloquear o uso normal do sistema.
      } finally {
        isSyncingRef.current = false
      }
    }

    void syncPush()
    window.addEventListener("depclean:session", syncPush)

    return () => {
      window.removeEventListener("depclean:session", syncPush)
    }
  }, [dismissedThisSession])

  const enableNotifications = async () => {
    setIsEnabling(true)

    try {
      const enabled = await enablePush(publicKey)
      if (enabled) {
        setShowPrompt(false)
      }
    } finally {
      setIsEnabling(false)
    }
  }

  const dismissPrompt = () => {
    setDismissedThisSession(true)
    setShowPrompt(false)
  }

  return (
    <>
      {showPrompt && publicKey ? (
        <Dialog
          open={showPrompt}
          onOpenChange={(open) => {
            if (!open && !isEnabling) dismissPrompt()
          }}
        >
          <DialogContent className="max-w-md gap-5 p-0" showCloseButton={!isEnabling}>
            <div className="flex items-start gap-4 px-6 pt-6">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Bell className="size-5" aria-hidden="true" />
              </div>
              <DialogHeader className="min-w-0 gap-2 pr-6 text-left">
                <DialogTitle className="text-base">Ativar notificações no celular</DialogTitle>
                <DialogDescription className="leading-5">
                  Receba os avisos do sininho mesmo quando o app estiver fechado.
                </DialogDescription>
              </DialogHeader>
            </div>

            <DialogFooter className="px-6 pb-6 sm:justify-start">
              <Button onClick={enableNotifications} disabled={isEnabling}>
                <Bell className="size-4" aria-hidden="true" />
                {isEnabling ? "Ativando..." : "Ativar"}
              </Button>
              <Button variant="ghost" onClick={dismissPrompt} disabled={isEnabling}>
                Agora não
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

function canUsePush() {
  return "Notification" in window && "PushManager" in window && "serviceWorker" in navigator
}

function isIosBrowserWithoutStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || navigatorWithStandalone.standalone === true

  return isIos && !isStandalone
}

async function enablePush(publicKey: string) {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return false

    const createdSubscription = await subscribeCurrentBrowser(publicKey)
    if (createdSubscription) {
      await showWelcomeNotification()
    }

    toast.success("Notificações ativadas neste dispositivo.")
    return true
  } catch {
    toast.error("Não foi possível ativar notificações neste dispositivo.")
    return false
  }
}

async function subscribeCurrentBrowser(publicKey: string) {
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  const hadSubscription = Boolean(subscription)

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const payload = toPushSubscriptionPayload(subscription)
  if (payload) {
    await savePushSubscription(payload)
  }

  return !hadSubscription
}

async function showWelcomeNotification() {
  const registration = await navigator.serviceWorker.ready

  await registration.showNotification("Notificações ativadas", {
    body: "Você autorizou receber notificações em push nesse dispositivo. Tenha um ótimo dia de trabalho!",
    icon: "/pwa-icon-192.png",
    badge: "/pwa-maskable-192.png",
    tag: "depclean-push-welcome",
    data: {
      url: "/notificacoes",
    },
  })
}

function toPushSubscriptionPayload(subscription: PushSubscription): PushSubscriptionPayload | null {
  const value = subscription.toJSON()
  const endpoint = value.endpoint
  const p256dh = value.keys?.p256dh
  const auth = value.keys?.auth

  if (!endpoint || !p256dh || !auth) return null

  return {
    endpoint,
    expirationTime: value.expirationTime ?? null,
    keys: {
      p256dh,
      auth,
    },
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
}
