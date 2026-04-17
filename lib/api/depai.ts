export type DepAIFile = {
  id: string
  name: string
  type: string
  size: number
}

export type DepAIArtifactKind = "pdf" | "docx" | "xlsx" | "chart" | "report"

export type DepAIArtifact = {
  id: string
  kind: DepAIArtifactKind
  title: string
  description: string
  fileName?: string
  mimeType?: string
  downloadUrl?: string
  previewUrl?: string
  status: "ready" | "processing"
}

export type DepAIMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
  files?: DepAIFile[]
  artifacts?: DepAIArtifact[]
}

export type SendDepAIMessagePayload = {
  message: string
  files: DepAIFile[]
}

export type SendDepAIMessageResponse = {
  message: DepAIMessage
}

function inferArtifacts(message: string): DepAIArtifact[] {
  const normalized = message.toLowerCase()
  const artifacts: DepAIArtifact[] = []

  if (normalized.includes("pdf")) {
    artifacts.push({
      id: `artifact-pdf-${Date.now()}`,
      kind: "pdf",
      title: "PDF preparado",
      description: "Arquivo PDF pronto para visualizacao ou download quando o backend estiver integrado.",
      fileName: "relatorio-depai.pdf",
      mimeType: "application/pdf",
      status: "ready",
    })
  }

  if (normalized.includes("docx") || normalized.includes("documento") || normalized.includes("contrato")) {
    artifacts.push({
      id: `artifact-docx-${Date.now()}`,
      kind: "docx",
      title: "Documento DOCX preparado",
      description: "Documento editavel gerado a partir de template e dados estruturados.",
      fileName: "documento-depai.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "ready",
    })
  }

  if (normalized.includes("xlsx") || normalized.includes("planilha")) {
    artifacts.push({
      id: `artifact-xlsx-${Date.now()}`,
      kind: "xlsx",
      title: "Planilha XLSX preparada",
      description: "Planilha pronta para exportacao com dados do CRM.",
      fileName: "dados-depai.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      status: "ready",
    })
  }

  if (normalized.includes("grafico") || normalized.includes("gráfico")) {
    artifacts.push({
      id: `artifact-chart-${Date.now()}`,
      kind: "chart",
      title: "Grafico preparado",
      description: "Visualizacao gerada para analise operacional.",
      status: "ready",
    })
  }

  if (normalized.includes("relatorio") || normalized.includes("relatório")) {
    artifacts.push({
      id: `artifact-report-${Date.now()}`,
      kind: "report",
      title: "Relatorio preparado",
      description: "Resumo executivo pronto para revisao e exportacao.",
      fileName: "relatorio-depai.pdf",
      mimeType: "application/pdf",
      status: "ready",
    })
  }

  return artifacts
}

export async function sendDepAIMessage({
  message,
  files,
}: SendDepAIMessagePayload): Promise<SendDepAIMessageResponse> {
  await new Promise((resolve) => setTimeout(resolve, 900))

  const artifacts = inferArtifacts(message)

  return {
    message: {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      createdAt: new Date().toISOString(),
      content: `Entendi sua mensagem: "${message}". ${
        files.length > 0
          ? `Recebi tambem ${files.length} anexo(s), que poderao ser processados quando a API estiver integrada.`
          : "Quando a integracao estiver pronta, vou responder usando a API e os dados autorizados do sistema."
      }${
        artifacts.length > 0
          ? "\n\nTambem deixei um artefato empresarial preparado abaixo para representar o retorno futuro da IA."
          : ""
      }`,
      artifacts,
    },
  }
}