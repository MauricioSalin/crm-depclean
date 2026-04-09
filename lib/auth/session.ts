import type { AuthenticatedUser } from "@/lib/auth/types"

const ACCESS_TOKEN_KEY = "depclean.accessToken"
const REFRESH_TOKEN_KEY = "depclean.refreshToken"
const USER_KEY = "depclean.user"

function getStorage(persistent = true) {
  if (typeof window === "undefined") return null
  return persistent ? window.localStorage : window.sessionStorage
}

function clearFrom(storage: Storage | null) {
  if (!storage) return
  storage.removeItem(ACCESS_TOKEN_KEY)
  storage.removeItem(REFRESH_TOKEN_KEY)
  storage.removeItem(USER_KEY)
}

export function persistSession(input: {
  accessToken: string
  refreshToken: string
  user: AuthenticatedUser
  persistent: boolean
}) {
  clearSession()

  const storage = getStorage(input.persistent)
  if (!storage) return

  storage.setItem(ACCESS_TOKEN_KEY, input.accessToken)
  storage.setItem(REFRESH_TOKEN_KEY, input.refreshToken)
  storage.setItem(USER_KEY, JSON.stringify(input.user))
}

export function clearSession() {
  clearFrom(getStorage(true))
  clearFrom(getStorage(false))
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getStoredUser(): AuthenticatedUser | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(USER_KEY) ?? window.sessionStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthenticatedUser
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return Boolean(getStoredAccessToken())
}
