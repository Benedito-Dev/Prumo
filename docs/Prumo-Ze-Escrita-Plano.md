<div align="center">

# ✍️ ZÉ COM MÃO — PLANO DE ESCRITA

### *Do assistente que responde ao assistente que faz.*

**Tools de escrita para o Zé · criar, editar, desativar, vender e receber**

<br>

![Status](https://img.shields.io/badge/status-planejado-C42E1E?style=for-the-badge)
![Camada](https://img.shields.io/badge/back-a_fazer-FFC400?style=for-the-badge&labelColor=16191D)
![Camada](https://img.shields.io/badge/front-a_fazer-FFC400?style=for-the-badge&labelColor=16191D)

<br>

`📄 Documento vivo` · `📅 Criado em 09/08/2026` · `🔗 Sucessor de Prumo-Assistente-IA-Plano.md`

</div>

---

## 📋 Sumário

- [🎯 Sumário executivo](#-sumário-executivo)
- [🧪 Avaliação crítica das decisões tomadas](#-avaliação-crítica-das-decisões-tomadas)
- [🔎 O que o código diz hoje](#-o-que-o-código-diz-hoje)
- [🏛️ Arquitetura proposta](#️-arquitetura-proposta)
- [🔁 Fluxo de uma escrita direta](#-fluxo-de-uma-escrita-direta)
- [🛑 Fluxo de uma confirmação em dois passos](#-fluxo-de-uma-confirmação-em-dois-passos)
- [🧭 Resolução de ambiguidade](#-resolução-de-ambiguidade)
- [🔧 Catálogo completo de tools](#-catálogo-completo-de-tools)
- [🔐 Permissões por papel](#-permissões-por-papel)
- [📜 Contrato da API](#-contrato-da-api)
- [🗂️ Mudanças arquivo por arquivo](#️-mudanças-arquivo-por-arquivo)
- [🪜 Fatias verticais e ordem](#-fatias-verticais-e-ordem)
- [🐛 Bugs e dívidas pré-existentes](#-bugs-e-dívidas-pré-existentes)
- [⚠️ Riscos concretos](#️-riscos-concretos)
- [🚫 Fora de escopo](#-fora-de-escopo)
- [✅ Como saber que funcionou](#-como-saber-que-funcionou)

---

## 🎯 Sumário executivo

**O que é.** Dar ao Zé 12 tools de escrita, hoje inexistentes — o catálogo em `BackEnd/src/assistente/tools.js` tem 7 entradas e **todas são SELECT** (o próprio arquivo declara isso na linha 7: *"Todas são SOMENTE LEITURA"*). Passa a ser possível dizer *"cadastra cimento CP-II a 42 reais o saco"*, *"o Marcos pagou 200 do fiado"* ou *"vende 10 sacos de cimento pro João no fiado"* e ver acontecer.

**Quanto custa.** **20 a 27 horas** de trabalho, em 7 fatias verticais entregáveis. A maior parte não é a IA: é a **extração da lógica de negócio dos controllers**, que hoje é impossível de reusar (detalhe em [Arquitetura proposta](#️-arquitetura-proposta)).

**Os três riscos principais.**

| | Risco | Gravidade |
|:---:|---|:---:|
| 💣 | **`criar_venda` sem confirmação prévia grava dinheiro no banco a partir de uma interpretação de linguagem natural.** Uma venda errada só se desfaz cancelando — e cancelamento é auditável, ou seja, o erro fica registrado para sempre | 🔴 Alta |
| 🎭 | **Confirmação forjável pelo front.** Se o token de confirmação for só um JSON que volta, qualquer um com o access token executa a operação que quiser sem a IA ter proposto nada | 🔴 Alta |
| 🗑️ | **`DELETE` real em cliente/produto destrói dados que o histórico ainda precisa** — e o esquema deixa isso passar em alguns casos | 🟡 Média |

**A recomendação de uma linha:** implementar tudo, **exceto** que `criar_venda` também confirma. O argumento está na próxima seção.

---

## 🧪 Avaliação crítica das decisões tomadas

Você pediu para eu contestar em vez de concordar. Aqui vai, com o código na mão.

### ✅ Decisão 1 — Confirmação só para destrutivo: **concordo em parte**

Concordo integralmente para **produtos e clientes**. Criar um produto errado custa dez segundos para corrigir; exigir confirmação em toda criação transformaria o chat em formulário com passo extra — exatamente o atrito que o produto existe para eliminar. O README posiciona o público como *"quem não tem familiaridade com sistemas"*, e a meta de 30 segundos da Nova Venda mostra que atrito é inimigo declarado do projeto.

**Discordo para `criar_venda`.** Três evidências:

1. **É irreversível na prática.** `venda.controller.js:183-208` implementa cancelamento como *soft delete*: `status = 'cancelada', cancelada_em = NOW()`. A venda errada **não some** — ela fica no banco marcada como cancelada. O `docs/Prumo-Modelo-de-Dados-v0.1.md:21` eleva isso a princípio (P6, *"Nada é apagado de verdade"*). Uma venda criada por engano é uma cicatriz permanente no histórico, não um `undo`.

2. **É a única escrita multi-entidade.** Todas as outras tools mexem em uma linha de uma tabela. `criar_venda` resolve **N produtos por nome + 1 cliente por nome + forma de pagamento + desconto**, e grava em `venda` + `item_venda` numa transação (`venda.controller.js:102-164`). São N+1 oportunidades de o modelo escolher o registro errado, e cada uma delas é silenciosa: se ele pegar "Cimento CP-III" em vez de "Cimento CP-II", a venda é gravada com preço diferente e ninguém percebe.

3. **Se for fiado, contamina o módulo de fiados.** Uma venda fiado errada aparece imediatamente em `/fiados` (a query de `fiado.controller.js:9-27` pega toda venda `concluida` + `fiado` com saldo > 0) e vira uma cobrança fantasma para um cliente real.

> 🔧 **Contraproposta concreta:** `criar_venda` **confirma**, mas com um formato que não parece burocracia. A confirmação não é *"Tem certeza? [Sim/Não]"* — é a **nota da venda montada**, que a pessoa lê como leria um papel no balcão:
>
> ```
> Vou lançar esta venda:
>
>   10 saco  Cimento CP-II 50kg   R$ 42,00   R$ 420,00
>    2 barra Vergalhão 3/8"       R$ 38,50   R$  77,00
>   ───────────────────────────────────────────────────
>   Cliente: João Silva · Fiado · Total R$ 497,00
>
> Confirma?
> ```
>
> Isso não é atrito: é **a mesma leitura de conferência** que a Decisão 2 já quer para criar/editar — só que ANTES de gravar, porque aqui gravar é caro. Custa um toque a mais e elimina o pior risco do plano inteiro. **Se você discordar, o desenho abaixo suporta as duas opções trocando um campo `confirma: true/false` no catálogo** — a implementação não muda.

### ✅ Decisão 2 — "Registro" pós-execução com campos não mencionados: **concordo, e é a melhor ideia do pedido**

Não tenho ressalva. É superior a confirmação prévia para operações baratas, por um motivo que vale registrar: **confirmação prévia mostra o que a IA entendeu; registro pós-execução mostra o que o banco tem.** São coisas diferentes. Um `INSERT` pode aplicar defaults, truncar (`VARCHAR(120)` em `produto.nome`, schema linha 63), ou normalizar. O registro captura tudo isso.

Uma exigência de implementação, senão a ideia se perde: **o registro não pode ser redigido pelo modelo a partir dos argumentos que ele mandou.** Ele tem que vir do `RETURNING *` do banco. Os controllers já fazem isso certo — `produto.controller.js:76` e `cliente.controller.js:94` retornam `RETURNING *`. As tools devolvem esse objeto e o system prompt manda o modelo **transcrever, não resumir**.

Detalhe de edição: `atualizarProduto` (`produto.controller.js:100-107`) e `atualizarCliente` (`cliente.controller.js:117-123`) são **PUT de substituição total** — enviam todos os campos, e o que não vier vira `NULL` (note o `?? null` em `produto.controller.js:106`). Uma tool de edição por IA precisa ser **PATCH semântico**: ler o registro atual, aplicar só os campos citados, gravar. Sem isso, *"muda o preço do cimento para 45"* apaga a categoria, o preço de custo e a imagem do produto. Isso não é opcional — é o bug número 1 de uma implementação ingênua.

### ⚖️ Decisão 3 (em aberto) — Delete real vs. desativação: **recomendo desativação, com uma ressalva desconfortável**

**Produto:** a resposta é fácil. Já existe `ativo BOOLEAN NOT NULL DEFAULT TRUE` (schema linha 69), o `removerProduto` já falha com `23503` quando o produto tem vendas e a própria mensagem de erro em `produto.controller.js:136` diz: *"Desative-o (ativo=false) em vez de excluir"*. A tool do Zé **nunca faz DELETE de produto** — sempre `UPDATE produto SET ativo = FALSE`. Bônus: `criarVenda` já filtra `ativo = TRUE` (`venda.controller.js:126`), então desativar remove o produto do fluxo de venda imediatamente, que é o efeito que o usuário quer.

**Cliente:** aqui está o problema. **A tabela `cliente` não tem coluna `ativo`** (schema linhas 32-40 — só `id, nome, telefone, tipo, observacao, criado_em`). Então há três caminhos, e nenhum é gratuito:

| Caminho | Custo | Consequência |
|---|---|---|
| **A. Migração: adicionar `ativo` em `cliente`** | ~1h30 (schema + migração + filtro nas telas de cliente + `cliente.controller.js`) | Coerente com o princípio P6. Toca código fora do escopo da IA |
| **B. Não expor "deletar cliente" ao Zé** | 0h | Honesto: *"para apagar um cliente, use a tela de Clientes"*. O Zé fica com 11 tools em vez de 12 |
| **C. DELETE real, deixando a FK barrar** | ~15min | Cliente **sem** vendas some de verdade; cliente **com** vendas dá erro `23503` (`cliente.controller.js:146-150`). Comportamento inconsistente e imprevisível para o usuário: "às vezes apaga, às vezes não" |

> 📌 **Minha recomendação: caminho B para a primeira entrega, caminho A depois** — como um trabalho próprio, fora deste plano. Motivo: o caminho C entrega ao usuário leigo um comando cujo resultado ele não consegue prever, e o caminho A infla este plano com uma migração de schema que nada tem a ver com IA. E há um argumento de produto: **num depósito, cliente não se apaga.** O sujeito some por dois anos e volta. Cliente duplicado se resolve fundindo, não deletando — e fundir não está no escopo de ninguém hoje.
>
> Se você quiser cliente deletável já na v1, escolha **A** e some ~1h30 à estimativa. **Não escolha C.**

**Venda:** já é soft delete e está correto (`venda.controller.js:188-191`). Nada muda.

### ⚖️ Decisão 4 (em aberto) — Ambiguidade em `criar_venda`

Ver a seção [🧭 Resolução de ambiguidade](#-resolução-de-ambiguidade). Resumo: **ambiguidade não é erro, é uma pergunta.** A tool não escolhe e não falha — ela devolve as opções numeradas e o modelo pergunta. Isso funciona com ou sem confirmação em dois passos.

---

## 🔎 O que o código diz hoje

Antes da arquitetura, os fatos que a determinam.

### Fato 1 — Os controllers **não são reusáveis**. Nenhum deles.

Todos os 5 controllers de domínio têm a mesma assinatura `(req, res)` e — o que é pior — **misturam validação, SQL e resposta HTTP no mesmo bloco, com `return res.status(...)` no meio da transação**:

```js
// venda.controller.js:129-132 — dentro do laço de itens, no meio do BEGIN
if (prod.rowCount === 0) {
  await client.query('ROLLBACK');
  return res.status(400).json({ erro: `Produto ${item.produto_id} não existe ou está inativo` });
}
```

Não há como uma tool chamar `criarVenda(req, res)`. As saídas possíveis:

| Opção | Veredito |
|---|---|
| Chamar o controller com `req`/`res` falsos (*mock*) | ❌ Frágil e feio. Um `res` falso teria que interceptar `status().json()` e reconstruir semântica de erro a partir de código HTTP. E `criarVenda` tem **7 pontos de saída** diferentes |
| O backend fazer `fetch` em si mesmo (`http://localhost:3000/api/vendas`) | ❌ Já vetado pelo plano anterior (`Prumo-Assistente-IA-Plano.md:143`): duplica latência e autenticação sem ganho |
| Duplicar o SQL dentro de `tools.js` | ⚠️ Barato agora, caro depois. Duas cópias das regras (desconto > total, produto inativo, saldo do fiado) divergem em três meses. Já são ~180 linhas de regra em `criarVenda` |
| **Extrair a lógica para `*.service.js` e o controller vira casca** | ✅ **Recomendado** |

**A extração é o núcleo do trabalho deste plano — não a IA.** E ela tem um retorno que sobrevive à feature: os controllers ficam testáveis pela primeira vez (hoje não há **nenhum** teste no backend — `package.json` não tem sequer script `test`).

### Fato 2 — O contrato atual não tem onde pendurar uma ação pendente

`assistente.service.js:66` retorna exatamente `{ resposta, fontes }`; `assistente.controller.js:31` faz `res.json(r)`; `FrontEnd/src/services/assistente.js:10` documenta esse contrato; `Assistente.jsx:50` consome só `r.resposta` e `r.fontes`. **Nada precisa quebrar** — a proposta é aditiva (um campo `acao_pendente` opcional). Front antigo com back novo continua funcionando (ignora o campo).

### Fato 3 — O loop é *stateless* e o histórico vem do cliente

`assistente.service.js:55-63` reconstrói o contexto a partir do `historico` que **o front envia**. Não há sessão, não há armazenamento server-side de conversa. Isso é bom (simples, escala) e é **exatamente por isso que a confirmação precisa de assinatura criptográfica** — não há estado do servidor para consultar e verificar se a IA realmente propôs aquela ação. Ver [Fluxo de confirmação](#-fluxo-de-uma-confirmação-em-dois-passos).

### Fato 4 — O papel já está no token e já filtra tools

`requireAuth.js:15` popula `req.usuario = { id, papel, nome }` a partir do JWT; `tools.js:354-358` filtra o catálogo por papel **antes** de enviar ao modelo, e `tools.js:375` revalida na execução. **A estrutura de permissão que a escrita precisa já existe** — só faltam as entradas.

### Fato 5 — `usuario_id` não vem do corpo, vem do token

`criarVenda` exige `usuario_id` **no body** (`venda.controller.js:83-85`), o que é uma falha de segurança latente do endpoint HTTP (qualquer vendedor pode lançar venda em nome de outro). Nas tools do Zé isso **não** se repete: o `usuario_id` vem sempre de `usuario.id`, que o `executar(args, usuario)` já recebe (`tools.js:381`). O modelo nunca escolhe quem vendeu. `fiado.controller.js:131` já faz o certo (`req.usuario?.id`).

---

## 🏛️ Arquitetura proposta

Três camadas novas, encaixadas no que já existe.

```
                    ┌─────────────────────────────┐
                    │   Assistente.jsx (front)    │
                    │   + balão de confirmação    │
                    └──────────┬──────────────────┘
                               │ POST /assistente/perguntar
                               │ { pergunta, historico, confirmacao? }
                               ▼
                    ┌─────────────────────────────┐
                    │  assistente.controller.js   │
                    │  valida · injeta req.usuario│
                    └──────────┬──────────────────┘
                               ▼
                    ┌─────────────────────────────┐
     ┌──────────────│   assistente.service.js     │
     │              │   loop + desvio de confirm. │
     │              └──────────┬──────────────────┘
     │                         │
     ▼                         ▼
┌──────────────┐   ┌──────────────────────────────┐
│ confirmacao  │◄──│  tools.js  (catálogo)        │
│ .js          │   │  leitura (7) + escrita (12)  │
│ HMAC assina  │   └──────────┬───────────────────┘
│ e verifica   │              │
└──────────────┘              ▼
                    ┌──────────────────────────────┐
                    │  🆕 CAMADA DE SERVIÇO         │
                    │  produto.service.js          │
                    │  cliente.service.js          │
                    │  venda.service.js            │
                    │  fiado.service.js            │
                    │  ─ funções puras ─           │
                    │  entram objetos, saem objetos│
                    │  erros = throw ErroNegocio   │
                    └──────────┬───────────────────┘
                               ▼
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   ┌──────────────────────┐        ┌──────────────────────┐
   │  query()/pool → PG   │        │ *.controller.js      │
   └──────────────────────┘        │ (vira casca fina:    │
                                   │  req → service →     │
                                   │  res, e traduz erro) │
                                   └──────────────────────┘
```

### A peça central: `ErroNegocio`

Para o service devolver "produto inativo" sem saber o que é HTTP, um erro tipado — arquivo novo `BackEnd/src/config/erros.js`:

```js
// Erro previsível de regra de negócio. Carrega o status HTTP que o
// controller vai usar e uma mensagem já em português, legível ao usuário.
export class ErroNegocio extends Error {
  constructor(mensagem, status = 400, codigo = null) {
    super(mensagem);
    this.name = 'ErroNegocio';
    this.status = status;   // o controller devolve isso
    this.codigo = codigo;   // ex: 'PRODUTO_INATIVO' — a tool pode ramificar
  }
}
```

- **O controller** captura: `if (e instanceof ErroNegocio) return res.status(e.status).json({ erro: e.message })`.
- **A tool** captura e devolve `{ erro: e.message }` ao modelo — que já sabe lidar com isso (`assistente.service.js:110` faz exatamente isso hoje).

Um tipo de erro, dois consumidores, zero duplicação de mensagem.

### Assinaturas exatas dos services (o que entra, o que sai)

> 📌 Todas retornam a linha do banco (`RETURNING *`) e lançam `ErroNegocio` em falha previsível. Nenhuma conhece `req`, `res` ou HTTP.

| Arquivo novo | Função | Entrada | Saída |
|---|---|---|---|
| `produto.service.js` | `criarProduto(dados)` | `{ nome, unidade, preco_venda, preco_custo?, categoria_id?, imagem_url? }` | linha de `produto` |
| | `atualizarProduto(id, dados)` | id + **campos parciais** (faz merge com o atual) | `{ antes, depois }` |
| | `desativarProduto(id)` | `id` | linha atualizada |
| | `buscarProdutosPorNome(termo, { apenasAtivos })` | string | array de `{ id, nome, unidade, preco_venda, ativo }` |
| `cliente.service.js` | `criarCliente(dados)` | `{ nome, telefone, tipo?, observacao? }` | linha de `cliente` |
| | `atualizarCliente(id, dados)` | id + campos parciais | `{ antes, depois }` |
| | `buscarClientesPorNome(termo)` | string | array de `{ id, nome, telefone, tipo }` |
| `venda.service.js` | `criarVenda(dados)` | `{ cliente_id?, usuario_id, forma_pagamento, desconto?, itens[] }` | venda + itens |
| | `cancelarVenda(id)` | `id` | `{ id, status, cancelada_em }` |
| | `buscarVendasRecentes(filtros)` | `{ cliente_id?, limite }` | array para desambiguar "aquela venda" |
| `fiado.service.js` | `registrarPagamento({ venda_id, valor, usuario_id })` | — | `{ pago, saldo, quitado }` |
| | `fiadosDoCliente(cliente_id)` | uuid | vendas fiado em aberto do cliente |

---

## 🔁 Fluxo de uma escrita direta

Caso: *"cadastra cimento CP-II saco a 42 reais"* — sem confirmação.

```
 1. Front  POST /assistente/perguntar { pergunta, historico }
 2. Service monta prompt + catálogo filtrado por papel (dono)
 3. Modelo → tool_call: criar_produto({ nome: "Cimento CP-II",
                                        unidade: "saco",
                                        preco_venda: 42 })
 4. executarTool valida:
       ├─ nome existe no catálogo?              → sim
       ├─ papel permite?                        → sim (dono)
       └─ tool.confirma?                        → NÃO → executa direto
 5. tools.js chama produto.service.criarProduto(args)
       └─ INSERT ... RETURNING *
 6. tool devolve ao modelo o REGISTRO COMPLETO:
       { ok: true, acao: "produto_criado",
         registro: { id, nome: "Cimento CP-II", unidade: "saco",
                     preco_venda: "42.00", preco_custo: null,
                     categoria_id: null, ativo: true } }
 7. Modelo redige, seguindo a regra do prompt de transcrever tudo:

       "Pronto, cadastrei:

          Cimento CP-II
          saco · R$ 42,00
          sem categoria · sem preço de custo · ativo

        Se algo estiver errado, é só me falar."

 8. Resposta ao front: { resposta, fontes: [{rotulo:'Produtos', para:'/produtos'}] }
```

**Ponto crítico do passo 7:** o system prompt precisa de uma regra explícita mandando **listar os campos que ficaram vazios**, senão o modelo omite o que não é interessante — e é exatamente o campo omitido que a pessoa precisa ver para perceber o erro. Texto sugerido na seção de arquivos.

---

## 🛑 Fluxo de uma confirmação em dois passos

Caso: *"apaga o produto areia média"*.

### O problema de segurança, dito sem rodeio

Se a resposta for `{ acao_pendente: { tool: "desativar_produto", args: { id: "..." } } }` e o front devolver esse objeto para execução, então **o front decide o que executa**. Qualquer pessoa com um access token válido (ou o próprio DevTools do navegador) manda `{ confirmacao: { tool: "cancelar_venda", args: { id: <qualquer venda> } } }` e o backend obedece — sem a IA ter proposto nada, sem ninguém ter visto nada.

Isso não é um risco teórico: `api.js:77` expõe `api.post` e o payload é montado no cliente. **A ação pendente é entrada não confiável.**

### A solução: token HMAC, sem estado no servidor

Arquivo novo `BackEnd/src/assistente/confirmacao.js`:

```js
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

const VALIDADE_MS = 5 * 60 * 1000;   // 5 min — tempo de balcão, não de sessão
const SEGREDO = () => process.env.JWT_ACCESS_SECRET;  // reusa o segredo já existente

// Assina uma ação proposta. O token viaja pelo front e volta intacto.
export function assinarAcao({ tool, args, usuarioId }) {
  const corpo = {
    jti: randomUUID(),          // identifica a proposta
    tool, args,
    usuario_id: usuarioId,      // AMARRA ao usuário que pediu
    expira_em: Date.now() + VALIDADE_MS,
  };
  const dados = Buffer.from(JSON.stringify(corpo)).toString('base64url');
  const assinatura = createHmac('sha256', SEGREDO()).update(dados).digest('base64url');
  return `${dados}.${assinatura}`;
}

// Verifica e devolve a ação. Lança se adulterado, expirado ou de outro usuário.
export function verificarAcao(token, usuarioId) { /* ... */ }
```

**As quatro proteções, e o que cada uma barra:**

| Proteção | Barra |
|---|---|
| 🔏 **HMAC com `JWT_ACCESS_SECRET`** | Front forjar uma ação que a IA não propôs — impossível sem o segredo do servidor |
| 👤 **`usuario_id` embutido, comparado com `req.usuario.id`** | Vendedor pegar o token de confirmação do dono e reusar |
| ⏱️ **`expira_em` de 5 minutos** | Token velho reaproveitado horas depois, quando o contexto já mudou |
| ⚖️ **Papel revalidado na execução** (`tools.js:375` já faz) | Papel rebaixado entre a proposta e a confirmação |

> 💡 **Por que HMAC e não uma tabela `acao_pendente` no banco?** Uma tabela dá revogação e uso-único, mas custa migração de schema, `DELETE` de expirados e um round-trip a mais. O sistema **não tem estado de sessão em lugar nenhum** (`assistente.service.js:55` reconstrói tudo do histórico do cliente); introduzir a primeira tabela de estado efêmero por causa disso é desproporcional. **A janela de 5 minutos + amarração ao usuário cobre o cenário real** (o próprio operador confirmando algo no balcão). Se um dia houver auditoria formal, a tabela entra — e o token vira a chave dela.
>
> ⚠️ **Consequência aceita:** o token é **reutilizável dentro dos 5 minutos**. Confirmar duas vezes desativa duas vezes o mesmo produto — idempotente, sem dano. Para `cancelar_venda`, `venda.controller.js:195-202` já trata: a segunda tentativa devolve *"Venda já está cancelada"*. **Ambas as operações destrutivas são naturalmente idempotentes**, então o risco fica em zero. Isso é uma feliz coincidência, não um projeto — se uma tool destrutiva não-idempotente aparecer, a tabela passa a ser obrigatória.

### O fluxo

```
 ── PASSO 1 ─────────────────────────────────────────────────
 1. "apaga o produto areia média"
 2. Modelo → desativar_produto({ busca: "areia média" })
 3. executarTool vê tool.confirma === true:
       ├─ chama tool.preparar(args, usuario)
       │     └─ resolve "areia média" → 1 produto (id, nome, vendas: 34)
       ├─ NÃO EXECUTA NADA
       └─ devolve ao modelo:
             { precisa_confirmar: true,
               resumo: "Desativar 'Areia média' (saco, R$ 95,00).
                        Tem 34 vendas no histórico — elas continuam
                        intactas; o produto some da tela de venda.",
               token: "eyJ0b29s...abc.9f2c1e" }
 4. Modelo redige a pergunta e o service ANEXA a ação à resposta:
       { resposta: "Quer mesmo desativar a Areia média? Ela tem 34
                    vendas — o histórico não muda, ela só some da
                    lista de venda.",
         fontes: [...],
         acao_pendente: { token: "eyJ0b29s...", rotulo: "Desativar" } }
 5. Front mostra o balão + dois botões: [Desativar] [Cancelar]

 ── PASSO 2 ─────────────────────────────────────────────────
 6. Clique em [Desativar] → POST /assistente/perguntar
       { pergunta: "Sim, pode desativar.",   ← entra no histórico
         historico: [...],
         confirmacao: "eyJ0b29s...abc.9f2c1e" }
 7. Controller vê `confirmacao` e DESVIA — não chama o modelo ainda:
       ├─ verificarAcao(token, req.usuario.id)
       │     ├─ HMAC inválido?      → 400 "Confirmação inválida"
       │     ├─ expirado?           → 400 "A confirmação expirou, peça de novo"
       │     └─ outro usuário?      → 403
       ├─ executa a tool com CONFIRMADA=true (pula o preparar)
       └─ devolve o registro ao modelo para ele redigir o desfecho
 8. { resposta: "Feito. A Areia média está desativada — não aparece
                 mais na hora de vender. As 34 vendas antigas
                 continuam no histórico." }
```

> 🔑 **O detalhe que faz isso funcionar:** no passo 6 o front manda o token **e** um texto de confirmação. O texto entra no histórico para a conversa fazer sentido; **o token é o que autoriza**. Se um usuário digitar *"sim, pode apagar"* sem clicar no botão, não há token — e o Zé simplesmente propõe de novo. **Confirmação em linguagem natural nunca autoriza.** Isso elimina toda uma classe de ambiguidade ("ele disse sim para quê?").

---

## 🧭 Resolução de ambiguidade

O problema levantado: *"tem dois Marcos"*, *"achei 3 cimentos"*. Sem confirmação prévia, como não escolher errado?

### A regra: **a tool nunca escolhe. Ela devolve as opções.**

Um resolvedor compartilhado, novo, em `BackEnd/src/assistente/resolver.js`:

```js
// Resolve um nome digitado em linguagem natural para UM registro.
// Nunca chuta: ou acha um, ou devolve a lista para o modelo perguntar.
export async function resolverUm(candidatos, termo, rotulo) {
  if (candidatos.length === 0)
    return { estado: 'nenhum', mensagem: `Não achei nenhum ${rotulo} com "${termo}".` };

  if (candidatos.length === 1)
    return { estado: 'unico', item: candidatos[0] };

  // Empate desfeito por igualdade exata (case-insensitive) — "Marcos"
  // digitado exato ganha de "Marcos Antônio" e "Marcos Silva".
  const exatos = candidatos.filter(
    (c) => c.nome.toLowerCase() === termo.trim().toLowerCase()
  );
  if (exatos.length === 1) return { estado: 'unico', item: exatos[0] };

  return { estado: 'ambiguo', opcoes: candidatos.slice(0, 5) };
}
```

O que o modelo recebe em cada caso e o que ele faz:

| Estado | Devolvido à tool | O Zé responde |
|---|---|---|
| `unico` | executa normalmente | *"Pronto, lancei…"* |
| `nenhum` | `{ erro, sugestao }` | *"Não achei nenhum cliente 'Marcus'. Quer que eu cadastre?"* |
| `ambiguo` | `{ precisa_escolher, opcoes: [...] }` | *"Tem dois Marcos: **Marcos Silva** (98812-3344) e **Marcos Antônio** (99120-8877). Qual deles?"* |

**Por que isso resolve sem confirmação em dois passos:** a ambiguidade vira uma **pergunta natural na conversa**, não um mecanismo de segurança. O usuário responde *"o Silva"*, o modelo chama a tool de novo com `cliente_id` explícito (o `id` veio nas opções e está no histórico da conversa) e aí é `unico`. Duas mensagens, zero fricção, zero risco de escolha silenciosa.

### Os quatro casos de `criar_venda`, resolvidos por composição

`criar_venda` resolve N produtos + 1 cliente. A regra: **resolve tudo primeiro, só executa se tudo for `unico`.**

```
criar_venda({ cliente: "João", itens: [{produto:"cimento", qtd:10}], forma: "fiado" })
  │
  ├─ resolve cliente "João"      → ambiguo? ─┐
  ├─ resolve produto "cimento"   → ambiguo? ─┤
  │                                          │
  ├─ algum ambíguo/nenhum? ──────────────────┘
  │     └─ devolve TODAS as pendências de uma vez, nada é gravado:
  │        { precisa_escolher: {
  │            cliente: [ {id, nome:"João Silva",   telefone}, ... ],
  │            "item 1 (cimento)": [ {id, nome:"Cimento CP-II", preco},
  │                                  {id, nome:"Cimento CP-III", preco} ] } }
  │        → o Zé pergunta as duas coisas numa frase só
  │
  └─ tudo único → monta a nota e (com a contraproposta) pede confirmação
```

> ⚠️ **Um `criar_venda` parcialmente executado é inaceitável.** A resolução é **toda antes** de qualquer `INSERT`. `venda.service.criarVenda` recebe apenas **IDs já resolvidos** — a tool faz a tradução nome→id, o service nunca vê um nome. Isso mantém o service reusável pelo controller HTTP, que já manda IDs.

---

## 🔧 Catálogo completo de tools

`✅` = permitido · `❌` = negado · `🛑` = exige confirmação em dois passos

### Produtos

| Tool | Parâmetros | dono | vendedor | 🛑 |
|---|---|:---:|:---:|:---:|
| `criar_produto` | `nome` *(string, obrig.)*, `unidade` *(enum: saco, milheiro, m3, peca, barra, kg, metro, carrada — obrig.)*, `preco_venda` *(number, obrig.)*, `preco_custo` *(number)*, `categoria` *(string — nome, resolvido para id)* | ✅ | ❌ | — |
| `editar_produto` | `busca` *(string, obrig.)*, `nome`, `unidade`, `preco_venda`, `preco_custo`, `categoria` *(todos opcionais — só o que vier é alterado)* | ✅ | ❌ | — |
| `desativar_produto` | `busca` *(string, obrig.)* | ✅ | ❌ | 🛑 |
| `reativar_produto` | `busca` *(string, obrig.)* | ✅ | ❌ | — |

> 🔍 **`reativar_produto` existe porque `desativar` sem volta é uma armadilha.** Sem ela, o único desfazer é a tela de Produtos — e a pessoa que está conversando com o Zé é justamente quem não quer abrir tela. Custo: ~15 minutos (é o `desativar` com `TRUE`). Não confirma: reativar não destrói nada.

### Clientes

| Tool | Parâmetros | dono | vendedor | 🛑 |
|---|---|:---:|:---:|:---:|
| `criar_cliente` | `nome` *(obrig.)*, `telefone` *(obrig.)*, `tipo` *(enum: consumidor_final, pedreiro, construtora, revenda)*, `observacao` | ✅ | ✅ | — |
| `editar_cliente` | `busca` *(obrig.)*, `nome`, `telefone`, `tipo`, `observacao` *(parciais)* | ✅ | ✅ | — |
| ~~`remover_cliente`~~ | — | — | — | **Fora da v1** — ver [Decisão 3](#️-decisão-3-em-aberto--delete-real-vs-desativação) |

> 📌 `telefone` é `NOT NULL` no schema (linha 35) e `criarCliente` valida (`cliente.controller.js:84`). O prompt precisa mandar o Zé **perguntar o telefone** quando o usuário disser só o nome, em vez de inventar um.

### Vendas

| Tool | Parâmetros | dono | vendedor | 🛑 |
|---|---|:---:|:---:|:---:|
| `criar_venda` | `itens` *(array obrig. de `{ produto: string, quantidade: number, preco_unitario?: number }`)*, `cliente` *(string — ausente = Consumidor)*, `forma_pagamento` *(enum: dinheiro, pix, cartao, fiado — obrig.)*, `desconto` *(number)* | ✅ | ✅ | 🛑 **(recomendado)** |
| `cancelar_venda` | `venda_id` *(uuid)* **ou** `cliente` + `quando` *(enum: hoje, ontem)* — resolvido via `buscarVendasRecentes` | ✅ | ❌ | 🛑 |

> 🔒 **`cancelar_venda` só para o dono.** Cancelar é o único jeito de sumir com dinheiro do faturamento. Hoje `PATCH /api/vendas/:id/cancelar` (`venda.routes.js:15`) não tem `requireDono` — o vendedor cancela pela tela. **Não mudo isso** (fora de escopo), mas o chat torna trivial o que hoje exige navegar até a venda; é o mesmo argumento do plano anterior (`Prumo-Assistente-IA-Plano.md:242`). Se você quiser vendedor cancelando pelo Zé, é uma linha.

### Fiados

| Tool | Parâmetros | dono | vendedor | 🛑 |
|---|---|:---:|:---:|:---:|
| `registrar_pagamento_fiado` | `cliente` *(string, obrig.)*, `valor` *(number, obrig.)*, `venda_id` *(uuid — se a pessoa souber qual dívida)* | ✅ | ✅ | — |

> 💰 **A regra de negócio mais delicada do plano.** Um cliente pode ter **várias** vendas fiado em aberto (a query de `fiado.controller.js:9-27` lista por venda, não por cliente). *"O Marcos pagou 200"* — em qual dívida? Regra proposta, e que precisa aparecer na resposta:
>
> - **1 dívida em aberto** → aplica nela. Direto.
> - **Várias dívidas** → aplica **da mais antiga para a mais nova** (o `ORDER BY v.vendida_em ASC` de `fiado.controller.js:26` já reflete essa intenção de produto), abatendo em cascata, e a resposta **discrimina**: *"Recebi R$ 200 do Marcos: R$ 120 quitaram a venda de 12/07 e R$ 80 entraram na de 28/07, que ainda deve R$ 340."*
> - **Valor maior que o total devido** → `ErroNegocio` antes de gravar qualquer coisa (`fiado.controller.js:121-126` já valida por venda; a versão em cascata valida contra a soma). **Nunca gera crédito** — não há tabela para isso.
>
> Não confirma porque **é reversível na conversa** e porque receber dinheiro no balcão é a operação mais frequente e mais urgente do módulo (ver `memory/prumo-modulo-fiados.md`). Mas o "registro" pós-execução aqui é obrigatório e detalhado.

### Resumo: 11 tools novas (12 se `remover_cliente` entrar), 3 com confirmação

---

## 🔐 Permissões por papel

| | Tool | dono | vendedor | Raciocínio |
|:---:|---|:---:|:---:|---|
| 📦 | `criar_produto` | ✅ | ❌ | Preço é decisão do dono. Vendedor criando produto vira catálogo bagunçado |
| 📦 | `editar_produto` | ✅ | ❌ | Mesmo motivo — editar preço é editar margem |
| 📦 | `desativar_produto` 🛑 | ✅ | ❌ | Destrutivo |
| 📦 | `reativar_produto` | ✅ | ❌ | Simetria com desativar |
| 👤 | `criar_cliente` | ✅ | ✅ | **O vendedor precisa.** Cliente novo chega no balcão e a venda não pode parar |
| 👤 | `editar_cliente` | ✅ | ✅ | Corrigir telefone errado é trabalho de balcão |
| 🧾 | `criar_venda` 🛑 | ✅ | ✅ | É o trabalho do vendedor. `usuario_id` vem do token, então a venda fica no nome certo |
| 🧾 | `cancelar_venda` 🛑 | ✅ | ❌ | Some com faturamento. Dono |
| 💰 | `registrar_pagamento_fiado` | ✅ | ✅ | Recebimento acontece no balcão |

> ⚠️ **Uma inconsistência que vale nomear:** o vendedor pode `criar_venda` mas não `produtos_mais_vendidos`… que na tabela do plano anterior (`Prumo-Assistente-IA-Plano.md:254`) **é** permitida. Confirmado no código: `tools.js:160` tem `papeis: '*'`. Está coerente. Mas o vendedor **não** pode ler `resumo_do_periodo` e ainda assim pode gravar venda — o que é intencional (operar ≠ ver o agregado do negócio) e vale registrar por escrito para não parecer bug depois.

---

## 📜 Contrato da API

**Aditivo. Nada do contrato atual muda.**

### Requisição

```jsonc
POST /api/assistente/perguntar
{
  "pergunta": "Sim, pode desativar.",
  "historico": [ /* como hoje */ ],
  "confirmacao": "eyJ0b29sIjo...abc.9f2c1e"   // 🆕 opcional
}
```

### Resposta `200`

```jsonc
{
  "resposta": "Quer mesmo desativar a Areia média? ...",
  "fontes": [ { "rotulo": "Produtos", "para": "/produtos" } ],
  "acao_pendente": {                            // 🆕 opcional
    "token":  "eyJ0b29sIjo...abc.9f2c1e",
    "rotulo": "Desativar",                      // texto do botão de confirmar
    "tipo":   "destrutiva"                      // front pinta em vermelho (prumo)
  }
}
```

### Erros novos

| Código | Quando | Mensagem |
|---|---|---|
| `400` | Token de confirmação adulterado ou malformado | `"Confirmação inválida. Peça de novo ao Zé."` |
| `400` | Token expirado (> 5 min) | `"Essa confirmação expirou. Peça de novo."` |
| `403` | Token de outro usuário | `"Essa confirmação não é sua."` |

> ✅ `api.js:70` já converte `{ erro }` em `Error(dados.erro)` e `Assistente.jsx:52-63` já mostra o balão vermelho — mas hoje **descarta a mensagem real** e mostra texto genérico. Ver [Bugs](#-bugs-e-dívidas-pré-existentes).

---

## 🗂️ Mudanças arquivo por arquivo

### 🆕 Criar — 8 arquivos

| Arquivo | Conteúdo | Linhas ~ |
|---|---|---:|
| `BackEnd/src/config/erros.js` | `ErroNegocio` (status + codigo) | 15 |
| `BackEnd/src/produto/produto.service.js` | 4 funções + `validarProduto` (movida de `produto.controller.js:14-23`) + merge parcial | 120 |
| `BackEnd/src/cliente/cliente.service.js` | 3 funções + validação (de `cliente.controller.js:84-89`) + merge parcial | 100 |
| `BackEnd/src/venda/venda.service.js` | `criarVenda` (transação de `venda.controller.js:102-169`), `cancelarVenda`, `buscarVendasRecentes` | 180 |
| `BackEnd/src/fiado/fiado.service.js` | `registrarPagamento` **em cascata por cliente** (evolui `fiado.controller.js:96-136`), `fiadosDoCliente` | 130 |
| `BackEnd/src/assistente/confirmacao.js` | `assinarAcao` / `verificarAcao` (HMAC) | 60 |
| `BackEnd/src/assistente/resolver.js` | `resolverUm`, `resolverCliente`, `resolverProduto` | 90 |
| `BackEnd/src/assistente/tools.escrita.js` | as 11 tools novas — **arquivo separado**, senão `tools.js` passa de 800 linhas | 480 |

### ✏️ Alterar — 11 arquivos

| Arquivo | O que muda |
|---|---|
| `BackEnd/src/produto/produto.controller.js` | 5 handlers viram casca: chamam o service, `try/catch` traduz `ErroNegocio`→status. `-70 linhas` |
| `BackEnd/src/cliente/cliente.controller.js` | Idem. `-50 linhas` |
| `BackEnd/src/venda/venda.controller.js` | `criarVenda` perde as ~90 linhas de transação (linhas 102-169). `-100 linhas` |
| `BackEnd/src/fiado/fiado.controller.js` | `pagar` (linhas 88-143) vira casca. **Mantém a rota por-venda** — a cascata é só do Zé |
| `BackEnd/src/assistente/tools.js` | Importa e faz `spread` de `TOOLS_ESCRITA` no `TOOLS`; `executarTool` (linha 370) ganha o desvio de `tool.confirma` e o parâmetro `{ confirmada }` |
| `BackEnd/src/assistente/assistente.service.js` | `responder()` aceita `confirmacao`; propaga `acao_pendente`; system prompt ganha 3 blocos novos (ESCREVENDO / CONFIRMANDO / O REGISTRO) |
| `BackEnd/src/assistente/assistente.controller.js` | Valida `confirmacao` (string, tamanho); traduz erros de `verificarAcao` em 400/403 |
| `BackEnd/src/docs/openapi.js` | Rota `/assistente/perguntar` (linha 902) ganha `confirmacao` no request e `acao_pendente` na resposta + 3 erros |
| `FrontEnd/src/services/assistente.js` | `perguntar(pergunta, historico, confirmacao)` — 3º parâmetro opcional |
| `FrontEnd/src/pages/Assistente.jsx` | `Mensagem` renderiza `acao_pendente` (2 botões); `enviar()` aceita token; **só a última mensagem** mostra botões ativos |
| `BackEnd/.env.example` | Comentário: `JWT_ACCESS_SECRET` agora também assina confirmações do Zé |

### ⛔ Não mexer

`schema.sql` (nenhuma migração — pelo caminho B da Decisão 3) · `requireAuth.js` · `requireDono.js` · `openrouter.js` · `api.js` · nenhuma rota HTTP existente muda de assinatura.

---

## 🪜 Fatias verticais e ordem

Cada fatia termina em algo verificável **sem `OPENROUTER_API_KEY`** — restrição de ambiente que dita a ordem.

> 🔬 **Como verificar sem a chave da IA.** O Zé responde 503 (`assistente.controller.js:19-23`), então **não dá para testar tool calling rodando**. A saída, adotada em toda fatia: um script `BackEnd/scripts/testar-tools.mjs` que importa `executarTool` diretamente e simula o que o modelo mandaria:
>
> ```bash
> node scripts/testar-tools.mjs criar_produto '{"nome":"Teste","unidade":"saco","preco_venda":10}'
> ```
>
> Isso exercita **tudo menos a escolha do modelo** — services, validação, permissão, HMAC, resolvedor. O que sobra sem cobertura é só *"o modelo escolhe a tool certa?"*, que só a chave resolve. **Recomendo criar esse script na Fatia 1**, não no fim: ele é o *test harness* do plano inteiro, e o projeto não tem nenhum outro.

| # | Fatia | Entrega | Verificação | ⏱️ |
|:---:|---|---|---|---:|
| **1** | 🧱 **Fundação sem IA** | `erros.js` + `produto.service.js` + `cliente.service.js`; os dois controllers viram casca; script de teste | `curl` nos endpoints REST existentes — **tudo continua idêntico**. Refatoração pura, zero comportamento novo | **4h** |
| **2** | ✍️ **Primeira escrita** | `tools.escrita.js` com `criar_produto`, `editar_produto`, `criar_cliente`, `editar_cliente`; merge parcial; registro no retorno; system prompt | `node scripts/testar-tools.mjs` cria e edita; edição parcial **não apaga** os campos omitidos (o teste que importa) | **4h** |
| **3** | 🔏 **Confirmação ponta a ponta** | `confirmacao.js` + desvio no `executarTool` + `acao_pendente` no contrato + `desativar_produto` / `reativar_produto` + botões no front | Token adulterado → 400 · token de outro usuário → 403 · expirado → 400 · caminho feliz desativa | **5h** |
| **4** | 🧭 **Resolvedor** | `resolver.js` + `busca` por nome nas 6 tools das fatias 2-3 | *"edita o cimento"* com 3 cimentos no banco devolve `precisa_escolher` com as 3 opções, **sem gravar** | **2h** |
| **5** | 💰 **Fiados** | `fiado.service.js` com cascata por cliente + `registrar_pagamento_fiado`; `fiado.controller.js` vira casca | Cliente com 2 dívidas recebe R$ 200 → abate a mais antiga primeiro, resposta discrimina; valor > total → erro **antes** do `INSERT` | **3h** |
| **6** | 🧾 **Venda** | `venda.service.js` + `criar_venda` (resolução em lote + nota de confirmação) + `cancelar_venda`; `venda.controller.js` vira casca | Venda de 2 itens com nome ambíguo em um deles → pergunta os dois de uma vez, **nada gravado**. Caminho feliz grava venda + itens em transação | **6h** |
| **7** | 📚 **Acabamento** | OpenAPI, `.env.example`, revisão do system prompt com a chave real | `/api/docs` mostra `acao_pendente`; **10 frases reais** testadas com a chave configurada | **2h** |

**Total: 26h** (20h se `criar_venda` não confirmar e a fatia 6 encolher).

### Por que esta ordem

1. **A Fatia 1 é refatoração pura, sem feature.** Se algo quebrar, quebra num terreno onde `curl` no endpoint existente é o teste — e o `git diff` mostra que só o *encanamento* mudou. Começar pela IA seria depurar dois problemas novos ao mesmo tempo.
2. **Produto/cliente antes de venda** porque são de uma tabela só, sem transação e sem ambiguidade. Aprende-se o formato do "registro" no caso barato.
3. **Confirmação (3) antes do resolvedor (4)** porque é a peça de *segurança*: se o HMAC estiver errado, tudo depois herda o furo. Segurança primeiro, conveniência depois.
4. **Venda por último** porque depende de tudo: services, confirmação, resolvedor em lote. É a fatia onde mais coisa pode dar errado, e ela chega quando as três anteriores já estão provadas.
5. **Fatia 7 é a única que exige a chave.** Todo o resto é verificável hoje.

---

## 🐛 Bugs e dívidas pré-existentes

Encontrados durante o estudo. **Nenhum é bloqueante**, mas os três primeiros tocam este plano.

| | Onde | Problema | Ação |
|:---:|---|---|---|
| 🔴 | `venda.controller.js:83` | `usuario_id` vem do **body**, não do token. Um vendedor pode lançar venda em nome de outro via API — e `desempenho_vendedores` (`tools.js:201`) passa a mentir | Nas tools do Zé, **sempre** `usuario.id`. Corrigir o endpoint HTTP fica fora de escopo, mas **registre**: é uma linha e vale um commit separado |
| 🟡 | `produto.controller.js:100` / `cliente.controller.js:117` | `PUT` é substituição total: campo omitido vira `NULL`. Faz sentido para um formulário que sempre manda tudo; é **destrutivo** para IA | Resolvido na Fatia 2 pelo merge parcial. Os endpoints HTTP continuam PUT |
| 🟡 | `venda.controller.js:171` | `ROLLBACK` no `catch` **sem `try` próprio**: se a conexão já caiu, o `ROLLBACK` lança e mascara o erro original com um 500 genérico | Ao extrair para `venda.service.js`, envolver em `try/catch` vazio. Custo: 2 linhas |
| 🟢 | `Assistente.jsx:52-63` | Todo erro vira *"O Zé não conseguiu responder agora"*. A mensagem real (`e.message`, que `api.js:70` já preserva) é **descartada** | Precisa mudar na Fatia 3: *"Essa confirmação expirou"* é acionável, o texto genérico não |
| 🟢 | `tools.js:100` | Argumentos JSON malformados caem em `args = {}` e a tool roda **com os padrões**. Inofensivo em leitura (traz o mês corrente); **inaceitável** em escrita (criaria produto vazio) | Nas tools de escrita, JSON malformado deve **falhar** com `{ erro }`, nunca cair em default |
| 🟢 | `venda.controller.js:167-168` | Após o `COMMIT`, duas queries extras via `query()` (fora da transação) só para montar a resposta | Ao extrair, montar o retorno com o que já está em memória |

---

## ⚠️ Riscos concretos

| | Risco | Evidência | Mitigação |
|:---:|---|---|---|
| 💣 | **Venda errada gravada e irreversível** | `venda.controller.js:188` — cancelar não apaga, marca `cancelada`. `Prumo-Modelo-de-Dados-v0.1.md:21` (P6) | Confirmação em `criar_venda` (contraproposta). Se recusada: resolvedor obrigatório em 100% dos itens + registro pós-execução com a nota completa + `fonte` apontando `/vendas` |
| 🎭 | **Front forja confirmação** | `api.js:77` — payload montado no cliente | HMAC com `JWT_ACCESS_SECRET` + `usuario_id` embutido + 5 min. **Sem isso, a feature é um buraco de segurança** |
| 🗑️ | **DELETE destrói dado do histórico** | `cliente` não tem `ativo` (schema:32-40); `cliente.controller.js:138` faz `DELETE` real | Caminho B: não expor delete de cliente ao Zé na v1 |
| 🔀 | **Edição parcial apaga campos** | `produto.controller.js:106` — `?? null` em todos os opcionais | Merge com o registro atual **dentro do service**, na Fatia 2. Testar explicitamente |
| 💸 | **Pagamento na dívida errada** | `fiado.controller.js:9-27` lista por venda; um cliente pode ter várias | Cascata da mais antiga + resposta discriminando venda por venda. Valor > total → erro **antes** do `INSERT` |
| 🔁 | **Loop de 4 iterações escreve 4 vezes** | `assistente.service.js:11` (`MAX_ITERACOES = 4`) e o laço da linha 94 executa **todos** os `tool_calls` de um turno — o modelo pode pedir a mesma tool duas vezes | **Guarda de idempotência por turno:** o service mantém um `Set` de `nome+JSON(args)` de tools de escrita **já executadas na requisição**; repetição devolve o resultado anterior sem tocar no banco. ~10 linhas, indispensável |
| 🎲 | **Modelo escolhe a tool errada** (`criar_produto` quando era `editar_produto`) | Nenhuma proteção estrutural possível | `description` caprichada + registro pós-execução (a pessoa lê e percebe) + `reativar_produto` como desfazer |
| 🧊 | **Chave ausente impede testar a escolha do modelo** | `assistente.controller.js:19` → 503 | Script `testar-tools.mjs` cobre tudo exceto a escolha. A Fatia 7 é onde a escolha é validada, com 10 frases reais |
| ⏱️ | **Timeout de 30s no meio de uma escrita** | `openrouter.js:8` | A escrita é **atômica no banco** (transação). O timeout ocorre na redação da resposta, depois do `COMMIT`: o dado está salvo, o usuário vê erro. Mitigação: `fontes` sempre apontando a tela, para a pessoa conferir |
| 🧾 | **Truncamento silencioso** | `produto.nome VARCHAR(120)`, `cliente.nome VARCHAR(120)`, `telefone VARCHAR(20)` (schema:63, 34, 35) | O registro vem do `RETURNING *` (valor **gravado**, não o enviado). O truncamento aparece na leitura de conferência — funciona por construção |

---

## 🚫 Fora de escopo

Explicitamente **não** entra nesta entrega:

| | O que | Por quê |
|:---:|---|---|
| 🗃️ | **Migração de schema de qualquer tipo** | Nenhuma tool precisa. Se `ativo` em `cliente` for aprovado, vira trabalho próprio |
| 🧾 | **Editar venda** (trocar item, mudar quantidade) | Não existe nem na tela. `venda.controller.js` só tem criar e cancelar. Fora do modelo de dados atual |
| 📋 | **Log de auditoria** | `schema.sql:154` lista `log_auditoria` como fase futura. Escrita por IA **fortalece** o argumento, mas é módulo próprio |
| ↩️ | **Desfazer genérico** | Só `reativar_produto` existe, porque é `UPDATE ativo = TRUE`. Desfazer venda é cancelar, e cancelar é auditável |
| 🏷️ | **CRUD de categoria pelo Zé** | `categoria.controller.js` existe, mas categoria é organização de catálogo — trabalho de mesa, não de balcão. `criar_produto` **resolve** categoria por nome; não cria |
| 👥 | **CRUD de usuário pelo Zé** | `usuario.routes.js:19-23` é todo `requireDono` e envolve senha. IA perto de credencial: não |
| 📦 | **Venda em lote / importação** | Uma venda por vez |
| 🔊 | **Confirmar por voz** | `useDitado` já existe (`Assistente.jsx:22`), mas confirmação destrutiva por voz num balcão barulhento é pedir para errar. **Confirmação é sempre por toque** |
| ⚡ | **Streaming da resposta** | `openrouter.js` não faz streaming. Ortogonal a esta feature |

---

## ✅ Como saber que funcionou

Não é "o código roda":

- [ ] O dono fala *"cadastra areia média, m3, 95 reais"* e a resposta **lista os campos vazios** (`sem categoria`, `sem preço de custo`) — não só os que ele disse
- [ ] Uma edição de preço **não apaga** a categoria do produto (o bug de `produto.controller.js:106`, que a Fatia 2 fecha)
- [ ] Adulterar um caractere do token de confirmação no DevTools resulta em **400**, não em desativação
- [ ] Um vendedor pedindo *"apaga o cimento"* recebe recusa, e o modelo **nem enxerga** a tool no catálogo (`tools.js:354`)
- [ ] *"O Marcos pagou 200"* com duas dívidas em aberto responde **quanto entrou em cada uma** e quanto ainda falta
- [ ] *"Vende 10 cimentos pro João"* com 3 cimentos e 2 Joãos no banco pergunta as duas coisas **numa frase** e **não grava nada**
- [ ] O total da venda criada pelo Zé **bate** com o que a tela `/vendas` mostra — mesmo número, duas telas
- [ ] O `usuario_id` da venda criada pelo Zé é o do usuário logado, **sempre**, mesmo que ele peça outra coisa

> O penúltimo item é o mesmo teste do plano de leitura (*"o chat responde, a tela comprova"*). O último é o que impede a escrita de virar porta dos fundos.

---

<div align="center">

**🧱 Prumo** — *o Zé faz, e mostra o que fez.*

</div>
