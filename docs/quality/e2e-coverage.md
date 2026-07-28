# Cobertura automatizada do Depclean CRM

Esta suíte usa Playwright e foi separada em duas camadas:

- execução determinística com APIs simuladas, segura para validar interface, rotas, seleções e contratos de interação sem alterar dados;
- smoke test opcional contra um ambiente real, limitado a autenticação e leitura.

## Escopo automatizado

- autenticação por senha, máscara de CPF e restauração segura da rota original;
- proteção contra redirecionamento externo após o login;
- carregamento das 29 rotas autenticadas e das três rotas públicas;
- navegação pelos 13 itens do menu lateral;
- detecção de erros JavaScript durante a abertura das telas;
- auditoria de nomes acessíveis de botões e links;
- auditoria de nomes acessíveis de botões, abas, campos, seleções, caixas e opções;
- acionamento isolado de todos os botões inicialmente utilizáveis nas 16 telas operacionais;
- abertura e fechamento das seleções inicialmente utilizáveis em cada tela;
- busca de clientes;
- anexos de inventário dos controles encontrados em cada tela.

## Resultado de referência

Validação local em 28/07/2026:

- 84 cenários Playwright;
- 83 aprovados;
- um smoke read-only contra ambiente real ignorado por ausência das credenciais opcionais;
- lint, TypeScript e build de produção aprovados.

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
pnpm test:e2e
```

Para executar também o smoke real:

```bash
E2E_LIVE_EMAIL="usuario" E2E_LIVE_PASSWORD="senha" pnpm test:e2e
```

O relatório HTML é gerado em `playwright-report/` e os artefatos de falha em
`test-results/`. Ambos ficam fora do Git.

## Limite atual

Ações destrutivas e integrações externas reais, como Clicksign, WhatsApp, R2 e
envio de e-mail, exigem um banco e credenciais exclusivos de homologação. Elas
não devem ser executadas contra produção.
