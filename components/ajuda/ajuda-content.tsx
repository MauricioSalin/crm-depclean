"use client"

import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Bot, HelpCircle, Loader2, MessageCircle, Mail, Paperclip, Send, WandSparkles, X } from "lucide-react"
import { getApiErrorMessage } from "@/lib/api/errors"
import { getSupportContact, sendSupportMessage } from "@/lib/api/support"

const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENTS_TOTAL_SIZE = 35 * 1024 * 1024

const FAQ_ITEMS = [
  {
    question: "Como usar o Dashboard?",
    answer:
      "O Dashboard reúne os principais indicadores da operação, como clientes ativos, faturamento, serviços agendados, serviços realizados, produtividade das equipes e próximos atendimentos. Use os filtros de período no topo para analisar 30, 60, 90 dias ou um intervalo personalizado.",
  },
  {
    question: "Como cadastrar e consultar clientes?",
    answer:
      "Acesse Clientes para criar, buscar ou editar cadastros. Preencha os dados da empresa, responsável, contato e unidades de atendimento. No perfil do cliente você encontra informações relacionadas, como contratos, serviços, agenda, notificações e histórico.",
  },
  {
    question: "Como criar e acompanhar contratos?",
    answer:
      "Acesse Contratos e clique em Novo Contrato. Escolha o cliente, defina vigência, vencimento, valores e serviços contratados. Depois acompanhe status, parcelas, assinatura, documentos e agendamentos vinculados pelo detalhe do contrato.",
  },
  {
    question: "Como cadastrar serviços, equipes e funcionários?",
    answer:
      "Use Serviços para manter os tipos de atendimento, duração estimada e responsáveis. Em Equipes, organize os grupos de execução. Em Funcionários, cadastre colaboradores e, quando necessário, transforme um funcionário em usuário do sistema com perfil de permissão.",
  },
  {
    question: "Como agendar um serviço?",
    answer:
      "Você pode agendar pela Agenda ou pela página Agendamentos. Selecione cliente, unidade, serviço, data, horário, equipe responsável e observações. Antes de salvar, confira duração, deslocamento, recorrência e prioridade para evitar conflitos operacionais.",
  },
  {
    question: "Qual a diferença entre Agenda e Agendamentos?",
    answer:
      "A Agenda é ideal para visualizar o calendário e planejar datas. Agendamentos é melhor para gerenciar registros em lista, aplicar filtros, acompanhar status e executar ações rápidas. Use as duas páginas juntas para planejar e controlar a operação diária.",
  },
  {
    question: "Como emitir e acompanhar certificados?",
    answer:
      "Acesse Certificados para ver documentos pendentes, emitidos ou enviados. Após a conclusão de um serviço, confira cliente, unidade, datas, responsáveis e informações técnicas antes de emitir. Se algum dado estiver errado, ajuste o cadastro ou o agendamento de origem.",
  },
  {
    question: "Como visualizar relatórios e financeiro?",
    answer:
      "Em Relatórios, escolha o tipo de análise, aplique filtros de período, cliente, equipe ou serviço e confira gráficos e tabelas. No Financeiro, acompanhe valores, parcelas, vencimentos, pagamentos e pendências ligados a contratos e serviços.",
  },
  {
    question: "Como configurar notificações, permissões e usuários?",
    answer:
      "Em Configurações, ajuste regras de notificação, canais de envio, perfis de permissão e usuários do sistema. A página Notificações concentra os avisos recebidos dentro da plataforma. Revise permissões com cuidado, pois elas afetam o acesso às páginas e ações.",
  },
  {
    question: "Como funciona a permissão de ver somente meus agendamentos?",
    answer:
      "A permissão Ver somente seus Agendamentos libera Agenda e Agendamentos, mas mostra apenas registros em que o usuário está mencionado como funcionário avulso ou faz parte de uma equipe mencionada no agendamento. Para ver todos os registros, o perfil precisa de Visualizar Agenda, Gerenciar Agenda ou permissão administrativa.",
  },
  {
    question: "Quais documentos são enviados ao cliente?",
    answer:
      "Contratos assinados, informativos e certificados devem priorizar PDF. Informativos enviados ao cliente usam a mesma versão com marca d'água que aparece nos anexos do cliente. DOCX fica como formato interno de edição quando aplicável.",
  },
  {
    question: "Minha dúvida não está aqui. O que eu faço?",
    answer:
      "Use a DepAI. No campo acima, escreva sua pergunta e clique em Perguntar a DepAI. Ela pode ajudar com dúvidas sobre uso do sistema, clientes, contratos, agenda, relatórios, financeiro, certificados, configurações, informações internas, documentos e análises. Para decisões importantes, confira os dados nas telas oficiais antes de executar a ação.",
  },
]

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AjudaContent() {
  const router = useRouter()
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [depAIQuestion, setDepAIQuestion] = useState("")
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [attachments, setAttachments] = useState<File[]>([])
  const supportContactQuery = useQuery({
    queryKey: ["support", "contact"],
    queryFn: getSupportContact,
  })
  const supportContact = supportContactQuery.data?.data
  const sendMessageMutation = useMutation({
    mutationFn: sendSupportMessage,
    onSuccess: () => {
      toast.success("Mensagem enviada com sucesso.")
      setContactForm({ name: "", email: "", subject: "", message: "" })
      setAttachments([])
      if (attachmentInputRef.current) attachmentInputRef.current.value = ""
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível enviar a mensagem."))
    },
  })

  const handleDepAIQuestionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const question = depAIQuestion.trim()
    if (!question) return

    router.push(`/depai?ask=${encodeURIComponent(question)}`)
  }

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendMessageMutation.mutate({
      ...contactForm,
      attachments,
    })
  }

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (selectedFiles.length === 0) return

    const nextAttachments = [...attachments, ...selectedFiles].slice(0, MAX_ATTACHMENTS)
    const totalSize = nextAttachments.reduce((total, file) => total + file.size, 0)

    if (attachments.length + selectedFiles.length > MAX_ATTACHMENTS) {
      toast.warning(`Envie até ${MAX_ATTACHMENTS} anexos por mensagem.`)
    }

    if (totalSize > MAX_ATTACHMENTS_TOTAL_SIZE) {
      toast.error("Os anexos ultrapassam o limite permitido. Envie arquivos menores.")
      event.target.value = ""
      return
    }

    setAttachments(nextAttachments)
    event.target.value = ""
  }

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <div className="space-y-6">
      <form
        autoComplete="off"
        onSubmit={handleDepAIQuestionSubmit}
        className="grid w-full gap-2 sm:flex sm:max-w-2xl sm:items-center"
      >
        <div className="relative min-w-0 sm:flex-1">
          <Bot className="absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pergunte para DepAI sobre o sistema!"
            value={depAIQuestion}
            onChange={(event) => setDepAIQuestion(event.target.value)}
            className="h-9 bg-card pl-9 pr-3 text-base md:text-sm"
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={!depAIQuestion.trim()}>
          <WandSparkles className="h-4 w-4" />
          Perguntar a DepAI
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Perguntas Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, index) => (
                <AccordionItem key={item.question} value={`item-${index}`}>
                  <AccordionTrigger className="cursor-pointer text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="mb-3">
              <CardTitle>Contato</CardTitle>
              <CardDescription>Fale com o desenvolvedor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {supportContactQuery.isLoading ? "Carregando..." : supportContact?.whatsapp || "Não informado"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <Mail className="h-5 w-5 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">E-mail</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {supportContactQuery.isLoading ? "Carregando..." : supportContact?.email || "Não informado"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="mb-3">
              <CardTitle>Enviar Mensagem</CardTitle>
              <CardDescription>Nos envie sua dúvida, sugestão ou report de bug.</CardDescription>
            </CardHeader>
            <CardContent>
              <form autoComplete="off" onSubmit={handleContactSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="support-name">Nome</Label>
                  <Input
                    id="support-name"
                    value={contactForm.name}
                    onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-email">E-mail</Label>
                  <Input
                    id="support-email"
                    type="email"
                    autoComplete="off"
                    value={contactForm.email}
                    onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-subject">Assunto</Label>
                  <Input
                    id="support-subject"
                    placeholder="Ex: Bug na tela de contratos"
                    value={contactForm.subject}
                    onChange={(event) => setContactForm({ ...contactForm, subject: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-message">Mensagem</Label>
                  <Textarea
                    id="support-message"
                    value={contactForm.message}
                    onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })}
                    rows={4}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-attachments">Anexos</Label>
                  <Input
                    ref={attachmentInputRef}
                    id="support-attachments"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.log,.csv,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={handleAttachmentChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                    Adicionar anexos
                  </Button>
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
                            onClick={() => removeAttachment(index)}
                            aria-label={`Remover ${file.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={sendMessageMutation.isPending}
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sendMessageMutation.isPending ? "Enviando..." : "Enviar Mensagem"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
