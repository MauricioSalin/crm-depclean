"use client"

import { useMemo, useState } from "react"
import { FileUp, Loader2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CsvImportField = {
  key: string
  label: string
  required?: boolean
}

type CsvImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
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

export function CsvImportDialog({ open, onOpenChange, title, description, fields, onImport }: CsvImportDialogProps) {
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Array<Record<string, string>>>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [isImporting, setIsImporting] = useState(false)

  const requiredFields = useMemo(() => fields.filter((field) => field.required), [fields])

  const reset = () => {
    setFileName("")
    setHeaders([])
    setRows([])
    setMapping({})
    setIsImporting(false)
  }

  const handleFileChange = async (file?: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Envie um arquivo .csv.")
      return
    }

    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("O CSV precisa ter cabeçalho e pelo menos uma linha.")
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
      reset()
      onOpenChange(false)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Arquivo CSV</Label>
            <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={(event) => void handleFileChange(event.target.files?.[0])} />
            {fileName ? (
              <p className="text-xs text-muted-foreground">
                {fileName} · {rows.length} linha(s)
              </p>
            ) : null}
          </div>

          {headers.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_1.2fr] gap-3 text-xs font-semibold text-muted-foreground">
                <span>Campo</span>
                <span>Coluna do CSV</span>
              </div>
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-[1fr_1.2fr] items-center gap-3">
                  <div className="text-sm font-medium">
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </div>
                  <Select
                    value={mapping[field.key] || "none"}
                    onValueChange={(value) => setMapping((current) => ({ ...current, [field.key]: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não importar</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={`${field.key}-${header}`} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
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
