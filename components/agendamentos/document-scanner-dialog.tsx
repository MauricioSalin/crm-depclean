"use client"

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, ScanLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  defaultDocumentCorners,
  documentCanvasBlob,
  prepareDocumentScanSource,
  renderScannedDocument,
  type DocumentCorners,
  type DocumentPoint,
} from "@/lib/document-scanner"

interface DocumentScannerDialogProps {
  open: boolean
  sourceFile: File | null
  onOpenChange: (open: boolean) => void
  onScan: (file: File) => void
}

type CornerKey = keyof DocumentCorners

export function DocumentScannerDialog({
  open,
  sourceFile,
  onOpenChange,
  onScan,
}: DocumentScannerDialogProps) {
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const sourceImageRef = useRef<HTMLImageElement | null>(null)
  const processedBlobRef = useRef<Blob | null>(null)
  const loadVersionRef = useRef(0)
  const sourceUrlRef = useRef("")
  const processedUrlRef = useRef("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [processedUrl, setProcessedUrl] = useState("")
  const [corners, setCorners] = useState<DocumentCorners>(defaultDocumentCorners)
  const [adjusting, setAdjusting] = useState(true)
  const [sourceReady, setSourceReady] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const releaseSource = useCallback(() => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    sourceUrlRef.current = ""
    setSourceUrl("")
  }, [])

  const releaseProcessed = useCallback(() => {
    processedBlobRef.current = null
    if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current)
    processedUrlRef.current = ""
    setProcessedUrl("")
  }, [])

  const loadSourceFile = useCallback(async (file: File) => {
    const version = ++loadVersionRef.current
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Escolha uma foto válida para digitalizar.")
      return
    }
    releaseSource()
    releaseProcessed()
    setCorners(defaultDocumentCorners())
    setAdjusting(true)
    setSourceReady(false)
    setErrorMessage("")
    setProcessing(true)
    try {
      const blob = await prepareDocumentScanSource(file)
      if (version !== loadVersionRef.current) return
      sourceUrlRef.current = URL.createObjectURL(blob)
      setSourceUrl(sourceUrlRef.current)
    } catch {
      if (version === loadVersionRef.current) setErrorMessage("Não foi possível abrir a foto. Tente uma foto menor ou anexe pela galeria.")
    } finally {
      if (version === loadVersionRef.current) setProcessing(false)
    }
  }, [releaseProcessed, releaseSource])

  useEffect(() => {
    if (open && sourceFile) void loadSourceFile(sourceFile)
    if (!open) {
      ++loadVersionRef.current
      releaseSource()
      releaseProcessed()
      setCorners(defaultDocumentCorners())
      setAdjusting(true)
      setSourceReady(false)
      setProcessing(false)
      setErrorMessage("")
    }
  }, [loadSourceFile, open, releaseProcessed, releaseSource, sourceFile])

  useEffect(() => () => {
    ++loadVersionRef.current
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    if (processedUrlRef.current) URL.revokeObjectURL(processedUrlRef.current)
    processedBlobRef.current = null
  }, [])

  const moveCorner = (key: CornerKey, event: PointerEvent<HTMLButtonElement>) => {
    const container = event.currentTarget.parentElement
    if (!container) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = container.getBoundingClientRect()
    const point: DocumentPoint = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
    setCorners((current) => ({ ...current, [key]: point }))
  }

  const applyScan = async () => {
    const image = sourceImageRef.current
    if (!image || !image.naturalWidth || !image.naturalHeight) return
    setProcessing(true)
    const version = loadVersionRef.current
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    try {
      const scanned = renderScannedDocument(image, image.naturalWidth, image.naturalHeight, corners, "document")
      let blob: Blob
      try {
        blob = await documentCanvasBlob(scanned)
      } finally {
        scanned.width = 0
        scanned.height = 0
      }
      if (version !== loadVersionRef.current) return
      releaseProcessed()
      processedBlobRef.current = blob
      processedUrlRef.current = URL.createObjectURL(blob)
      setProcessedUrl(processedUrlRef.current)
      setAdjusting(false)
      setErrorMessage("")
    } catch (error) {
      if (version === loadVersionRef.current) setErrorMessage(error instanceof Error ? error.message : "Não foi possível processar a imagem.")
    } finally {
      if (version === loadVersionRef.current) setProcessing(false)
    }
  }

  const confirmScan = () => {
    const blob = processedBlobRef.current
    if (!blob) return
    onScan(new File([blob], `documento-digitalizado-${Date.now()}.jpg`, { type: "image/jpeg" }))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[100dvh] max-w-none gap-4 rounded-none border-0 p-4 sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-2xl sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" />Digitalizar documento</DialogTitle>
          <DialogDescription>
            {adjusting
              ? "Ajuste os quatro cantos do documento e toque em Digitalizar."
              : "Confira o documento digitalizado antes de enviar."}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void loadSourceFile(file)
            event.currentTarget.value = ""
          }}
        />

        <div className="min-h-0 flex-1">
          {adjusting ? (
            <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl bg-black">
              <img
                ref={sourceImageRef}
                src={sourceUrl}
                alt="Documento capturado para ajuste"
                className="max-h-[65dvh] max-w-full select-none object-contain"
                draggable={false}
                onLoad={() => setSourceReady(true)}
              />
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon
                  points={`${corners.topLeft.x * 100},${corners.topLeft.y * 100} ${corners.topRight.x * 100},${corners.topRight.y * 100} ${corners.bottomRight.x * 100},${corners.bottomRight.y * 100} ${corners.bottomLeft.x * 100},${corners.bottomLeft.y * 100}`}
                  fill="rgba(59,130,246,0.12)" stroke="white" strokeWidth="0.6" vectorEffect="non-scaling-stroke"
                />
              </svg>
              {(Object.keys(corners) as CornerKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`Ajustar canto ${key}`}
                  className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-primary shadow-lg"
                  style={{ left: `${corners[key].x * 100}%`, top: `${corners[key].y * 100}%` }}
                  onPointerDown={(event) => moveCorner(key, event)}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) moveCorner(key, event)
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex max-h-[65dvh] min-h-[300px] items-center justify-center overflow-auto rounded-xl bg-muted/60 p-2">
              <img src={processedUrl} alt="Documento digitalizado" className="max-h-[63dvh] max-w-full rounded-md shadow-md" />
            </div>
          )}
        </div>

        {errorMessage ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage}</p> : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => galleryInputRef.current?.click()} disabled={processing}>
            <ImagePlus className="mr-2 h-4 w-4" />Modificar foto
          </Button>
          <Button
            type="button"
            onClick={() => adjusting ? void applyScan() : confirmScan()}
            disabled={processing || (adjusting && !sourceReady)}
          >
            {processing ? "Digitalizando..." : adjusting ? "Digitalizar" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
