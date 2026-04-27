"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { Award, FileText, Newspaper, Save } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { TemplatesContent, type EditorState } from "@/components/templates/templates-content"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type TemplateTab = "contract" | "informative" | "certificate"

const TEMPLATE_TABS = [
  {
    value: "contract",
    label: "Contratos",
    icon: FileText,
    description: "Modelos contratuais usados nas automações",
  },
  {
    value: "informative",
    label: "Informativos",
    icon: Newspaper,
    description: "Comunicados e documentos informativos",
  },
  {
    value: "certificate",
    label: "Certificados",
    icon: Award,
    description: "Certificados emitidos a partir dos serviços",
  },
] as const satisfies Array<{
  value: TemplateTab
  label: string
  icon: typeof FileText
  description: string
}>

function getTemplateTab(value: string | null): TemplateTab {
  if (value === "informative" || value === "certificate") return value
  return "contract"
}

function TemplatesPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TemplateTab>(() => getTemplateTab(searchParams.get("tab")))
  const [importOpen, setImportOpen] = useState(false)
  const editorRef = useRef<EditorState | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorEditing, setEditorEditing] = useState(false)
  const [editorName, setEditorName] = useState("")
  const [editorCanSave, setEditorCanSave] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)

  const handleEditorStateChange = useCallback((state: EditorState) => {
    editorRef.current = state
    setEditorOpen(state.isOpen)
    setEditorEditing(state.isEditing)
    setEditorName(state.name)
    setEditorCanSave(state.canSave)
    setEditorSaving(state.isSaving)
  }, [])

  useEffect(() => {
    const nextTab = getTemplateTab(searchParams.get("tab"))
    setActiveTab((current) => (current === nextTab ? current : nextTab))
  }, [searchParams])

  const replaceRouteParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const handleTemplateTabChange = useCallback(
    (value: TemplateTab) => {
      setActiveTab(value)
      replaceRouteParams({
        tab: value,
        template: null,
        templateMode: null,
        view: null,
      })
    },
    [replaceRouteParams],
  )

  const tabLabel =
    activeTab === "contract" ? "Contrato" : activeTab === "informative" ? "Informativo" : "Certificado"
  const editorTitle = editorEditing ? `Editar Template de ${tabLabel}` : `Novo Template de ${tabLabel}`
  const editorDescription = editorName || `Configure o template de ${tabLabel.toLowerCase()}`
  const pageTitle = editorOpen ? editorTitle : "Templates"
  const pageDescription = editorOpen
    ? editorDescription
    : "Gerencie os modelos de contratos, informativos e certificados usados nas automações."

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <main className="flex-1 px-3 pb-4 md:px-4 lg:ml-60 lg:px-5">
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
                  disabled={!editorCanSave || editorSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {editorSaving ? "Salvando..." : "Salvar Template"}
                </Button>
              </>
            ) : (
              null
            )
          }
        />

        <div className="mt-4 space-y-4 md:mt-5">
          {!editorOpen ? (
            <>
              <Tabs value={activeTab} onValueChange={(value) => handleTemplateTabChange(value as TemplateTab)}>
                <TabsList className="grid w-full grid-cols-3 gap-2 bg-transparent p-0 sm:hidden">
                  {TEMPLATE_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-full bg-muted px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="hidden gap-4 sm:grid sm:grid-cols-3">
                {TEMPLATE_TABS.map((tab) => (
                  <Card
                    key={tab.value}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      activeTab === tab.value && "bg-primary/5 ring-2 ring-primary",
                    )}
                    onClick={() => handleTemplateTabChange(tab.value)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "rounded-lg p-2",
                            activeTab === tab.value ? "bg-primary/20" : "bg-primary/10",
                          )}
                        >
                          <tab.icon className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-base">{tab.label}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{tab.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
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

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-background">
          <div className="hidden lg:block">
            <Sidebar />
          </div>
          <main className="flex-1 px-3 pb-4 md:px-4 lg:ml-60 lg:px-5">
            <Header title="Templates" description="Gerencie os modelos de contratos, informativos e certificados." />
          </main>
        </div>
      }
    >
      <TemplatesPageContent />
    </Suspense>
  )
}
