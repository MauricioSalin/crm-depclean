"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import {
  getPushPublicKey,
  savePushSubscription,
  type PushSubscriptionPayload,
} from "@/lib/api/notifications"
import { getStoredAccessToken } from "@/lib/auth/session"

const PUSH_PROMPT_KEY = "depclean.pushPromptedAt"
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function PwaProvider() {
  const isSyncingRef = useRef(false)

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

        if (Notification.permission === "default" && canShowPrompt()) {
          rememberPrompt()
          toast("Receber alertas do sistema neste dispositivo", {
            action: {
              label: "Ativar",
              onClick: () => {
                void enablePush(publicKey)
              },
            },
          })
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
  }, [])

  return null
}

function canUsePush() {
  return "Notification" in window && "PushManager" in window && "serviceWorker" in navigator
}

function canShowPrompt() {
  const raw = window.localStorage.getItem(PUSH_PROMPT_KEY)
  const promptedAt = Number(raw)
  return !Number.isFinite(promptedAt) || Date.now() - promptedAt > PROMPT_COOLDOWN_MS
}

function rememberPrompt() {
  window.localStorage.setItem(PUSH_PROMPT_KEY, String(Date.now()))
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
    if (permission !== "granted") return

    await subscribeCurrentBrowser(publicKey)
    toast.success("Notificações ativadas neste dispositivo.")
  } catch {
    toast.error("Não foi possível ativar notificações neste dispositivo.")
  }
}

async function subscribeCurrentBrowser(publicKey: string) {
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

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
