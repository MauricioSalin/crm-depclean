"use client"

import { Suspense, useCallback, useRef, useState } from "react"
import { Save } from "lucide-react"

import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { TemplatesContent, type EditorState } from "@/components/templates/templates-content"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TemplateTab = "contract" | "informative" | "certificate"

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<TemplateTab>("contract")
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

  const tabLabel =
    activeTab === "contract" ? "Contrato" : activeTab === "informative" ? "Informativo" : "Certificado"
  const editorTitle = editorEditing ? `Editar Template de ${tabLabel}` : `Novo Template de ${tabLabel}`
  const editorDescription = editorName || `Configure o template de ${tabLabel.toLowerCase()}`
  const pageTitle = editorOpen ? editorTitle : "Templates"
  const pageDescription = editorOpen
    ? editorDescription
    : "Gerencie os modelos de contratos, informativos e certificados usados nas automações."

  return (
    <div className={editorOpen ? "flex h-dvh overflow-hidden bg-background" : "flex min-h-screen bg-background"}>
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main
        className={
          editorOpen
            ? "flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 md:px-4 lg:ml-60 lg:px-5"
            : "flex-1 px-3 pb-4 md:px-4 lg:ml-60 lg:px-5"
        }
      >
        <Header
          title={pageTitle}
          description={pageDescription}
          actions={
            editorOpen ? (
              <>
                <Button
                  variant="outline"
                  className="h-9 w-full text-sm sm:w-auto"
                  onClick={() => editorRef.current?.onCancel()}
                >
                  Cancelar
                </Button>
                <Button
                  className="h-9 w-full bg-primary text-sm text-primary-foreground hover:bg-primary/90 sm:w-auto"
                  onClick={() => editorRef.current?.onSave()}
                  disabled={!editorCanSave}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Template
                </Button>
              </>
            ) : (
              null
            )
          }
        />

        <div className={editorOpen ? "mt-4 flex min-h-0 flex-1 flex-col space-y-4 md:mt-5" : "mt-4 space-y-4 md:mt-5"}>
          {!editorOpen ? (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TemplateTab)}>
              <TabsList className="grid w-full grid-cols-3 gap-2 bg-transparent p-0 lg:w-auto">
                <TabsTrigger
                  value="contract"
                  className="rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Contratos
                </TabsTrigger>
                <TabsTrigger
                  value="informative"
                  className="rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Informativos
                </TabsTrigger>
                <TabsTrigger
                  value="certificate"
                  className="rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Certificados
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}

          <Suspense
            fallback={
              <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                Carregando...
              </div>
            }
          >
            <TemplatesContent
              kind={activeTab}
              openImport={importOpen}
              onImportChange={setImportOpen}
              onEditorStateChange={handleEditorStateChange}
            />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
