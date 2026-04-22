"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { getSessionExpiresAt, isAuthenticated } from "@/lib/auth/session"

const PUBLIC_PATHS = ["/login", "/resetar-senha"]

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const authenticated = isAuthenticated()
    const expiresAt = getSessionExpiresAt()
    const expired = Boolean(expiresAt && Date.now() > expiresAt)

    if (authenticated && !isPublicPath) {
      return
    }

    if (authenticated && isPublicPath) {
      router.replace("/")
      return
    }

    if (!authenticated && !isPublicPath) {
      router.replace("/login")
    }

    if (expired && !isPublicPath) {
      router.replace("/login")
    }
  }, [isPublicPath, mounted, router, pathname])

  if (!mounted) {
    return null
  }

  const authenticated = isAuthenticated()

  if (!authenticated && !isPublicPath) {
    return null
  }

  if (authenticated && isPublicPath) {
    return null
  }

  return <>{children}</>
}
