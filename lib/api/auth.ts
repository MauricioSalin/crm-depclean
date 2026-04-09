import { api } from "@/lib/api/client"
import type { LoginResponse } from "@/lib/auth/types"

export type LoginPayload = {
  email: string
  password: string
}

export async function login(payload: LoginPayload) {
  const response = await api.post<LoginResponse>("/auth/login", payload)
  return response.data
}
