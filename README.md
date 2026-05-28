# Depclean CRM

Frontend web da plataforma Depclean CRM.

## Visão Geral

O Depclean CRM centraliza clientes, contratos, agendamentos, equipes, funcionários, relatórios com financeiro, certificados, templates e notificações em uma aplicação operacional.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 App Router |
| Linguagem | TypeScript |
| UI | shadcn/ui + Radix UI |
| Estilização | Tailwind CSS |
| Dados | TanStack Query + Axios |
| Ícones | Lucide React |
| Toasts | Sonner |

## Ambiente

Crie um `.env.local` quando precisar apontar para outra API:

```env
NEXT_PUBLIC_API_URL=http://localhost:3333/api/v1
```

Se a variável não existir, o frontend usa `http://localhost:3333/api/v1`.

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

A aplicação roda em `http://localhost:3100`.

## Build

```bash
npm run build
```

## Integrações Ativas

- Clientes, contratos, serviços, equipes, funcionários, agenda, agendamentos, relatórios com financeiro, certificados, templates e notificações usam a API.
- Arquivos e anexos são abertos via `buildApiFileUrl`, que resolve caminhos como `/api/v1/files/...`.
- A aba `Anexos` do cliente consolida documentos vindos de contratos, NAs, informativos, certificados e anexos manuais.
- Anexos manuais do cliente são enviados por multipart para `POST /clients/:id/attachments`.
- O controle de acesso do frontend fica em `lib/auth/permissions.ts` e deve acompanhar o catálogo do backend em `api-depclean/src/database/constants/permissions.ts`.
- Agenda e Agendamentos aceitam `agenda_own_view`; nesse caso, o backend retorna somente registros em que o usuário ou uma de suas equipes está mencionado.

## DepAI e documentação

A DepAI usa a base operacional do backend em `api-depclean/src/modules/depai/depai-business-knowledge.ts`.

Ao alterar fluxo de tela, regra de permissão, envio de documento, ClickSign, WhatsApp ou anexos, atualize também:

- `api-depclean/src/modules/depai/depai-business-knowledge.ts`
- `api-depclean/docs/agenda-clicksign-teste.md`

## Estrutura

```text
app/                 Rotas Next.js
components/          Telas e componentes da aplicação
components/ui/       Componentes base
lib/api/             Clients HTTP da API
lib/auth/            Sessão e autenticação local
lib/types.ts         Tipos compartilhados do frontend
```

## Validação

```bash
npm run build
```

O build atual pula typecheck completo por configuração do Next, então erros de contrato com a API devem ser validados também pelo build da `api-depclean`.
