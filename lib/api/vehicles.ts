import { api } from "@/lib/api/client"
export type VehicleRecord = { id: string; typeId: string; plate: string; model?: string; color?: string; year?: number | null }
export type VehiclePayload = { typeId: string; plate: string; model?: string; color?: string; year?: number | null }
export type VehicleCatalog = { types: Array<{ id: string; name: string }>; vehicles: VehicleRecord[] }
export async function getVehicles() { return (await api.get<{ success: true; data: VehicleCatalog }>("/vehicles")).data }
export async function saveVehicleType(name: string, id?: string) {
  return (id ? await api.patch(`/vehicles/types/${id}`, { name }) : await api.post("/vehicles/types", { name })).data
}
export async function saveVehicle(payload: VehiclePayload, id?: string) {
  return (id ? await api.patch(`/vehicles/${id}`, payload) : await api.post("/vehicles", payload)).data
}
export async function removeVehicle(id: string, type = false) { return (await api.delete(`/vehicles/${type ? "types/" : ""}${id}`)).data }
