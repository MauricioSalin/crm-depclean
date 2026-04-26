import axios from "axios"

import { getStoredAccessToken } from "@/lib/auth/session"

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
})

export function buildApiFileUrl(path: string) {
  if (!path) return ""
  if (/^https?:\/\//i.test(path)) return path
  const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api/v1"
  const origin = new URL(baseURL).origin
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`
}

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getStoredAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})
