# Depclean CRM

Sistema de gestão operacional para empresas de serviços como desentupimento, limpeza de reservatórios, dedetização e higienização.

## Visão Geral

O Depclean CRM é uma aplicação web completa para gerenciamento de operações de campo, centralizando o controle de clientes, contratos, agendamentos, equipes e financeiro em um único painel.

## Funcionalidades

- **Dashboard** — Visão geral com KPIs, gráficos de receita, produtividade e lembretes de serviços
- **Clientes** — Cadastro e gestão de clientes (condomínios, residências, empresas, hospitais etc.), com suporte a múltiplas unidades por cliente
- **Contratos** — Criação e acompanhamento de contratos com editor de texto rico, integração com assinatura digital (ClickSign) e controle de parcelas
- **Serviços** — Gestão de tipos de serviço com precificação, recorrência e associação a equipes
- **Agenda** — Calendário e agendamento de serviços com seleção de cliente, equipe, data/hora e flag de emergência
- **Equipes e Funcionários** — Gerenciamento de equipes e funcionários com atribuição de funções e contatos
- **Financeiro** — Controle de parcelas, status de pagamento (pendente, pago, vencido, cancelado) e relatórios de receita
- **Analytics e Relatórios** — Métricas de desempenho, produtividade de equipes e exportação de relatórios
- **Notificações** — Alertas do sistema com suporte a WhatsApp e e-mail
- **Tarefas** — Gerenciamento de tarefas internas
- **Configurações** — Personalização do sistema

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript 5 |
| UI | shadcn/ui + Radix UI |
| Estilização | Tailwind CSS 4 |
| Formulários | React Hook Form + Zod |
| Gráficos | Recharts |
| Editor de texto | TipTap |
| Datas | date-fns |
| Ícones | Lucide React |
| Notificações | Sonner |
| Analytics | Vercel Analytics |

## Como Rodar

### Pré-requisitos

- Node.js 18+
- npm ou pnpm

### Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd crm-depclean

# Instale as dependências
npm install
# ou
pnpm install
```

### Desenvolvimento

```bash
npm run dev
# ou
pnpm dev
```

Acesse [http://localhost:3100](http://localhost:3100).

### Build para produção

```bash
npm run build
npm start
```

## Estrutura do Projeto

```
crm-depclean/
├── app/                    # Rotas Next.js (App Router)
│   ├── page.tsx            # Dashboard
│   ├── clientes/           # Gestão de clientes
│   ├── contratos/          # Gestão de contratos
│   ├── servicos/           # Tipos de serviço
│   ├── agenda/             # Calendário
│   ├── agendamentos/       # Agendamentos
│   ├── equipes/            # Equipes
│   ├── funcionarios/       # Funcionários
│   ├── financeiro/         # Financeiro
│   ├── analytics/          # Analytics
│   ├── relatorios/         # Relatórios
│   └── notificacoes/       # Notificações
├── components/             # Componentes reutilizáveis
│   ├── ui/                 # Componentes base (shadcn/ui)
│   ├── dashboard/          # Componentes do dashboard
│   ├── clientes/           # Componentes de clientes
│   ├── contratos/          # Componentes de contratos
│   └── ...
├── lib/
│   ├── types.ts            # Interfaces TypeScript
│   ├── mock-data.ts        # Dados mockados
│   └── utils.ts            # Utilitários
└── hooks/                  # Custom hooks
```

## Status

Protótipo frontend com dados mockados. Pronto para integração com backend/API.

**Versão:** 0.1.0
