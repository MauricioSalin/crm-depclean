"use client"

import Script from "next/script"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    Clicksign?: new (requestSignatureId: string) => {
      endpoint: string
      origin: string
      mount: (containerId: string) => void
      unmount: () => void
      on: (event: "loaded" | "signed" | "resized", callback: (event: any) => void) => void
    }
  }
}

const clicksignEndpoint = process.env.NEXT_PUBLIC_CLICKSIGN_ENDPOINT || "https://sandbox.clicksign.com"

export default function SignaturePage() {
  const params = useParams<{ signerId: string }>()
  const signerId = decodeURIComponent(String(params.signerId ?? "")).trim()
  const widgetRef = useRef<InstanceType<NonNullable<typeof window.Clicksign>> | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!scriptReady || !signerId || !window.Clicksign) return

    try {
      widgetRef.current?.unmount()
      const widget = new window.Clicksign(signerId)
      widget.endpoint = clicksignEndpoint
      widget.origin = window.origin
      widget.mount("clicksign-widget")
      widget.on("signed", () => setSigned(true))
      widget.on("resized", (event) => {
        const height = Number(event?.data?.height ?? 0)
        const container = document.getElementById("clicksign-widget")
        if (container && height > 0) {
          container.style.height = `${height}px`
        }
      })
      widgetRef.current = widget
      setError("")
    } catch {
      setError("Não foi possível carregar o fluxo de assinatura.")
    }

    return () => {
      widgetRef.current?.unmount()
      widgetRef.current = null
    }
  }, [scriptReady, signerId])

  return (
    <main className="min-h-screen bg-[#f7faf2] px-4 py-6 text-[#07150b] sm:px-6">
      <Script
        src="https://cdn-public-library.clicksign.com/embedded/embedded.min-2.1.0.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError("Não foi possível carregar a biblioteca da Clicksign.")}
      />

      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-5xl flex-col rounded-lg border border-[#dce7d2] bg-white shadow-sm">
        <header className="border-b border-[#e8efe2] px-5 py-4">
          <p className="text-sm text-[#5f6b5e]">Depclean</p>
          <h1 className="text-xl font-semibold">Assinatura digital</h1>
        </header>

        {signed ? (
          <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
            <div>
              <h2 className="text-2xl font-semibold">Documento assinado com sucesso.</h2>
              <p className="mt-2 text-[#5f6b5e]">Você já pode fechar esta janela.</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
            <div>
              <h2 className="text-2xl font-semibold">Link indisponível</h2>
              <p className="mt-2 text-[#5f6b5e]">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <div id="clicksign-widget" className="min-h-[720px] w-full" />
            {!scriptReady ? (
              <p className="px-6 py-4 text-sm text-[#5f6b5e]">Carregando assinatura...</p>
            ) : null}
          </div>
        )}
      </div>
    </main>
  )
}
