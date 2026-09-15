<div align="center">

# 🧱 PRUMO

### Seu depósito no prumo.

**Gestão para depósitos de materiais de construção.**
Vendas no balcão · Fiado · Indicadores · Assistente de IA

![Status](https://img.shields.io/badge/status-publicado-1B7A46?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-16191D?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/banco-PostgreSQL-16191D?style=for-the-badge)
![Interface](https://img.shields.io/badge/interface-mobile--first-FFC400?style=for-the-badge)

[**Acessar o Prumo**](https://prumo-omega.vercel.app) · [Documentação da API](https://prumo-omega.vercel.app/api/docs)

Atualizado em **15 de setembro de 2026**.

</div>

## O projeto

O Prumo nasceu para substituir o caderno de vendas de um depósito e dar ao dono uma visão do negócio: quanto vendeu, quem compra, quais produtos saem mais e quanto ainda há para receber.

> **A meta de experiência é lançar uma venda simples em menos de 30 segundos.**
> O sistema precisa acompanhar o ritmo do balcão.

O projeto já tem frontend, API, banco de dados, autenticação e assistente de IA implementados. Está publicado no **Vercel**, com PostgreSQL no **Neon**. A interface é em português do Brasil, com temas claro e escuro e adaptação para celular e desktop.

## Sumário

- [Funcionalidades](#funcionalidades)
- [O Zé: assistente de IA](#o-zé-assistente-de-ia)
- [Arquitetura](#arquitetura)
- [Executar localmente](#executar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Testes e qualidade](#testes-e-qualidade)
- [Banco, migrações e backup](#banco-migrações-e-backup)
- [Deploy](#deploy)
- [Identidade visual](#identidade-visual)
- [Escopo e próximos passos](#escopo-e-próximos-passos)
- [Documentação](#documentação)

## Funcionalidades

| Área | O que já está implementado |
|---|---|
| **Vendas** | Carrinho de itens, preço negociado, desconto, cálculo de troco e pagamento em dinheiro, Pix, cartão ou fiado. Venda vinculada a cliente ou avulsa para “Consumidor”. |
| **Histórico de vendas** | Consulta, detalhe, cancelamento e correção: a venda original é cancelada e os dados são reaproveitados para lançar a substituta. |
| **Recibos** | Comprovante para impressão térmica de 80 mm, compartilhamento por WhatsApp e segunda via no detalhe da venda. |
| **Clientes e produtos** | Cadastro, busca, categorias, unidades de medida, preço de venda e custo opcional. |
| **Fiado** | Saldo em aberto, pagamentos parciais, recebimento distribuído entre vendas antigas, destaque de atrasados e mensagem de cobrança por WhatsApp. |
| **Indicadores** | Faturamento, comparação entre períodos, ticket médio, evolução das vendas, ranking de clientes, produtos mais vendidos e vendas por vendedor. |
| **Usuários e permissões** | Papéis de dono e vendedor, administração de usuários e troca de senha. O vendedor tem painel próprio e consulta suas vendas. |
| **Auditoria** | Histórico de alterações em cadastros de clientes e produtos, com autoria e valores anteriores e novos. |
| **Rascunho de venda** | Recuperação da venda em andamento após interrupções, com armazenamento no navegador e validade de 30 minutos. |
| **Ditado** | Entrada por voz nos navegadores compatíveis, com correção de transcrição apoiada no vocabulário de clientes e produtos. |

O **dono** acessa os indicadores da loja, a carteira de clientes, o mapa de fiados, a administração de usuários e a auditoria. O **vendedor** opera o balcão, encontra e cadastra clientes durante a venda e recebe pagamentos pelos fluxos disponíveis para seu papel.

O rascunho protege o preenchimento, mas **gravar a venda exige conexão com a API**. Não há fila de reenvio automático: uma requisição interrompida pode já ter sido recebida pelo servidor.

## O Zé: assistente de IA

O Zé permite consultar informações e executar operações em linguagem natural. A integração usa **OpenRouter**, com modelo configurável por variável de ambiente.

Exemplos de pedidos:

- “Quanto vendemos neste mês?”
- “Quais produtos mais saíram?”
- “Cadastre o cliente João com este telefone…”
- “Recebi R$ 150 do fiado do João.”
- “Monte uma venda com dois sacos de cimento.”

O modelo usa um catálogo de funções do sistema. As funções de escrita reaproveitam os serviços de negócio usados pela API REST.

- O modelo não executa SQL livre.
- As funções disponíveis são filtradas pelo papel do usuário, e a permissão é conferida novamente na execução.
- Nomes ambíguos pedem escolha antes de uma gravação.
- Lançar ou cancelar uma venda passa por uma proposta e confirmação com token assinado pelo servidor.
- Cadastros e recebimentos permitidos podem ser executados diretamente, com resumo do resultado.

**Sem `OPENROUTER_API_KEY`, o restante do sistema continua funcionando.** O endpoint do assistente responde com indisponibilidade de configuração.

## Arquitetura

| Camada | Tecnologias |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4 e Lucide |
| API | Node.js, Express 4 e JavaScript com módulos ES |
| Persistência | PostgreSQL, driver `pg`, SQL e migrações versionadas |
| Autenticação | JWT, refresh token em cookie HTTP-only e senhas com bcrypt |
| IA | OpenRouter, chamadas de funções e ditado pela API de voz do navegador |
| Infraestrutura | Docker Compose no desenvolvimento; Vercel Services e Neon em produção |

```text
Prumo/
├── FrontEnd/src/
│   ├── pages/          # Telas de operação e gestão
│   ├── components/     # Componentes compartilhados
│   ├── services/       # Cliente HTTP e acesso à API
│   ├── auth/           # Sessão e proteção de rotas
│   ├── theme/          # Tema claro e escuro
│   └── utils/          # Cálculos, recibos, ditado e testes
├── BackEnd/
│   ├── src/            # Domínios, autenticação, assistente e configuração
│   ├── migracoes/      # Alterações incrementais do banco
│   └── scripts/        # Testes, migrações, backup e restauração
├── docs/               # Requisitos, planos, schema e design system
├── scripts/            # Backup e restauração via Docker
├── docker-compose.yml
└── vercel.json         # Frontend e API no mesmo projeto
```

### Decisões que orientam o código

- **Regras de negócio nos serviços:** vendas, clientes, produtos e fiado compartilham lógica entre controllers HTTP e funções do Zé.
- **Autoria pelo token:** quem vendeu é determinado pela sessão autenticada.
- **Histórico preservado:** os itens guardam o nome e o preço praticados no momento da venda; reajustes posteriores não alteram o passado.
- **Cálculos testáveis:** lógica financeira do frontend fica em módulos puros, fora dos componentes.
- **Sessão centralizada:** o access token fica em memória; o cliente HTTP renova a sessão por cookie e repete a requisição uma vez após um 401.

## Executar localmente

### Com Docker Compose

Com Docker e Docker Compose disponíveis, execute na raiz:

```bash
docker compose up --build
```

| Serviço | Endereço local |
|---|---|
| Aplicação | http://localhost:5173 |
| API | http://localhost:3000/api |
| Swagger | http://localhost:3000/api/docs |
| Estado da API e do banco | http://localhost:3000/api/health |
| PostgreSQL | `localhost:5433` |

O Compose cria um **PostgreSQL local independente do Neon**. O schema inicial é aplicado na primeira criação do volume; as migrações rodam ao iniciar a API. Um administrador é criado somente quando ainda não há usuários, usando a configuração `ADMIN_*` do Compose.

Para habilitar o Zé nesse ambiente, configure `OPENROUTER_API_KEY` no `.env` da raiz. O Compose repassa essa variável para a API.

### Sem Docker

Use uma versão atual do **Node.js 22 ou 24**, npm e um PostgreSQL preparado com o [schema inicial](docs/schema.sql). Configure `BackEnd/.env` conforme a tabela abaixo e instale as dependências:

```bash
npm ci --prefix BackEnd
npm ci --include=dev --prefix FrontEnd
```

Inicie cada serviço em um terminal, a partir da raiz:

```bash
# Terminal 1
npm run dev --prefix BackEnd
```

```bash
# Terminal 2
npm run dev --prefix FrontEnd
```

O Vite encaminha `/api` para `http://localhost:3000`. Sem Compose, coloque a chave do assistente também no ambiente do backend: o carregamento padrão de `dotenv` não combina automaticamente os dois arquivos `.env`.

No PowerShell, se a política de execução bloquear `npm.ps1`, use `npm.cmd` nos mesmos comandos.

## Variáveis de ambiente

Os valores reais ficam nos arquivos `.env` locais ou nas variáveis do projeto Vercel. Eles não são versionados.

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL do ambiente escolhido. No Neon, inclui a configuração SSL. |
| `PORT` | Porta da API local; padrão `3000`. |
| `NODE_ENV` | `production` no Vercel, inclusive para o cookie de sessão usar HTTPS. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Segredos de assinatura dos tokens. |
| `ACCESS_TOKEN_TTL` | Duração do access token; padrão `15m`. |
| `REFRESH_TOKEN_TTL_DIAS` | Duração do refresh token; padrão `7`. |
| `ADMIN_NOME` / `ADMIN_EMAIL` / `ADMIN_SENHA` | Administrador inicial, criado apenas se não houver usuários. |
| `OPENROUTER_API_KEY` | Habilita o assistente Zé. |
| `OPENROUTER_MODEL` | Modelo do assistente; padrão no código: `openai/gpt-4o-mini`. |
| `OPENROUTER_TIMEOUT_MS` | Limite de espera por chamada ao modelo; padrão `30000`. |
| `LOJA_NOME` / `LOJA_TELEFONE` / `LOJA_ENDERECO` | Cabeçalho dos recibos. |
| `LOJA_PRAZO_FIADO_DIAS` | Prazo padrão do fiado; padrão `30` dias. |
| `VITE_API_TARGET` | Destino do proxy de desenvolvimento do Vite. |

## Testes e qualidade

As suítes usam scripts Node com asserções próprias. Na verificação de **15/09/2026**, passaram **324 testes independentes de banco**:

| Suíte | Testes |
|---|---:|
| Validação de entradas | 58 |
| Cálculos da venda | 63 |
| Cobrança de fiado | 27 |
| Correção de ditado | 59 |
| Apresentação do histórico | 33 |
| Rascunho de venda | 42 |
| Recibo | 42 |

Execute a partir da raiz:

```bash
node BackEnd/scripts/testar-validar.mjs
node FrontEnd/src/utils/calculoVenda.test.mjs
node FrontEnd/src/utils/cobranca.test.mjs
node FrontEnd/src/utils/corrigirDitado.test.mjs
node FrontEnd/src/utils/historico.test.mjs
node FrontEnd/src/utils/rascunhoVenda.test.mjs
node FrontEnd/src/utils/recibo.test.mjs

npm run lint --prefix FrontEnd
npm run build --prefix FrontEnd
```

Para os serviços de negócio e as funções do Zé, use um banco de desenvolvimento com pelo menos um usuário. A suíte cria e remove registros de teste:

```bash
# Com o ambiente Docker em execução
docker compose exec api npm test

# Ou com BackEnd/.env apontando para um banco de desenvolvimento
npm test --prefix BackEnd
```

Os testes das funções do Zé não dependem de chamadas ao modelo. A escolha de funções pela IA e a interação visual das telas exigem verificação adicional. O lint tinha seis avisos na revisão inicial; os 324 testes não representam cobertura completa da interface.

## Banco, migrações e backup

O [schema](docs/schema.sql) cria a base inicial. As alterações seguintes ficam em [`BackEnd/migracoes/`](BackEnd/migracoes/), com controle de execução no banco. Migrações já aplicadas devem ser preservadas; correções entram em novos arquivos.

Com `BackEnd/.env` apontando para o banco desejado:

```bash
npm run migrar:status --prefix BackEnd
npm run migrar --prefix BackEnd
```

No Neon, use a **conexão direta** para migrar: o controle de concorrência usa um lock de sessão. A API pode usar a conexão com pooler.

Para copiar o banco local do Compose:

```bash
bash scripts/backup-docker.sh
```

Para um banco acessível por `DATABASE_URL`, com `pg_dump` instalado:

```bash
npm run backup --prefix BackEnd
```

Os scripts de restauração estão em [`scripts/`](scripts/) e [`BackEnd/scripts/`](BackEnd/scripts/). A restauração substitui o conteúdo do banco de destino. Backups ficam fora do Git; **o agendamento automático ainda precisa ser configurado**.

Não use `docker compose down -v` para atualizar o schema: esse comando remove o volume de dados.

## Deploy

**Produção:** [prumo-omega.vercel.app](https://prumo-omega.vercel.app)

O [`vercel.json`](vercel.json) publica dois serviços no projeto `prumo`:

| Serviço | Diretório | Publicação |
|---|---|---|
| `web` | `FrontEnd` | Build Vite em `dist`, com fallback para as rotas do React. |
| `api` | `BackEnd` | Aplicação Express exportada por `src/app.js`, atendendo `/api/*`. |

Frontend e API usam o mesmo domínio. O PostgreSQL está no Neon, e as variáveis estão configuradas no ambiente de produção do Vercel. O projeto está conectado ao GitHub, com **deploy automático dos pushes na `main`**.

**Migrações em produção são uma etapa separada.** A entrada do Vercel é `app.js`, enquanto o boot local/Docker usa `server.js`. Aplique mudanças de banco antes de publicar código que dependa delas; o deploy da função não executa o boot local nem cria o administrador.

Após a publicação inicial, foram verificados conexão com o banco, login, renovação de sessão, logout, consultas autenticadas e resposta HTTP das rotas do frontend. A validação visual e a conversa real com o Zé em produção permanecem pendentes.

Mais detalhes no [guia de publicação](docs/Prumo-Colocar-No-Ar.md).

## Identidade visual

O **fio de prumo** é o elemento central da marca. A interface prioriza leitura rápida, alvos de toque amplos e ações claras para quem está atendendo no balcão.

| Token | Cor | Uso |
|---|---|---|
| Vermelho prumo | `#C42E1E` | Marca e alertas |
| Trena | `#FFC400` | Ação primária e destaque |
| Nível | `#1B7A46` | Estados positivos |
| Grafite | `#16191D` | Referência de texto e contraste |
| Concreto | `#E6E9EB` | Referência de fundo |

**Tipografia:** Archivo e Archivo Black. Os tons neutros usam variáveis CSS para acompanhar os temas claro e escuro. Veja o [design system](docs/prumo-design-system.html).

## Escopo e próximos passos

**Entregue:** vendas, cadastros, indicadores, fiado, recibos, permissões, auditoria, rascunhos, assistente e publicação inicial.

**Evolução prevista:** estoque e previsão de demanda, dependentes de inventário, disciplina operacional e histórico de vendas. Curva ABC e alerta de cliente sem compras aparecem nos requisitos originais, mas não fazem parte das entregas listadas neste README.

**Operação a completar:** agendamento de backups, validação visual em produção e verificação da conversa do assistente no ambiente publicado.

**Fora do escopo atual:** emissão de nota fiscal, financeiro completo, entregas/frete e integração com balança ou PDV.

## Documentação

| Documento | Conteúdo |
|---|---|
| [Requisitos](docs/Prumo-Requisitos-v0.1.md) | Contexto do negócio, requisitos originais e fases previstas. |
| [Modelo de dados](docs/Prumo-Modelo-de-Dados-v0.1.md) | Entidades e relações do domínio. |
| [Schema inicial](docs/schema.sql) | SQL para criar a base antes das migrações. |
| [Design system](docs/prumo-design-system.html) | Marca, cores, tipografia e componentes. |
| [Plano do assistente](docs/Prumo-Assistente-IA-Plano.md) | Arquitetura e evolução do Zé. |
| [Contrato das funções de escrita](docs/Prumo-Ze-Contrato-Tools-Escrita.md) | Operações, permissões e confirmação. |
| [Plano de ditado](docs/Prumo-Ditado-Plano.md) | Transcrição por voz e correção com vocabulário. |
| [Histórico de entregas e lacunas](docs/Prumo-O-Que-Falta.md) | Registro das melhorias e verificações realizadas. |
| [Guia de publicação](docs/Prumo-Colocar-No-Ar.md) | Vercel, Neon, variáveis, migrações e operação. |
| [Convenções do projeto](CLAUDE.md) | Regras de implementação e organização do código. |

Os planos registram decisões de diferentes momentos do projeto. Para o comportamento atual, consulte o código e as migrações junto com este README.

---

**Prumo — construído para o balcão, no ritmo do balcão.**
