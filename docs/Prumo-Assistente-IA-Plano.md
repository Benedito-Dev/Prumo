<div align="center">

# 🤖 ASSISTENTE DE IA — PLANO DE INTEGRAÇÃO

### *Perguntar ao Prumo em português.*

**Chat com IA sobre os dados do negócio · via OpenRouter**

<br>

![Status](https://img.shields.io/badge/status-planejado-C42E1E?style=for-the-badge)
![Camada](https://img.shields.io/badge/front-conclu%C3%ADdo-1B7A46?style=for-the-badge)
![Camada](https://img.shields.io/badge/back-a_fazer-FFC400?style=for-the-badge&labelColor=16191D)

<br>

`📄 Documento vivo` · `📅 Criado em 05/08/2026`

</div>

---

## 📋 Sumário

- [🎯 Por que este módulo existe](#-por-que-este-módulo-existe)
- [🧭 Princípios que guiam o desenho](#-princípios-que-guiam-o-desenho)
- [🏛️ Arquitetura em 4 camadas](#️-arquitetura-em-4-camadas)
- [🔧 Camada 1 — Catálogo de tools](#-camada-1--catálogo-de-tools)
- [🌐 Camada 2 — Cliente OpenRouter](#-camada-2--cliente-openrouter)
- [🔁 Camada 3 — Loop de tool calling](#-camada-3--loop-de-tool-calling)
- [🚪 Camada 4 — Rota HTTP](#-camada-4--rota-http)
- [🔐 Permissões por papel](#-permissões-por-papel)
- [📜 Contrato da API](#-contrato-da-api)
- [🗂️ Arquivos a criar e alterar](#️-arquivos-a-criar-e-alterar)
- [🪜 Ordem de execução](#-ordem-de-execução)
- [💰 Custo](#-custo)
- [⚠️ Riscos e decisões em aberto](#️-riscos-e-decisões-em-aberto)
- [✅ Como saber que funcionou](#-como-saber-que-funcionou)

---

## 🎯 Por que este módulo existe

O documento de requisitos abre com o problema do dono:

> *Quem compra mais? Quanto compra em média? O que vou vender mês que vem?*

O **Painel** responde as perguntas que nós anteciparíamos ao construí-lo. O dono tem perguntas que não conseguimos adivinhar — *"quanto o Zé da obra me deve?"*, *"vendi mais cimento que mês passado?"*. Isso não cabe em dashboard; cabe em conversa.

Há um segundo argumento, mais forte: o README define o público como **"quem não tem familiaridade com sistemas"**. Para esse usuário, digitar (ou **falar** — o ditado já está pronto) uma pergunta é mais barato que aprender a navegar sete telas. O chat pode ser a interface *mais* acessível do produto.

**O que já existe:** a tela (`FrontEnd/src/pages/Assistente.jsx`), o service, a rota `/assistente`, o item no menu e o ditado por voz. Tudo commitado e no ar. Falta só o backend — hoje toda pergunta cai no aviso de indisponível.

---

## 🧭 Princípios que guiam o desenho

| | Princípio | O que significa na prática |
|:---:|---|---|
| 🔒 | **A IA não escreve SQL** | O modelo escolhe entre funções pré-definidas. Nenhuma string vinda do modelo chega ao banco. |
| 👁️ | **Só leitura** | Nenhuma tool cria venda, paga fiado ou altera cadastro. Um assistente que só lê não causa dano por interpretação errada. |
| 🧾 | **Resposta ancorada em dado real** | Todo número vem de query, não de geração. O que o modelo faz é *redigir*, não *calcular*. |
| 🔍 | **A tela comprova** | Cada resposta traz atalhos (`fontes`) para a tela que tem o dado completo. O chat responde, a tela confirma. |
| 🛡️ | **Nada que o papel não permita** | As tools respeitam `req.usuario.papel`. O chat não vira porta dos fundos para dado restrito. |

---

## 🏛️ Arquitetura em 4 camadas

```
  Usuário digita ou fala
          │
          ▼
┌─────────────────────────┐
│  Assistente.jsx (front) │  ← PRONTO
└───────────┬─────────────┘
            │ POST /api/assistente/perguntar
            ▼
┌─────────────────────────────────────────────┐
│  4. assistente.routes + controller          │
│     requireAuth · valida entrada            │
└───────────┬─────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────┐
│  3. assistente.service  (o loop)            │
│     monta prompt → chama modelo →           │
│     executa tool → devolve → repete         │
└──────┬──────────────────────────┬───────────┘
       │                          │
       ▼                          ▼
┌──────────────────┐   ┌──────────────────────┐
│ 2. openrouter.js │   │ 1. tools.js          │
│    fetch → API   │   │    catálogo fechado  │
└──────────────────┘   └──────────┬───────────┘
                                  ▼
                       ┌──────────────────────┐
                       │  query() → Postgres  │
                       │  (queries existentes)│
                       └──────────────────────┘
```

**Leitura do diagrama:** o modelo nunca toca o banco. Ele devolve *o nome de uma função e seus argumentos*; a camada 3 valida esse nome contra o catálogo da camada 1 e executa a query que **já existe** no projeto.

---

## 🔧 Camada 1 — Catálogo de tools

📁 `BackEnd/src/assistente/tools.js`

O coração do desenho. Cada tool é um wrapper fino sobre SQL que já está em produção nos controllers do Painel, Fiados e Clientes.

### Tools previstas

| # | Tool | Argumentos | Reaproveita de | Devolve |
|:---:|---|---|---|---|
| 1 | `resumo_do_periodo` | `periodo` | `painel.controller.js:43` | total, nº vendas, ticket médio, nº clientes + variação vs. período anterior |
| 2 | `faturamento_do_mes` | — | `painel.controller.js:8` | mês atual, mês anterior, variação % |
| 3 | `ranking_clientes` | `periodo`, `limite` | `painel.controller.js:94` | top N por valor gasto |
| 4 | `produtos_mais_vendidos` | `periodo`, `limite` | `painel.controller.js:126` | top N por quantidade |
| 5 | `desempenho_vendedores` | `periodo` | `painel.controller.js:158` | total e nº de vendas por vendedor |
| 6 | `fiados_em_aberto` | — | `fiado.controller.js:7` e `:43` | total a receber, nº devedores, lista com dias em atraso |
| 7 | `buscar_cliente` | `busca` | `cliente.controller.js` | dados do cliente + histórico de compras |

### Como uma tool é definida

Cada entrada do catálogo tem três partes:

```
{
  schema:  { name, description, parameters }   ← o que vai para o modelo
  papeis:  ['dono']                            ← quem pode usar
  executar: async (args, usuario) => { ... }   ← a query real
  fonte:   { rotulo: 'Painel', para: '/' }     ← atalho na resposta
}
```

O `schema` segue o formato de *function calling* da OpenAI, que é o que o OpenRouter espera. A `description` é o que faz o modelo escolher a tool certa — vale caprichar nela, é literalmente o que dita a qualidade do assistente.

### Sobre o parâmetro `periodo`

O helper `resolverPeriodo()` (`painel/periodo.js:11`) já aceita `hoje | semana | mes | ano` ou um intervalo `de`/`ate`. As tools vão expor **apenas o enum** — mais fácil para o modelo acertar e impossível de virar entrada maliciosa. Se o dono perguntar por um intervalo específico, o modelo escolhe o enum mais próximo e a resposta diz qual período usou.

> 💡 **Nota de reuso:** as tools chamam a **query**, não o endpoint HTTP. Nada de o backend fazer `fetch` em si mesmo — isso duplicaria latência e autenticação sem ganho nenhum. Se uma query estiver amarrada demais ao `req`/`res`, ela é extraída para uma função pura e o controller passa a usá-la também.

---

## 🌐 Camada 2 — Cliente OpenRouter

📁 `BackEnd/src/assistente/openrouter.js`

Cliente minimalista: `fetch` nativo do Node contra `https://openrouter.ai/api/v1/chat/completions`. **Sem SDK novo** — nenhuma dependência entra no `package.json`.

### Variáveis de ambiente

Entram no `.env.example` (sem valor real, o `.env` já está no `.gitignore`):

```bash
# --- Assistente de IA (OpenRouter) ---
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_TIMEOUT_MS=30000
```

`OPENROUTER_MODEL` configurável significa que trocar de modelo é **editar uma linha do `.env` e reiniciar** — sem tocar em código. Isso importa porque a qualidade de *tool calling* varia bastante entre modelos do catálogo, e vamos precisar testar mais de um.

### Responsabilidades da camada

- Montar o header (`Authorization`, e os opcionais `HTTP-Referer` / `X-Title` que o OpenRouter usa para atribuição)
- `AbortController` com timeout — o front mostra "pensando", mas isso precisa ter fim
- Traduzir erro HTTP em `Error` com mensagem legível
- **Logar `usage`** de cada chamada (tokens de entrada e saída), para haver número real de custo em vez de estimativa

---

## 🔁 Camada 3 — Loop de tool calling

📁 `BackEnd/src/assistente/assistente.service.js`

O ciclo padrão de *function calling*:

```
 1. monta mensagens: system + histórico + pergunta
 2. chama o modelo, passando o catálogo de tools permitidas ao papel
 3. o modelo responde:
       ├─ texto final?        → devolve ao usuário ✅
       └─ pediu uma tool?     → passo 4
 4. VALIDA o nome contra o catálogo
       ├─ não existe?         → erro tratado, encerra ❌
       └─ existe + permitida? → executa a query
 5. anexa o resultado às mensagens
 6. volta ao passo 2   (até o teto de iterações)
```

### As três proteções — obrigatórias

| Proteção | Por quê | Como |
|---|---|---|
| 🔒 **Nome validado** | Modelo pode alucinar uma função que não existe | Comparação contra as chaves do catálogo. Desconhecido = rejeitado, nunca "tenta assim mesmo" |
| 🔁 **Teto de iterações** | Modelo confuso entra em loop e queima crédito | Máximo de **4** ciclos. Ao estourar, responde com o que tem e avisa |
| ⏱️ **Timeout** | Requisição pendurada trava a tela | `AbortController` na camada 2, default 30s |

### O system prompt

Precisa carregar quatro coisas — e é aqui que a qualidade da resposta se decide:

1. **Contexto** — é um depósito de material de construção; o usuário é o dono ou um funcionário
2. **Tom** — português do Brasil, direto, sem jargão técnico. O público é "quem não tem familiaridade com sistemas"
3. **Honestidade** — se a tool não devolveu o dado, dizer que não sabe. **Nunca inventar número**
4. **Formato** — valores em reais, respostas curtas. A tela do chat não é um relatório

> ⚠️ **A regra 3 é a mais importante do módulo.** Um assistente que inventa faturamento é pior que assistente nenhum — destrói a confiança no sistema inteiro, incluindo as telas que estão certas.

---

## 🚪 Camada 4 — Rota HTTP

📁 `BackEnd/src/assistente/assistente.routes.js` + `assistente.controller.js`

```js
router.post('/perguntar', perguntar);
```

Montada em `routes.js` sob `/api/assistente`, protegida por `requireAuth` como todo o resto do sistema (o `requireAuth` já é aplicado globalmente nas rotas de negócio — ver `eedc5a7`).

**Validações do controller:**

| Regra | Resposta |
|---|---|
| `pergunta` vazia ou ausente | `400` |
| `pergunta` acima de ~1000 caracteres | `400` — evita abuso de contexto |
| `historico` acima de ~20 mensagens | truncado nas mais recentes |
| `OPENROUTER_API_KEY` ausente | `503` com mensagem clara de "assistente não configurado" |

---

## 🔐 Permissões por papel

Decisão tomada no plano: **as tools respeitam o papel do usuário desde o início.**

### O raciocínio

Hoje as rotas de `/painel` **não** têm `requireDono` — qualquer usuário logado consegue consultar faturamento. Mas há uma diferença entre *tecnicamente acessível* e *fácil de pedir*. O chat torna trivial o que hoje exige saber o endpoint. Um vendedor perguntando *"qual o faturamento do mês?"* recebe o número sem nenhum atrito.

Implementar o filtro agora é bem mais barato que retroagir depois.

### O desenho

| Tool | dono | vendedor |
|---|:---:|:---:|
| `resumo_do_periodo` | ✅ | ❌ |
| `faturamento_do_mes` | ✅ | ❌ |
| `ranking_clientes` | ✅ | ❌ |
| `desempenho_vendedores` | ✅ | ❌ |
| `produtos_mais_vendidos` | ✅ | ✅ |
| `fiados_em_aberto` | ✅ | ✅ |
| `buscar_cliente` | ✅ | ✅ |

O catálogo enviado ao modelo é **filtrado antes da chamada** — o modelo nem sabe que a tool existe, então não tem como pedir. Se ainda assim pedir (nome alucinado), a validação da camada 3 barra.

> 📌 **Ponto para você decidir:** essa tabela é minha sugestão, não uma verdade. Se o vendedor deve ver o próprio desempenho, é ajuste de uma linha. **Vale revisar antes de eu implementar.**

---

## 📜 Contrato da API

O front **já está escrito** contra este contrato (`FrontEnd/src/services/assistente.js`). O backend precisa honrá-lo — ou mudamos os dois juntos.

### Requisição

```http
POST /api/assistente/perguntar
Authorization: Bearer <access token>
Content-Type: application/json
```

```json
{
  "pergunta": "Quem são meus melhores clientes?",
  "historico": [
    { "papel": "usuario",    "texto": "Como foi o faturamento?" },
    { "papel": "assistente", "texto": "Em agosto você faturou R$ 12.400..." }
  ]
}
```

### Resposta `200`

```json
{
  "resposta": "Seus três maiores clientes no mês são João Silva (R$ 3.200 em 8 compras), Construtora Alfa (R$ 2.850 em 3 compras) e Maria Souza (R$ 1.900 em 12 compras).",
  "fontes": [
    { "rotulo": "Clientes", "para": "/clientes" }
  ]
}
```

### Erros

| Código | Quando | O front mostra |
|---|---|---|
| `400` | Pergunta vazia ou longa demais | Mensagem de erro no balão |
| `401` | Token expirado | Já tratado — dispara refresh, depois logout |
| `503` | Chave não configurada | "Assistente indisponível" |
| `500` | Falha na chamada ou na query | "Não consegui responder agora" |

> ✅ O front já trata todos esses casos com balão de erro em vermelho — nada muda na tela.

---

## 🗂️ Arquivos a criar e alterar

### Criar

```
BackEnd/src/assistente/
├── tools.js                  ← catálogo (camada 1)
├── openrouter.js             ← cliente HTTP (camada 2)
├── assistente.service.js     ← loop (camada 3)
├── assistente.controller.js  ← validação (camada 4)
└── assistente.routes.js      ← rota (camada 4)
```

### Alterar

| Arquivo | Mudança |
|---|---|
| `BackEnd/src/routes.js` | montar `/assistente` |
| `BackEnd/.env.example` | 3 variáveis novas, sem valor |
| `BackEnd/src/docs/openapi.js` | tag `Assistente` + a rota (mantém a tradição de documentar junto) |

**Nenhuma dependência nova.** `fetch` é nativo; o resto já está no projeto.

---

## 🪜 Ordem de execução

Cada etapa termina em algo verificável — nada de "só funciona no final".

| # | Etapa | Entrega | Como verificar |
|:---:|---|---|---|
| **1** | 🔌 Encanamento | Cliente OpenRouter + rota devolvendo resposta do modelo, **sem tools** | Perguntar "olá" na tela e receber texto de volta |
| **2** | 🔧 Catálogo | `tools.js` com as 7 funções | Teste direto em Node, sem passar pelo modelo |
| **3** | 🔁 Loop | Tool calling com as três proteções | "Quanto tenho a receber?" traz o número real do banco |
| **4** | 🔐 Papel | Filtro por `req.usuario.papel` | Logar como vendedor e confirmar que faturamento é negado |
| **5** | 📚 Swagger | Rota documentada | `/api/docs` mostra a tag Assistente |

> 🎯 **Dá para parar no passo 1** e já ver a tela conversando de verdade. É o menor incremento que prova o caminho inteiro.

---

## 💰 Custo

Primeira despesa recorrente do projeto — vale entender antes da fatura.

**Por pergunta:** 2 ou mais chamadas ao modelo (a primeira + uma por tool executada). Com modelo econômico do OpenRouter, isso fica na casa de **frações de centavo por pergunta**.

**Controles no desenho:**

- Histórico truncado em ~20 mensagens (não cresce sem limite)
- Teto de 4 iterações por pergunta
- Pergunta limitada a ~1000 caracteres
- `usage` logado em toda chamada — **número real, não estimativa**

Para um depósito, provavelmente centavos por dia. Mas o log existe justamente para essa frase virar dado.

---

## ⚠️ Riscos e decisões em aberto

### Riscos conhecidos

| Risco | Mitigação no desenho |
|---|---|
| 🎭 **Modelo inventa número** | System prompt proíbe explicitamente + resposta traz `fontes` para conferir na tela + rodapé do chat já avisa |
| 🔧 **Modelo escolhe tool errada** | `description` bem escrita é a defesa principal. Ajustável sem mexer em arquitetura |
| ❌ **Modelo não suporta tool calling** | Trocável por env. Se o escolhido falhar, troca-se sem tocar em código |
| 💸 **Custo escapa** | `usage` logado desde a primeira chamada |
| 🔑 **Chave vaza** | Só no `.env` (gitignored). Nunca no front, nunca no repositório |

### Em aberto — precisam da sua palavra

1. **A tabela de permissões acima está correta?** Especialmente: vendedor deve ver o próprio desempenho?
2. **Qual modelo começar?** Se não tiver preferência, escolho um econômico com tool calling comprovado e deixo trocável.
3. **O assistente deve saber a data de hoje?** Ajuda em "esse mês", mas é um dado a mais no prompt. Minha inclinação: sim, é barato e evita confusão.

---

## ✅ Como saber que funcionou

Não é "o código roda". É:

- [ ] O dono pergunta *"quanto tenho a receber?"* e recebe **o número que a tela de Fiados mostra** — os dois batem
- [ ] Uma pergunta sem dado suficiente recebe *"não sei"*, não um número inventado
- [ ] Um vendedor não consegue extrair faturamento total
- [ ] O ditado por voz funciona ponta a ponta: falar a pergunta e receber a resposta
- [ ] O custo por pergunta está medido, não estimado

> O quinto item é o que transforma *"acho que é barato"* em decisão informada.

---

<div align="center">

**🧱 Prumo** — *o assistente responde, a tela comprova.*

</div>
