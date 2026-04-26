import { api } from "@/lib/api/client"

export type TeamRecord = {
  id: string
  name: string
  description: string
  permissionId: string
  color: string
  memberIds: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type TeamPayload = {
  name: string
  description?: string
  permissionId?: string
  color: string
  memberIds: string[]
  isActive?: boolean
}

export async function listTeams(search = "") {
  const response = await api.get<{ success: true; data: TeamRecord[] }>("/teams", { params: { search } })
  return response.data
}

export async function createTeam(payload: TeamPayload) {
  const response = await api.post<{ success: true; data: TeamRecord }>("/teams", payload)
  return response.data
}

export async function updateTeam(id: string, payload: Partial<TeamPayload>) {
  const response = await api.patch<{ success: true; data: TeamRecord }>(`/teams/${id}`, payload)
  return response.data
}

export async function deleteTeam(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/teams/${id}`)
  return response.data
}
