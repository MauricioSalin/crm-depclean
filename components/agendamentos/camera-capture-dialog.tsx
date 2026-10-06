"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { documentCanvasBlob, documentImageSize } from "@/lib/document-scanner"

interface CameraCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permita o acesso à câmera nas configurações deste site e tente novamente."
  }
  if (name === "NotFoundError") return "Nenhuma câmera foi encontrada neste aparelho."
  if (name === "NotReadableError") return "A câmera está em uso. Feche o outro aplicativo que usa a câmera e tente novamente."
  return "Não foi possível abrir a câmera aqui. Verifique a permissão da câmera ou atualize o navegador e tente novamente."
}

export function CameraCaptureDialog({ open, onOpenChange, onCapture }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const versionRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [attempt, setAttempt] = useState(0)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    if (!open) return
    const version = ++versionRef.current
    setReady(false)
    setCapturing(false)
    setErrorMessage("")
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
          throw new Error("Camera unavailable")
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, max: 2200 },
            height: { ideal: 1440, max: 2200 },
            frameRate: { ideal: 15, max: 30 },
          },
        })
        if (version !== versionRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) { stopCamera(); return }
        video.srcObject = stream
        await video.play()
      } catch (error) {
        if (version !== versionRef.current) return
        stopCamera()
        setErrorMessage(cameraErrorMessage(error))
      }
    }
    void startCamera()
    const pauseCamera = () => {
      if (!document.hidden) return
      ++versionRef.current
      stopCamera()
      setReady(false)
      setErrorMessage("A câmera foi pausada. Toque em Tentar novamente para continuar.")
    }
    document.addEventListener("visibilitychange", pauseCamera)
    return () => {
      ++versionRef.current
      document.removeEventListener("visibilitychange", pauseCamera)
      stopCamera()
    }
  }, [open, attempt, stopCamera])

  const capture = async () => {
    const video = videoRef.current
    if (!video || !ready || capturing || !video.videoWidth || !video.videoHeight) return
    const version = versionRef.current
    setCapturing(true)
    const canvas = document.createElement("canvas")
    try {
      const size = documentImageSize(video.videoWidth, video.videoHeight)
      canvas.width = size.width
      canvas.height = size.height
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Não foi possível capturar a foto.")
      context.drawImage(video, 0, 0, size.width, size.height)
      // Release the camera before encoding or uploading the captured frame.
      stopCamera()
      setReady(false)
      const blob = await documentCanvasBlob(canvas)
      if (version !== versionRef.current) return
      onOpenChange(false)
      onCapture(new File([blob], `foto-atendimento-${Date.now()}.jpg`, { type: "image/jpeg" }))
    } catch {
      if (version === versionRef.current) {
        stopCamera()
        setReady(false)
        setErrorMessage("Não foi possível capturar a foto. Toque em Tentar novamente.")
      }
    } finally {
      canvas.width = 0
      canvas.height = 0
      if (version === versionRef.current) setCapturing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Câmera do atendimento</DialogTitle>
          <DialogDescription>Fotografe diretamente no agendamento. A foto não será salva na galeria do celular.</DialogDescription>
        </DialogHeader>
        <video ref={videoRef} autoPlay playsInline muted aria-label="Prévia da câmera" className="max-h-[60dvh] w-full rounded-xl bg-black object-contain"
          onLoadedData={() => setReady(Boolean(streamRef.current))} />
        {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
        {!ready && !errorMessage ? <p role="status" className="text-sm text-muted-foreground">Abrindo câmera...</p> : null}
        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {errorMessage ? <>
            <Button type="button" onClick={() => setAttempt((current) => current + 1)}>Tentar novamente</Button>
          </> : <Button type="button" disabled={!ready || capturing} onClick={() => void capture()}>
            {capturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            {capturing ? "Preparando foto..." : "Tirar foto"}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
