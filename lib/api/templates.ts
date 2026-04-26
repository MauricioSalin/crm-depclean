import { buildApiFileUrl, api } from "@/lib/api/client"

export type TemplateKind = "contract" | "informative" | "certificate"
export type TemplateFormat = "html" | "docx"

export type TemplateRecord = {
  id: string
  name: string
  description: string
  kind: TemplateKind
  format: TemplateFormat
  html: string
  signerId: string
  signerName?: string | null
  baseFileName?: string
  baseFileUrl?: string | null
  placeholders: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type TemplatePayload = {
  name: string
  description?: string
  kind?: TemplateKind
  format?: TemplateFormat
  html?: string
  signerId?: string
  baseFileName?: string
  isActive?: boolean
}

export async function listTemplates(search = "", kind?: TemplateKind) {
  const response = await api.get<{ success: true; data: TemplateRecord[] }>("/templates", {
    params: { search, kind },
  })
  return response.data
}

export async function getTemplateById(id: string) {
  const response = await api.get<{ success: true; data: TemplateRecord }>(`/templates/${id}`)
  return response.data
}

export async function createTemplate(payload: TemplatePayload) {
  const response = await api.post<{ success: true; data: TemplateRecord }>("/templates", payload)
  return response.data
}

export async function updateTemplate(id: string, payload: Partial<TemplatePayload>) {
  const response = await api.patch<{ success: true; data: TemplateRecord }>(`/templates/${id}`, payload)
  return response.data
}

export async function uploadTemplateBaseFile(id: string, file: File) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await api.post<{ success: true; data: TemplateRecord }>(`/templates/${id}/base-file`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
  return response.data
}

export async function deleteTemplate(id: string) {
  const response = await api.delete<{ success: true; data: null }>(`/templates/${id}`)
  return response.data
}

export async function fetchTemplatePreviewBinary(id: string) {
  const response = await api.get<ArrayBuffer>(`/templates/${id}/preview-file`, {
    responseType: "arraybuffer",
  })
  return response.data
}

export async function fetchTemplateBaseBinary(id: string) {
  const response = await api.get<ArrayBuffer>(`/templates/${id}/base-file`, {
    responseType: "arraybuffer",
  })
  return response.data
}

export async function downloadTemplateBaseFile(id: string, fileName?: string) {
  const response = await api.get<BlobPart>(`/templates/${id}/base-file`, {
    responseType: "blob",
  })

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName || `${id}.docx`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(objectUrl)
}

export function getExampleTemplateDocxUrl() {
  return buildApiFileUrl("/api/v1/templates/example-docx")
}

export function getTemplateBaseFileUrl(id: string) {
  return buildApiFileUrl(`/api/v1/templates/${id}/base-file`)
}

export function getTemplatePreviewFileUrl(id: string) {
  return buildApiFileUrl(`/api/v1/templates/${id}/preview-file`)
}
