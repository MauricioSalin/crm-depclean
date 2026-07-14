"use client"

import { useEffect, useState } from "react"

import { hasAnyPermission } from "@/lib/auth/permissions"
import { getStoredUser } from "@/lib/auth/session"

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null)

  useEffect(() => {
    const sync = () => setCurrentUser(getStoredUser())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("depclean:session", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("depclean:session", sync)
    }
  }, [])

  return currentUser
}

export function useHasAnyPermission(permissions: string[]) {
  return hasAnyPermission(useCurrentUser(), permissions)
}
