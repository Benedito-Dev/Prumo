# Prumo — gestão para depósito de material de construção

Node/Express + PostgreSQL (`BackEnd/`) · React 19 + Vite + Tailwind v4 (`FrontEnd/`) · assistente de IA "Zé" via OpenRouter.

**A meta que define o produto: lançar uma venda simples em menos de 30 segundos.** Se o sistema for mais lento que o caderno de papel, ele é abandonado. Toda decisão de UX se subordina a isso. O usuário real não tem familiaridade com sistemas.

Detalhes de requisitos em `docs/Prumo-Requisitos-v0.1.md` (os códigos RFxx no código apontam para lá).

## Idioma — regra dura

**Todo o projeto é em português do Brasil.** Código, identificadores, comentários, mensagens de erro, commits, documentação. `criarVenda`, não `createSale`; `ErroNegocio`, não `BusinessError`; colunas `valor_total`, `vendida_em`.

Commits: `tipo(escopo): descrição em minúsculas`, sem acentos no assunto (`feat(ze): o Ze lanca venda`). Escreva sempre em português — mesmo que o pedido chegue em inglês.

## Subir o ambiente

```bash
docker compose up            # db (5433) + api (3000) + web (5173)
```

O schema (`docs/schema.sql`) roda sozinho na **primeira** inicialização do volume. Depois disso, **toda mudança de schema entra como migração** (`BackEnd/migracoes/NNN-descricao.sql`), aplicada no boot da API. Nunca mais `docker compose down -v` para alterar tabela — isso apagaria o banco.

```bash
npm run migrar:status --prefix BackEnd   # o que já foi aplicado
npm run migrar --prefix BackEnd          # aplica o pendente (a API já faz no boot)
bash scripts/backup-docker.sh            # backup do banco local
bash scripts/restaurar-docker.sh <arq> --sim
```

Regras: **migração aplicada nunca é editada** (bancos divergiriam em silêncio — corrija com uma migração nova), e `docs/schema.sql` continua sendo o retrato para quem cria banco do zero, então mantenha os dois em dia.

O admin inicial é criado no boot **só se não houver nenhum usuário** (`ADMIN_EMAIL`/`ADMIN_SENHA`).

Sem Docker: `cd BackEnd && npm run dev` e `cd FrontEnd && npm run dev` (o Vite faz proxy de `/api`).

- Porta do Postgres no host é **5433**, não 5432 (5432 já está em uso por outro projeto). Dentro do compose o host é `db:5432`.
- `OPENROUTER_API_KEY` mora no `.env` da **raiz** (fora do Git), não no `BackEnd/.env`. Sem ela, `/api/assistente` responde 503 e **o resto da API funciona normal** — mantenha essa degradação.

## Verificar o trabalho

```bash
cd BackEnd && npm test                              # suíte de services e tools do Zé (precisa do banco de pé)
docker exec prumo-api node scripts/testar-tools.mjs # a mesma suíte, dentro do container
node FrontEnd/src/utils/corrigirDitado.test.mjs     # 59 testes do corretor de ditado (Node puro)
node FrontEnd/src/utils/recibo.test.mjs             # 42 testes do recibo (Node puro)
node FrontEnd/src/utils/calculoVenda.test.mjs       # 63 testes das contas da venda (Node puro)
node FrontEnd/src/utils/cobranca.test.mjs           # 27 testes da cobrança de fiado (Node puro)
cd FrontEnd && npm run lint                         # oxlint
```

Não há framework de teste, watcher nem CI: são scripts `.mjs` com asserts próprios. Ao mexer em service, tool ou em qualquer módulo de `FrontEnd/src/utils/`, **rode a suíte correspondente e mostre a saída**.

**Lógica que envolve dinheiro sai da tela e vira módulo puro em `utils/`, com suíte própria.** É o que permite testá-la sem navegador. Foi assim com o ditado, o recibo, as contas da venda e a cobrança — se a próxima feature calcular valor, siga o mesmo caminho em vez de somar dentro do componente. `npm test` no BackEnd falha sem banco de pé e sem nenhum usuário cadastrado (as FKs de autoria exigem um usuário real).

## Arquitetura — as regras que não se quebram

**Camadas:** `rota → controller → service → banco`. O controller é casca HTTP fina; **a regra de negócio mora no service**. O service não sabe o que é HTTP: ele lança `ErroNegocio` (`src/config/erros.js`) e quem chamou traduz. Isso existe porque as tools do Zé reusam os mesmos services que as rotas REST — nunca duplique SQL entre os dois, e nunca coloque `res.status()` dentro de um service.

**Um service nunca recebe nome, só id já resolvido.** Traduzir "cimento" num produto é trabalho de quem chama (as tools, via `assistente/resolver.js`).

**O histórico é imutável.** `item_venda` congela `produto_nome` e `preco_unitario` no momento da venda; renomear ou reajustar o produto depois não reescreve venda antiga. Cancelar venda é *soft delete* (`status='cancelada'`), e "apagar" produto é **desativar** (`ativo=false`). Nunca troque isso por `DELETE`.

**Dinheiro:** `NUMERIC(12,2)` no banco chega como **string** no driver `pg`. Converta na borda (`Number(...)`) ou `"315" + "425"` vira `"315425"`. Todo valor passa por `emReais()` (`Number(n.toFixed(2))`) antes de gravar. Comparações de saldo usam a tolerância de `0.009`.

**Quem vendeu sai do token (`req.usuario.id`), nunca do corpo da requisição.** Aceitar `usuario_id` do cliente permitiria lançar venda no nome de outro vendedor e fazer o indicador de desempenho mentir.

**Papéis: só `dono` e `vendedor`.** O `dono` administra usuários (`requireDono`); o `vendedor` opera o balcão. Não reintroduza `caixa`/`estoque` — foram removidos por não diferenciarem nada. Atenção: hoje a restrição por papel nos indicadores existe **só nas tools do Zé**; as rotas `/api/painel/*` estão abertas a qualquer autenticado.

**Rotas com segmento fixo vêm antes das paramétricas** no Express (`/estatisticas` antes de `/:id`, `/me/senha` antes de `/:id/senha`).

## O Zé (assistente de IA) — leia antes de tocar em `src/assistente/`

O módulo mais delicado do projeto. As invariantes:

1. **O modelo nunca escreve SQL.** Ele escolhe o nome de uma função do catálogo (`tools.js`) e os argumentos. Nome fora do catálogo é rejeitado, nunca "tenta assim mesmo".
2. **O catálogo enviado ao modelo já vai filtrado por papel** — ele nem sabe que as outras tools existem. A permissão é revalidada na execução, inclusive na confirmação.
3. **Ações destrutivas usam confirmação em dois passos com token HMAC assinado pelo servidor** (`confirmacao.js`). Se a ação pendente fosse um JSON que vai ao front e volta, qualquer um com o DevTools aberto mandaria `cancelar_venda` de qualquer id. O token viaja opaco, expira em 5 min e é amarrado ao `usuario_id`. **Texto digitado ("sim") não autoriza nada** — só o token.
4. **Ambiguidade não se resolve por chute.** Achou mais de um "Marcos"? A tool devolve `precisa_escolher` e não grava nada. Gravar no registro errado passa despercebido; a pergunta a mais, não.
5. **Todo número na resposta veio de uma função.** O modelo redige, não calcula.

Regra de trabalho: `tools.js` (leitura) é o ponto de encontro; **as tools de escrita moram em um arquivo por domínio** (`tools.produto.js`, `tools.cliente.js`, `tools.fiado.js`, `tools.venda.js`) e entram por spread. Nova tool de escrita = arquivo novo, não linha nova num arquivo compartilhado.

O prompt do sistema (`assistente.service.js`) é **especificação de produto, não texto solto**: cada parágrafo dele existe porque o modelo errou de um jeito específico. Ao mexer, preserve a intenção e teste o comportamento.

Para o desenho completo, ver `docs/Prumo-Assistente-IA-Plano.md` e `docs/Prumo-Ze-Contrato-Tools-Escrita.md`.

## Frontend

- **Tailwind v4** (`@theme` no `index.css`, sem `tailwind.config.js`). Cores neutras são variáveis CSS que trocam no tema; marca (`prumo`, `trena`, `nivel`) é fixa. Dark mode = classe `.dark` no `<html>`.
- Use os tokens do design system (`bg-superficie`, `text-grafite-medio`, `border-linha`) — **nunca** `bg-white`/`text-gray-500`, que quebram no tema escuro.
- Componentes do design system em `src/components/`, importados pelo barril (`import { Botao, Campo } from '../components'`).
- **O access token vive só em memória** (`services/api.js`), nunca em `localStorage`. O refresh é cookie httpOnly, rotacionado a cada uso. Em 401 o `api.js` renova uma vez e repete a requisição sozinho — não trate 401 nas telas.
- Toda chamada à API passa pelos services de `src/services/`, nunca `fetch` direto na página.
- Responsivo sem breakpoint sempre que der (grid `auto-fit`, tabela que vira cartão). Alvos de toque de 56–64px: a mão que usa o Prumo está segurando outra coisa.

## Ao escrever código aqui

O código deste projeto **explica o porquê, não o quê**. Os comentários registram a decisão e o que ela evita ("ROLLBACK protegido: se ele falhar, o erro original é o que interessa"), não parafraseiam a linha seguinte. Siga esse padrão: ao adicionar uma regra não óbvia, escreva por que ela existe.

Mensagens de erro são lidas por quem não é técnico. Detalhe de SQL não vaza para a tela nem para o modelo.

Antes de criar um helper, procure o existente: `config/erros.js`, `assistente/tools.escrita.comum.js`, `utils/formato.js`, `painel/periodo.js`.

## Fora de escopo (decisão, não esquecimento)

Nota fiscal · financeiro completo · entrega/frete · integração com balança ou PDV · estoque e previsão de demanda (fases futuras, ainda não implementadas). Não construa nada disso sem pedido explícito.
