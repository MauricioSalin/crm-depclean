"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { canAccessPath, getFirstAllowedPath } from "@/lib/auth/permissions"
import { getStoredUser, isAuthenticated } from "@/lib/auth/session"
import { buildLoginHref, getPostLoginPath } from "@/lib/navigation"

const PUBLIC_PATHS = ["/login", "/resetar-senha"]
const PUBLIC_PATH_PREFIXES = ["/assinatura/"]

function isPublicPathname(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const isPublicPath = isPublicPathname(pathname)
  const isAuthPage = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const publicPath = isPublicPathname(pathname)
    const authPage = PUBLIC_PATHS.includes(pathname)
    const authenticated = isAuthenticated()

    if (authenticated && !publicPath) {
      const user = getStoredUser()
      if (!canAccessPath(pathname, user)) {
        router.replace(getFirstAllowedPath(user))
      }
      return
    }

    if (authenticated && authPage) {
      router.replace(getPostLoginPath(window.location.search))
      return
    }

    if (!authenticated && !publicPath) {
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      router.replace(buildLoginHref(currentPath))
    }
  }, [isAuthPage, mounted, router, pathname])

  if (!mounted) {
    return null
  }

  const authenticated = isAuthenticated()

  if (!authenticated && !isPublicPath) {
    return null
  }

  if (authenticated && isAuthPage) {
    return null
  }

  if (authenticated && !isPublicPath && !canAccessPath(pathname, getStoredUser())) {
    return null
  }

  return <>{children}</>
}
