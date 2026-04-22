"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { clearSession } from "@/lib/auth/session"

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    clearSession()
    router.replace("/login")
  }, [router])

  return null
}
