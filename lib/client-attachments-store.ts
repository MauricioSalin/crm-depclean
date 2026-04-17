import type { ClientAttachment } from "./types"

let attachments: ClientAttachment[] = [
  {
    id: "att-na-sched1",
    clientId: "client1",
    scheduledServiceId: "sched1",
    type: "service_na",
    title: "NA - Visita realizada",
    fileName: "na-condominio-eduardo-prado.pdf",
    mimeType: "application/pdf",
    fileSize: 184000,
    source: "agenda",
    uploadedAt: "2026-03-10T12:30:00.000Z",
    description: "Nota de atendimento vinculada à visita concluída.",
    metadata: {
      serviceTypeName: "Dedetização",
      scheduledDate: "2026-03-10",
      startTime: "09:00",
      endTime: "11:00",
    },
  },
]

export function getClientAttachments(clientId: string): ClientAttachment[] {
  return attachments
    .filter((attachment) => attachment.clientId === clientId)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
}

export function addClientAttachment(attachment: Omit<ClientAttachment, "id" | "uploadedAt">): ClientAttachment {
  const savedAttachment: ClientAttachment = {
    ...attachment,
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uploadedAt: new Date().toISOString(),
  }

  attachments = [savedAttachment, ...attachments]

  return savedAttachment
}
