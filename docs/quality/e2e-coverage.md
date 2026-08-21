# Cobertura automatizada do Depclean CRM

Esta suíte usa Playwright e foi separada em duas camadas:

- execução determinística com APIs simuladas, segura para validar interface, rotas, seleções e contratos de interação sem alterar dados;
- smoke test opcional contra um ambiente real, limitado a autenticação e leitura.

## Inventário atual

- 50 arquivos Playwright;
- 230 cenários em Chromium;
- execução determinística com API simulada por padrão;
- um smoke opcional e somente leitura contra ambiente real.

## Escopo automatizado

- autenticação por senha, máscara de CPF e restauração segura da rota original;
- proteção contra redirecionamento externo após o login;
- carregamento das 29 rotas autenticadas e das três rotas públicas;
- navegação pelos 13 itens do menu lateral;
- detecção de erros JavaScript durante a abertura das telas;
- auditoria de nomes acessíveis de botões e links;
- auditoria de nomes acessíveis de botões, abas, campos, seleções, caixas e opções;
- acionamento isolado dos tipos de ação inicialmente utilizáveis nas 16 telas operacionais; na grade da Agenda, um horário livre representativo cobre a ação repetida em cada célula;
- abertura e fechamento das seleções inicialmente utilizáveis em cada tela;
- busca de clientes;
- início guiado da DepAI, preparação da pergunta sem envio automático e filtragem dos objetivos conforme as permissões do perfil;
- Agenda diária, semanal e mensal, preferências, filtros persistidos, responsividade, carregamento, visibilidade por permissão, conflitos e cartões cancelados;
- criação, edição, reagendamento e execução de agendamentos, inclusive duração em horas/dias, grupos multi-dia, cobrança avulsa, início com aviso de inadimplência, cancelamento, conclusão e exportação;
- anexos de atendimento com digitalização, câmera, galeria, arquivos, renomeação, remoção, persistência imediata, 30 MB por arquivo e mais de dez anexos acumulados;
- workspace de anexos do cliente com pastas, paginação, upload, arrastar e soltar, download, renomeação, movimentação, exclusão e destinos responsivos;
- credenciais FEPAM ocultas e reveladas somente com permissão;
- criação, renovação, assinatura, parcelas, plano de agenda e estados de contratos;
- relatórios operacionais, exportação de execução, gráficos e tabela financeira com parcelas contratuais, cobranças avulsas e permissões de edição;
- certificados pendentes, templates de informativos com horário padrão de 08:00, logs de WhatsApp/e-mail e seus anexos;
- tooltips, atalhos, modais, cores de ações, seletores mobile e acessibilidade dos controles;
- anexos de inventário dos controles encontrados em cada tela.

## Resultado de referência

Validação concluída em 20/08/2026, em Chromium e com `--workers=1`:

- os 230 cenários foram percorridos na passagem integral;
- 227 cenários determinísticos foram aprovados nessa passagem e o smoke real read-only foi ignorado por ausência das credenciais opcionais;
- duas verificações responsivas expuseram variação subpixel e sincronização de fechamento de menu; os testes foram endurecidos sem alterar o produto e repetidos juntos com 2/2 aprovações;
- estado consolidado da suíte atual: 229 cenários determinísticos aprovados, um smoke opcional ignorado e nenhuma falha conhecida pendente.

A referência histórica de 28/07/2026 (84 cenários) foi removida do resumo principal porque não representa mais a suíte atual.

Os cenários de controles reabrem a rota antes de cada ação. Isso evita que um
modal ou navegação altere o estado do próximo teste. Controles cobertos
intencionalmente por outro elemento são registrados no anexo como obstruídos e
não recebem cliques forçados, pois um usuário também não conseguiria acioná-los
naquele estado.

## Segurança

Os testes determinísticos interceptam todas as chamadas para `localhost:3333/api/v1`.
Nenhuma criação, edição ou exclusão chega ao banco real.

O smoke real só é executado quando `E2E_LIVE_EMAIL` e `E2E_LIVE_PASSWORD` são
fornecidos no ambiente. Ele não executa ações de escrita.

## Execução

```bash
pnpm exec playwright install chromium
pnpm exec playwright test --list
pnpm exec playwright test --workers=1
```

Para validar somente uma área durante desenvolvimento:

```bash
pnpm exec playwright test e2e/depai-guided-analysis.spec.ts --workers=1
```

Para executar também o smoke real:

```bash
E2E_LIVE_EMAIL="usuario" E2E_LIVE_PASSWORD="senha" pnpm exec playwright test e2e/live-smoke.spec.ts --workers=1
```

O relatório HTML é gerado em `playwright-report/` e os artefatos de falha em
`test-results/`. Ambos ficam fora do Git.

## Limite atual

Ações destrutivas e integrações externas reais, como Clicksign, WhatsApp, R2 e
envio de e-mail, exigem um banco e credenciais exclusivos de homologação. Elas
não devem ser executadas contra produção.
