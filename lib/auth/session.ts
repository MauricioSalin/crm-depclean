import type { AuthenticatedUser } from "@/lib/auth/types"

const ACCESS_TOKEN_KEY = "depclean.accessToken"
const REFRESH_TOKEN_KEY = "depclean.refreshToken"
const USER_KEY = "depclean.user"
const EXPIRES_AT_KEY = "depclean.expiresAt"
const SESSION_EVENT = "depclean:session"
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

function readStoredValue(key: string) {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
}

function getStorage(persistent = true) {
  if (typeof window === "undefined") return null
  return persistent ? window.localStorage : window.sessionStorage
}

function clearFrom(storage: Storage | null) {
  if (!storage) return
  storage.removeItem(ACCESS_TOKEN_KEY)
  storage.removeItem(REFRESH_TOKEN_KEY)
  storage.removeItem(USER_KEY)
  storage.removeItem(EXPIRES_AT_KEY)
}

function dispatchSessionEvent() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(SESSION_EVENT))
}

function clearSessionStorage() {
  clearFrom(getStorage(true))
  clearFrom(getStorage(false))
}

function getJwtExpiresAt(token: string | null) {
  if (typeof window === "undefined" || !token) return null

  try {
    const payloadPart = token.split(".")[1]
    if (!payloadPart) return null

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const payload = JSON.parse(window.atob(padded)) as { exp?: number }

    return typeof payload.exp === "number" && payload.exp > 0 ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function getStoredExpiresAtValue() {
  const raw = readStoredValue(EXPIRES_AT_KEY)
  const expiresAt = Number(raw)
  return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null
}

function resolveSessionExpiresAt(accessToken: string | null) {
  const values = [getStoredExpiresAtValue(), getJwtExpiresAt(accessToken)].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  )

  return values.length > 0 ? Math.min(...values) : null
}

function isSessionExpired(accessToken: string | null) {
  const expiresAt = resolveSessionExpiresAt(accessToken)
  return Boolean(expiresAt && Date.now() > expiresAt)
}

export function persistSession(input: {
  accessToken: string
  refreshToken: string
  user: AuthenticatedUser
  persistent: boolean
}) {
  clearSessionStorage()

  const storage = getStorage(input.persistent)
  if (!storage) return

  const expiresAt = getJwtExpiresAt(input.accessToken) ?? Date.now() + SESSION_MAX_AGE_MS
  storage.setItem(ACCESS_TOKEN_KEY, input.accessToken)
  storage.setItem(REFRESH_TOKEN_KEY, input.refreshToken)
  storage.setItem(USER_KEY, JSON.stringify(input.user))
  storage.setItem(EXPIRES_AT_KEY, String(expiresAt))
  dispatchSessionEvent()
}

export function clearSession() {
  clearSessionStorage()
  dispatchSessionEvent()
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") return null
  const token = readStoredValue(ACCESS_TOKEN_KEY)
  if (!token) return null

  if (isSessionExpired(token)) {
    clearSession()
    return null
  }

  return token
}

export function getStoredRefreshToken() {
  if (typeof window === "undefined") return null
  const token = readStoredValue(REFRESH_TOKEN_KEY)
  if (!token) return null

  if (isSessionExpired(readStoredValue(ACCESS_TOKEN_KEY))) {
    clearSession()
    return null
  }

  return token
}

export function isPersistentSession() {
  if (typeof window === "undefined") return true
  return Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY))
}

export function getStoredUser(): AuthenticatedUser | null {
  if (typeof window === "undefined") return null

  const raw = readStoredValue(USER_KEY)
  if (!raw) return null

  if (isSessionExpired(readStoredValue(ACCESS_TOKEN_KEY))) {
    clearSession()
    return null
  }

  try {
    return JSON.parse(raw) as AuthenticatedUser
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return Boolean(getStoredAccessToken())
}

export function getSessionExpiresAt() {
  if (typeof window === "undefined") return null
  return resolveSessionExpiresAt(readStoredValue(ACCESS_TOKEN_KEY))
}
