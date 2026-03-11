"use client"

import { useState } from "react"
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
import {
  HelpCircle,
  Search,
  MessageCircle,
  Phone,
  Mail,
  Book,
  Video,
  FileText,
  Send,
  ExternalLink,
} from "lucide-react"

const FAQ_ITEMS = [
  {
    question: "Como cadastrar um novo cliente?",
    answer: "Acesse o menu 'Clientes' e clique no botão 'Novo Cliente'. Preencha os dados do cliente incluindo razão social, CNPJ, responsável e informações de contato. Depois adicione as unidades de atendimento com seus respectivos endereços."
  },
  {
    question: "Como criar um novo contrato?",
    answer: "Na página 'Contratos', clique em 'Novo Contrato'. Selecione o cliente, defina a duração, data de início e dia de vencimento das parcelas. Adicione os serviços que farão parte do contrato e configure a recorrência de cada um."
  },
  {
    question: "Como agendar um serviço?",
    answer: "Você pode agendar serviços de duas formas: 1) Na página 'Agenda', clique em 'Novo Agendamento' e preencha os dados. 2) Na página 'Serviços', na aba 'Agendamentos', clique em 'Novo Agendamento'."
  },
  {
    question: "Como configurar a recorrência de serviços?",
    answer: "Ao criar ou editar um agendamento, selecione o tipo de recorrência desejado (Semanal, Quinzenal, Mensal, etc.). Para recorrência semanal, você pode selecionar os dias da semana específicos."
  },
  {
    question: "Como gerenciar as equipes?",
    answer: "Acesse 'Equipes' no menu lateral. Lá você pode criar novas equipes, adicionar ou remover membros, e definir cores para identificação visual no calendário."
  },
  {
    question: "Como visualizar o financeiro?",
    answer: "A página 'Financeiro' mostra todas as parcelas dos contratos, organizadas por status (Pendentes, Pagas, Vencidas). Você pode filtrar por cliente, período e status, além de registrar pagamentos."
  },
  {
    question: "Como configurar notificações?",
    answer: "Em 'Notificações' > 'Regras de Envio', você pode criar regras automáticas para envio de lembretes por sistema, WhatsApp ou e-mail. Configure dias de antecedência, horário e equipes destinatárias."
  },
  {
    question: "Como exportar relatórios?",
    answer: "Na página 'Relatórios', selecione o tipo de relatório desejado, aplique os filtros e clique em 'Exportar Excel' ou 'Exportar PDF' para baixar o arquivo."
  },
  {
    question: "Como gerenciar permissões de usuários?",
    answer: "Em 'Configurações' > 'Permissões', você pode criar perfis de acesso personalizados e definir quais módulos cada perfil pode visualizar, editar ou excluir."
  },
  {
    question: "O que fazer em caso de serviço emergencial?",
    answer: "Ao criar um agendamento, marque a opção 'Emergência'. Isso destacará o serviço na agenda e enviará notificações prioritárias para a equipe responsável."
  },
]

const QUICK_GUIDES = [
  { title: "Guia Rápido de Início", icon: Book, description: "Primeiros passos no sistema" },
  { title: "Tutorial em Vídeo", icon: Video, description: "Aprenda visualmente" },
  { title: "Manual Completo", icon: FileText, description: "Documentação detalhada" },
]

export function AjudaContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  const filteredFAQ = FAQ_ITEMS.filter(
    item =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert("Mensagem enviada! Em breve nossa equipe entrará em contato.")
    setContactForm({ name: "", email: "", subject: "", message: "" })
  }

  return (
    <div className="space-y-6">
      {/* Search */}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Buscar na central de ajuda..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12 text-lg"
        />
      </div>


      {/* Quick Guides */}
      <div className="grid gap-4 md:grid-cols-3">
        {QUICK_GUIDES.map((guide) => (
          <Card key={guide.title} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <guide.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{guide.title}</h3>
                <p className="text-sm text-muted-foreground">{guide.description}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* FAQ */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Perguntas Frequentes
            </CardTitle>
            <CardDescription>As dúvidas mais comuns dos usuários</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {filteredFAQ.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {filteredFAQ.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum resultado encontrado para "{searchTerm}"</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contato Direto</CardTitle>
              <CardDescription>Fale com nossa equipe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Telefone</p>
                  <p className="text-sm text-muted-foreground">(51) 3333-4444</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-sm text-muted-foreground">(51) 99999-8888</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">E-mail</p>
                  <p className="text-sm text-muted-foreground">suporte@depclean.com</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enviar Mensagem</CardTitle>
              <CardDescription>Nos envie sua dúvida ou sugestão</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="space-y-6">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-6">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-6">
                  <Label htmlFor="subject">Assunto</Label>
                  <Input
                    id="subject"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-6">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    rows={4}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
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
