import type { ContractRecord } from "@/lib/api/contracts"

type ClicksignSigner = NonNullable<ContractRecord["clicksign"]>["signers"][number]

const defaultClicksignEndpoint = "https://sandbox.clicksign.com"

function getClicksignEndpoint() {
  const endpoint = (process.env.NEXT_PUBLIC_CLICKSIGN_WEB_BASE_URL || process.env.NEXT_PUBLIC_CLICKSIGN_ENDPOINT || defaultClicksignEndpoint).replace(/\/$/, "")
  try {
    const url = new URL(endpoint)
    if (url.hostname.startsWith("api.")) {
      url.hostname = url.hostname.replace(/^api\./, "app.")
    }
    return url.origin
  } catch {
    return endpoint
  }
}

function getClicksignOrigin(sourceUrl?: string | null) {
  const value = String(sourceUrl ?? "").trim()
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).origin
    } catch {
      return getClicksignEndpoint()
    }
  }

  return getClicksignEndpoint()
}

export function buildClicksignSignerUrl(signerId?: string | null, sourceUrl?: string | null) {
  const cleanSignerId = String(signerId ?? "").trim()
  if (!cleanSignerId) return ""

  return `${getClicksignOrigin(sourceUrl)}/notarial/widget/signatures/${encodeURIComponent(cleanSignerId)}/redirect`
}

export function normalizeClicksignSigningUrl(url?: string | null, signerId?: string | null) {
  const value = String(url ?? "").trim()
  if (!/^https?:\/\//i.test(value)) return buildClicksignSignerUrl(signerId)

  try {
    const parsed = new URL(value)
    if (parsed.pathname.includes("/api/")) return buildClicksignSignerUrl(signerId, value)

    const widgetMatch =
      parsed.pathname.match(/^\/widget\/(?:[a-z]{2}(?:-[a-z]{2})\/)?notarial\/([^/]+)\/documents(?:\/[^/]+)?\/?$/i) ??
      parsed.pathname.match(/^\/notarial\/widget\/signatures\/([^/]+)\/redirect\/?$/i)
    if (widgetMatch?.[1]) return buildClicksignSignerUrl(widgetMatch[1], value)

    if (/^\/accounts\/[^/]+\/notarial\/links\/[^/]+\/signatures\/?$/i.test(parsed.pathname)) {
      return buildClicksignSignerUrl(signerId, value)
    }

    return value
  } catch {
    return buildClicksignSignerUrl(signerId)
  }
}

function isUnsignedSigner(signer: ClicksignSigner) {
  return !["signed", "done", "finished"].includes(String(signer.status ?? "").toLowerCase())
}

export function getContractClicksignSigningUrl(contract?: Pick<ContractRecord, "signatureUrl" | "clicksign"> | null) {
  if (!contract) return ""

  const signers = contract.clicksign?.signers ?? []
  const pendingSigner = signers.find((signer) => isUnsignedSigner(signer) && normalizeClicksignSigningUrl(signer.signUrl, signer.signerId))
  if (pendingSigner) return normalizeClicksignSigningUrl(pendingSigner.signUrl, pendingSigner.signerId)

  const firstSigner = signers.find((signer) => normalizeClicksignSigningUrl(signer.signUrl, signer.signerId))
  if (firstSigner) return normalizeClicksignSigningUrl(firstSigner.signUrl, firstSigner.signerId)

  return normalizeClicksignSigningUrl(contract.signatureUrl)
}

export function getContractClicksignManagementUrl(contract?: Pick<ContractRecord, "clicksign"> | null) {
  const envelopeId = String(contract?.clicksign?.envelopeId ?? "").trim()
  const documentId = String(contract?.clicksign?.documentId || contract?.clicksign?.documentKey || "").trim()
  const folderId = String(contract?.clicksign?.folderId ?? "").trim()
  if (!envelopeId && !documentId) return ""

  const explicitUrl = String(contract?.clicksign?.managementUrl ?? "").trim()
  if (/^https?:\/\//i.test(explicitUrl)) return explicitUrl

  const accountId = String(process.env.NEXT_PUBLIC_CLICKSIGN_ACCOUNT_ID ?? "").trim()
  const template = String(process.env.NEXT_PUBLIC_CLICKSIGN_ENVELOPE_URL_TEMPLATE ?? "").trim()
  if (template) {
    return template
      .replace(/\{envelopeId\}/g, encodeURIComponent(envelopeId))
      .replace(/\{documentId\}/g, encodeURIComponent(documentId))
      .replace(/\{folderId\}/g, encodeURIComponent(folderId))
      .replace(/\{accountId\}/g, encodeURIComponent(accountId))
  }

  const endpoint = getClicksignEndpoint()
  if (accountId && folderId && documentId) {
    return `${endpoint}/accounts/${encodeURIComponent(accountId)}/folders/${encodeURIComponent(folderId)}/documents/${encodeURIComponent(documentId)}`
  }

  if (accountId) {
    return `${endpoint}/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}`
  }

  return `${endpoint}/envelopes/${encodeURIComponent(envelopeId)}`
}

export function getContractClicksignUrl(contract?: Pick<ContractRecord, "signatureUrl" | "clicksign"> | null) {
  return getContractClicksignManagementUrl(contract) || getContractClicksignSigningUrl(contract)
}
