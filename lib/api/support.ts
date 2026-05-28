import { api } from "@/lib/api/client"

export type SupportContactRecord = {
  name: string
  whatsapp: string
  email: string
}

export type SupportMessagePayload = {
  name: string
  email: string
  subject: string
  message: string
  attachments?: File[]
}

export async function getSupportContact() {
  const response = await api.get<{ success: true; data: SupportContactRecord }>("/support/contact")
  return response.data
}

export async function sendSupportMessage(payload: SupportMessagePayload) {
  const formData = new FormData()
  formData.append("name", payload.name)
  formData.append("email", payload.email)
  formData.append("subject", payload.subject)
  formData.append("message", payload.message)

  payload.attachments?.forEach((file) => {
    formData.append("attachments", file)
  })

  const response = await api.post<{ success: true; data: { sent: boolean; attachments: number } }>(
    "/support/contact",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  )
  return response.data
}
