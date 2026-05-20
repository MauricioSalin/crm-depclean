import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"

import { clearSession, getStoredAccessToken } from "@/lib/auth/session"

let handlingUnauthorizedSession = false
const mutatingMethods = new Set(["post", "put", "patch", "delete"])
const pendingMutationKeys = new Set<string>()
const requestMutationKeys = new WeakMap<InternalAxiosRequestConfig, string>()

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

function stableSerialize(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof FormData !== "undefined" && value instanceof FormData) return "[form-data]"
  if (typeof Blob !== "undefined" && value instanceof Blob) return "[blob]"
  if (typeof value === "string") return value
  if (typeof value !== "object") return String(value)

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}:${stableSerialize(item)}`)
    .join(",")}}`
}

function buildMutationKey(config: InternalAxiosRequestConfig) {
  const method = (config.method ?? "get").toLowerCase()
  const url = `${config.baseURL ?? ""}${config.url ?? ""}`
  return [method, url, stableSerialize(config.params), stableSerialize(config.data)].join("|")
}

function releaseMutationKey(config?: InternalAxiosRequestConfig) {
  if (!config) return
  const key = requestMutationKeys.get(config)
  if (!key) return
  pendingMutationKeys.delete(key)
  requestMutationKeys.delete(config)
}

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getStoredAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const method = (config.method ?? "get").toLowerCase()
    if (mutatingMethods.has(method)) {
      const key = buildMutationKey(config)

      if (pendingMutationKeys.has(key)) {
        return Promise.reject(
          new AxiosError(
            "Aguarde a ação em andamento finalizar.",
            "ERR_DUPLICATE_MUTATION",
            config,
          ),
        )
      }

      pendingMutationKeys.add(key)
      requestMutationKeys.set(config, key)
    }
  }

  return config
})

function isAuthRequest(url?: string) {
  return Boolean(url && url.includes("/auth/"))
}

api.interceptors.response.use(
  (response) => {
    releaseMutationKey(response.config)
    return response
  },
  (error: AxiosError) => {
    releaseMutationKey(error.config)
    const status = error.response?.status

    if (typeof window !== "undefined" && status === 401 && !isAuthRequest(error.config?.url)) {
      if (!handlingUnauthorizedSession) {
        handlingUnauthorizedSession = true
        clearSession()
        window.location.replace("/login?sessionExpired=1")
      }

      return new Promise(() => undefined)
    }

    return Promise.reject(error)
  },
)
