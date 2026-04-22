import type { AuthenticatedUser } from "@/lib/auth/types"

const ACCESS_TOKEN_KEY = "depclean.accessToken"
const REFRESH_TOKEN_KEY = "depclean.refreshToken"
const USER_KEY = "depclean.user"
const EXPIRES_AT_KEY = "depclean.expiresAt"
const SESSION_EVENT = "depclean:session"
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

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

export function persistSession(input: {
  accessToken: string
  refreshToken: string
  user: AuthenticatedUser
  persistent: boolean
}) {
  clearSessionStorage()

  const storage = getStorage(input.persistent)
  if (!storage) return

  const expiresAt = Date.now() + SESSION_MAX_AGE_MS
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
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (!token) return null

  const expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY) ?? window.sessionStorage.getItem(EXPIRES_AT_KEY))
  if (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt) {
    clearSession()
    return null
  }

  return token
}

export function getStoredRefreshToken() {
  if (typeof window === "undefined") return null
  const token = window.localStorage.getItem(REFRESH_TOKEN_KEY) ?? window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
  if (!token) return null

  const expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY) ?? window.sessionStorage.getItem(EXPIRES_AT_KEY))
  if (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt) {
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

  const raw = window.localStorage.getItem(USER_KEY) ?? window.sessionStorage.getItem(USER_KEY)
  if (!raw) return null

  const expiresAt = Number(window.localStorage.getItem(EXPIRES_AT_KEY) ?? window.sessionStorage.getItem(EXPIRES_AT_KEY))
  if (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt) {
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
  const raw = window.localStorage.getItem(EXPIRES_AT_KEY) ?? window.sessionStorage.getItem(EXPIRES_AT_KEY)
  const expiresAt = Number(raw)
  return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null
}
