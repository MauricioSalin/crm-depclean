"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
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
import { Bot, HelpCircle, MessageCircle, Mail, Send, WandSparkles } from "lucide-react"

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
    question: "Minha dúvida não está aqui. O que eu faço?",
    answer:
      "Use a DepAI. No campo acima, escreva sua pergunta e clique em Perguntar a DepAI. Ela pode ajudar com dúvidas sobre uso do sistema, clientes, contratos, agenda, relatórios, financeiro, certificados, configurações, informações internas, documentos e análises. Para decisões importantes, confira os dados nas telas oficiais antes de executar a ação.",
  },
]

export function AjudaContent() {
  const router = useRouter()
  const [depAIQuestion, setDepAIQuestion] = useState("")
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  const handleDepAIQuestionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const question = depAIQuestion.trim()
    if (!question) return

    router.push(`/depai?ask=${encodeURIComponent(question)}`)
  }

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    alert("Mensagem enviada! Em breve nossa equipe entrará em contato.")
    setContactForm({ name: "", email: "", subject: "", message: "" })
  }

  return (
    <div className="space-y-6">
      <form
        autoComplete="off"
        onSubmit={handleDepAIQuestionSubmit}
        className="flex w-full flex-col gap-2 sm:w-1/2 sm:flex-row sm:items-center"
      >
        <div className="flex h-12 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-6">
          <Bot className="h-5 w-5 shrink-0 text-primary" />
          <Input
            placeholder="Pergunte para DepAI sobre o sistema!"
            value={depAIQuestion}
            onChange={(event) => setDepAIQuestion(event.target.value)}
            className="h-auto border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>
        <Button type="submit" className="h-11 shrink-0 px-5" disabled={!depAIQuestion.trim()}>
          <WandSparkles className="mr-2 h-4 w-4" />
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
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-sm text-muted-foreground">(51) 99923-1401</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">E-mail</p>
                  <p className="text-sm text-muted-foreground">mauricio.salin0@gmail.com</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="mb-3">
              <CardTitle>Enviar Mensagem</CardTitle>
              <CardDescription>Nos envie sua dúvida ou sugestão.</CardDescription>
            </CardHeader>
            <CardContent>
              <form autoComplete="off" onSubmit={handleContactSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={contactForm.name}
                    onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="off"
                    value={contactForm.email}
                    onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto</Label>
                  <Input
                    id="subject"
                    value={contactForm.subject}
                    onChange={(event) => setContactForm({ ...contactForm, subject: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    value={contactForm.message}
                    onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })}
                    rows={4}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Mensagem
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
