"use client"

import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download, FileCheck2, FileSpreadsheet, FileUp, Loader2, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"

export type CsvImportField = {
  key: string
  label: string
  required?: boolean
}

type CsvImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: CsvImportField[]
  onImport: (rows: Array<Record<string, string>>) => Promise<void>
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === "\"" && quoted && next === "\"") {
      current += "\""
      index += 1
      continue
    }
    if (char === "\"") {
      quoted = !quoted
      continue
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }

  cells.push(current.trim())
  return cells
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? ""
  return firstLine.split(";").length > firstLine.split(",").length ? ";" : ","
}

function parseCsv(text: string) {
  const delimiter = detectDelimiter(text)
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0] ?? "", delimiter)
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter)
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? ""
      return acc
    }, {})
  })

  return { headers, rows }
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`
}

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "modelo"
}

export function CsvImportDialog({ open, onOpenChange, title, description, fields, onImport }: CsvImportDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const closeResetTimeoutRef = useRef<number | null>(null)
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Array<Record<string, string>>>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const requiredFields = useMemo(() => fields.filter((field) => field.required), [fields])

  const reset = useCallback(() => {
    setFileName("")
    setHeaders([])
    setRows([])
    setMapping({})
    setIsImporting(false)
    setIsDragging(false)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const clearCloseResetTimeout = useCallback(() => {
    if (closeResetTimeoutRef.current === null) return
    window.clearTimeout(closeResetTimeoutRef.current)
    closeResetTimeoutRef.current = null
  }, [])

  useEffect(() => {
    if (open) {
      clearCloseResetTimeout()
      return
    }

    closeResetTimeoutRef.current = window.setTimeout(() => {
      reset()
      closeResetTimeoutRef.current = null
    }, 220)

    return clearCloseResetTimeout
  }, [clearCloseResetTimeout, open, reset])

  const handleFileChange = async (file?: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Envie um arquivo .csv.")
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("O CSV precisa ter cabeçalho e pelo menos uma linha.")
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    const nextMapping = fields.reduce<Record<string, string>>((acc, field) => {
      const match = parsed.headers.find((header) => normalizeHeader(header) === normalizeHeader(field.label) || normalizeHeader(header) === normalizeHeader(field.key))
      acc[field.key] = match ?? ""
      return acc
    }, {})

    setFileName(file.name)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setMapping(nextMapping)
  }

  const handleDownloadTemplate = () => {
    const header = fields.map((field) => escapeCsvCell(field.label)).join(";")
    const blob = new Blob([`\uFEFF${header}\n`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${toSlug(title)}-modelo.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void handleFileChange(event.dataTransfer.files?.[0])
  }

  const handleSubmit = async () => {
    for (const field of requiredFields) {
      if (!mapping[field.key]) {
        toast.error(`Selecione a coluna para "${field.label}".`)
        return
      }
    }

    const mappedRows = rows.map((row) =>
      fields.reduce<Record<string, string>>((acc, field) => {
        const column = mapping[field.key]
        acc[field.key] = column ? String(row[column] ?? "").trim() : ""
        return acc
      }, {}),
    )

    const missing = mappedRows.findIndex((row) => requiredFields.some((field) => !row[field.key]))
    if (missing >= 0) {
      toast.error(`A linha ${missing + 2} possui campo obrigatório vazio.`)
      return
    }

    setIsImporting(true)
    try {
      await onImport(mappedRows)
      onOpenChange(false)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="flex max-h-[min(82dvh,680px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 gap-3 px-6 pb-4 pt-6 sm:flex-row sm:items-start sm:gap-4 sm:space-y-0">
          <div className="space-y-1.5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          <Button type="button" variant="outline" className="h-9 shrink-0 gap-2 rounded-full sm:ml-auto" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4" />
            Baixar modelo
          </Button>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4 pr-5">
          <input
            ref={inputRef}
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void handleFileChange(event.target.files?.[0])}
          />

          <button
            type="button"
            className={`group flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition-all duration-300 ${
              isDragging
                ? "border-primary/60 bg-primary/10 shadow-md"
                : "border-border bg-muted/20 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
              {fileName ? <FileCheck2 className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
            </div>
            <span className="text-sm font-semibold text-foreground">
              {fileName || "Selecionar arquivo CSV"}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {fileName ? `${rows.length} linha(s) identificada(s)` : "Clique ou arraste o arquivo .csv aqui"}
            </span>
          </button>

          {headers.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl bg-muted/30 px-4 py-3">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Relacionamento das colunas</p>
                  <p className="text-xs text-muted-foreground">Confira os campos antes de importar.</p>
                </div>
              </div>
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_1.2fr] gap-3 border-b bg-background/95 px-1 py-2 text-xs font-semibold text-muted-foreground backdrop-blur">
                <span>Campo do sistema</span>
                <span>Coluna do CSV</span>
              </div>
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-[1fr_1.2fr] items-center gap-3">
                  <div className="text-sm font-medium">
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </div>
                  <SearchableSelect
                    value={mapping[field.key] || "none"}
                    onValueChange={(value) => setMapping((current) => ({ ...current, [field.key]: value === "none" ? "" : value }))}
                    options={[
                      { value: "none", label: "Não importar" },
                      ...headers.map((header) => ({ value: header, label: header })),
                    ]}
                    placeholder="Selecione a coluna"
                    searchPlaceholder="Buscar coluna..."
                    emptyMessage="Nenhuma coluna encontrada."
                    includeAll={false}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={rows.length === 0 || isImporting} onClick={() => void handleSubmit()}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
