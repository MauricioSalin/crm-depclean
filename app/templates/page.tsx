"use client"

import { useState, useCallback, useRef } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { TemplatesContent, type EditorState } from "@/components/templates/templates-content"
import { Button } from "@/components/ui/button"
import { Upload, Save } from "lucide-react"

export default function TemplatesPage() {
  const [importOpen, setImportOpen] = useState(false)
  const editorRef = useRef<EditorState | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorEditing, setEditorEditing] = useState(false)
  const [editorName, setEditorName] = useState("")
  const [editorCanSave, setEditorCanSave] = useState(false)

  const handleEditorStateChange = useCallback((state: EditorState) => {
    editorRef.current = state
    setEditorOpen(state.isOpen)
    setEditorEditing(state.isEditing)
    setEditorName(state.name)
    setEditorCanSave(state.canSave)
  }, [])

  const editorTitle = editorEditing ? "Editar Template" : "Novo Template"
  const editorDescription = editorName || "Configure o template do contrato"

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:px-5 lg:ml-60">
        <Header
          title={editorOpen ? editorTitle : "Templates de Contratos"}
          description={editorOpen ? editorDescription : "Gerencie os modelos de contratos utilizados no sistema"}
          actions={
            editorOpen ? (
              <>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-9 text-sm"
                  onClick={() => editorRef.current?.onCancel()}
                >
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-9 text-sm"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
                <Button
                  className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => editorRef.current?.onSave()}
                  disabled={!editorCanSave}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Template
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setImportOpen(true)}
                className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar Template
              </Button>
            )
          }
        />

        <div className="mt-4 md:mt-5">
          <TemplatesContent
            openImport={importOpen}
            onImportChange={setImportOpen}
            onEditorStateChange={handleEditorStateChange}
          />
        </div>
      </main>
    </div>
  )
}
