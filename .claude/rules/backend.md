---
paths:
  - "BackEnd/**/*.js"
  - "BackEnd/**/*.mjs"
  - "docs/schema.sql"
---

# BackEnd — mapa e convenções

## Organização

Um diretório por domínio em `src/`, cada um com `*.routes.js` → `*.controller.js` → `*.service.js` (quando há regra). `src/routes.js` agrega tudo sob `/api`; o que vem depois de `router.use(requireAuth)` é protegido.

| Domínio | Tem service? | Observação |
|---|---|---|
| `auth` | sim (token, senha, refresh.repo) | login, refresh rotacionado, logout, `/me` |
| `cliente`, `produto` | sim | services reusados pelas tools do Zé |
| `venda` | sim | o núcleo — transação, simulação, cancelamento |
| `fiado` | sim | contas a receber, cascata de pagamento |
| `painel` | não (SQL no controller) | somente leitura, 6 indicadores |
| `categoria`, `usuario`, `health` | não | CRUD simples |
| `assistente` | sim + tools | ver `.claude/rules/assistente.md` |

`src/docs/openapi.js` mantém a spec do Swagger (`/api/docs`) escrita à mão: ~990 linhas, 42 operações, e **hoje cobre 100% das rotas**. Não há geração automática — **rota nova sem entrada lá quebra essa cobertura.** Ao adicionar, siga o formato vizinho (`tags`, `summary`, `security`, exemplos de resposta).

## Erros

`ErroNegocio` (`config/erros.js`) é a ponte service → chamador. Tem `status` (sugestão HTTP) e `codigo` (identificador estável, para decidir por programa sem casar string de mensagem).

```js
throw new ErroNegocio('Desconto maior que o total dos itens');
throw naoEncontrado('Venda não encontrada');   // 404
throw conflito('Venda já está cancelada');     // 409
```

No controller, sempre `responderErro(res, erro, 'Falha ao …')` — ele traduz `ErroNegocio` no status declarado e o resto em 500.

## Transações

Use `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` (nunca o helper `query()`) quando escrever em mais de uma tabela. Padrão obrigatório:

- `client.release()` no `finally`.
- O `ROLLBACK` vai dentro de `try` próprio: um rollback quebrado não pode mascarar o erro original (ver `venda.service.js`).
- Erro `23503` (FK) vira `ErroNegocio` legível ("Cliente informado não existe"), nunca 500 cru.

Onde há transação hoje: `criarVenda`, `registrarPagamento`, `registrarPagamentoEmCascata`.

## Concorrência em fiado

`fiado.service.js` usa `SELECT … FOR UPDATE` antes de somar saldo. Sem isso, dois caixas recebendo ao mesmo tempo gravariam pagamentos que somados estouram o valor da venda. **Não remova o `FOR UPDATE`.**

A cascata (`registrarPagamentoEmCascata`) abate da dívida **mais antiga para a mais nova** — é como o dono cobra e como o cliente entende a própria conta. Duas garantias inegociáveis:

1. Valor maior que o total devido é `ErroNegocio` **antes do primeiro INSERT**. Não existe tabela de crédito; sobra viraria dinheiro sumido.
2. Tudo numa transação só. Quitar a venda A e falhar na B deixaria um recibo que não bate com o sistema.

## Escrita total vs. parcial

Cada service de cadastro tem os dois caminhos, e eles não são intercambiáveis:

- `atualizarProduto` / `atualizarCliente` — substituição **total**: campo ausente vira `NULL`. É o que o formulário da tela faz, porque ele sempre manda a ficha inteira.
- `atualizarProdutoParcial` / `atualizarClienteParcial` — sobrepõe só as chaves enviadas. É o que a IA usa: "muda o preço do cimento para 45" não pode zerar categoria e custo. `undefined` = não mencionou; `null` = apague este campo.

## Auth

- Access token: 15 min, payload mínimo (`sub`, `papel`, `nome`), volta no JSON.
- Refresh: cookie httpOnly, `path=/api/auth`, `secure` só em produção, persistido em `refresh_token` com `jti`. **Rotação:** o refresh usado é revogado a cada renovação. Persistir é o que permite logout real.
- Login responde a mesma mensagem para usuário inexistente e senha errada — não vaze qual falhou.
- `requireDono` sempre **depois** de `requireAuth`.

## Usuários — armadilhas já corrigidas, não as reabra

`usuario.controller.js` é a exceção do projeto: chama `bcrypt` direto em vez de `senha.service.js`, e toda query usa `COLUNAS_PUBLICAS` (`id, nome, email, papel, ativo, criado_em`) para que **`senha_hash` nunca saia na resposta**. Ao mexer, mantenha as duas coisas.

**O papel padrão em `criarUsuario` é `'vendedor'`, o de menor privilégio.** Antes o default era `'dono'`: quem esquecesse o campo ganhava um administrador. Não troque o `papel ?? 'vendedor'`.

Desativar usuário é `ativo=false`, nunca `DELETE` — preserva o histórico de vendas dele.

## O que o vendedor alcança

O recorte por papel não é só do painel. A regra geral: **o vendedor opera o balcão, o dono enxerga a loja.**

| Recurso | Vendedor | Dono |
|---|---|---|
| `GET /vendas`, `/vendas/:id` | só as que ele lançou | tudo |
| `GET /clientes?busca=` | resultado da busca (mín. 2 caracteres, máx. 8) | lista completa |
| `GET /clientes` sem `busca` | `[]` | lista completa |
| `POST /clientes` | sim (cadastra no balcão) | sim |
| `PUT`/`DELETE /clientes/:id` | 403 | sim |
| `GET /clientes/estatisticas` | 403 | sim |
| `GET /fiados`, `/fiados/resumo` | 403 | sim |
| `GET /fiados/cliente/:id` | sim | sim |
| `POST /fiados/cliente/:id/pagar` | sim | sim |
| `GET`/`POST /fiados/:vendaId/*` | 403 | sim |

Dois detalhes que existem por um motivo:

- **A busca de clientes não pode ser trancada.** Sem ela, o vendedor não escolhe cliente em Nova Venda e toda venda dele vira "Consumidor" — que some do histórico e do ranking e não dá para corrigir depois. Por isso ele busca, mas nunca recebe a lista inteira.
- **`buscarVenda` responde 404, não 403,** para venda de outro vendedor. Dizer "existe, mas não é sua" já confirmaria a venda a quem não deveria saber dela.

O filtro de `listarVendas` vem do token no controller e **sobrescreve** o que veio na query — sem isso, bastaria mandar `?usuario_id=<id do colega>`.

## Fiado: o mapa é do dono, o aviso é do balcão

O vendedor não tem a tela de Fiados. A dívida aparece para ele **dentro de Nova Venda**, quando escolhe o cliente: `GET /fiados/cliente/:id` devolve total, número de dívidas e a data da mais antiga, e `POST /fiados/cliente/:id/pagar` abate em cascata.

A distinção é de ética, não técnica: saber que o cliente à sua frente deve é atendimento; ter a lista de quem está endividado com a loja é outra coisa. O efeito colateral é bom — a dívida é cobrada no momento em que o devedor está no balcão, em vez de esperar alguém abrir uma tela.

## Permissão no painel

Os seis indicadores da loja (`faturamento`, `resumo`, `ranking-clientes`, `produtos-mais-vendidos`, `vendas-por-vendedor`, `evolucao-faturamento`) são **`requireDono`**, alinhados com as tools equivalentes do Zé, que sempre foram `['dono']`. Antes a rota REST estava aberta e a mesma informação respondia diferente conforme o caminho.

`meu-resumo` e `minha-evolucao` são abertas a qualquer autenticado e filtram por `req.usuario.id` — **nunca por um id vindo da query**, senão um vendedor leria os números de outro. Elas são declaradas **antes** do `router.use(requireDono)` no arquivo de rotas; inverter a ordem tranca as duas.

No front, `App.jsx` escolhe a tela pelo papel (`PainelDoPapel`): o dono vê `Painel.jsx`, o vendedor vê `MeuPainel.jsx`. Trancar a rota sem isso deixaria o vendedor com uma tela de erro logo após o login.

## Rate limit e vazamento de detalhe

`POST /api/auth/login` passa por `limitarTentativas.js`: 10 tentativas **malsucedidas** por IP a cada 15 min (`skipSuccessfulRequests`, para que a loja inteira num IP só não esgote a cota trabalhando). O contador é em memória — reiniciar a API zera.

`app.set('trust proxy', 1)` no `app.js` existe por causa disso: sem ele, `req.ip` é o do proxy e o limite contaria todo mundo como um visitante. É `1`, não `true` — `true` aceitaria qualquer `X-Forwarded-For` forjado.

**Nenhuma resposta carrega `detalhe: erro.message`.** O `responderErro` manda a exceção para `console.error` e devolve só a mensagem amigável; `health.controller.js` (rota pública) e `assistente.controller.js` fazem o mesmo à mão. Ao escrever controller novo, use `responderErro` — não reintroduza o campo `detalhe`.

O `app.js` tem, no fim, um 404 em JSON e um middleware de erro de 4 argumentos. Eles são rede de segurança para o controller que esquecer o `try/catch`, não substituto dele.

## Schema (`docs/schema.sql`)

PKs são `UUID DEFAULT gen_random_uuid()`. Sem ferramenta de migração: alterar o schema exige `docker compose down -v`.

Pontos com intenção embutida:
- `venda.cliente_id` anulável = venda "Consumidor" (RF03). `usuario_id` é `NOT NULL` (RF13).
- `item_venda.produto_nome` e `preco_unitario` são cópias congeladas (RF12) — não normalize isso.
- `produto.preco_venda` é apenas **sugestão**; o preço real vive no item, porque negociação é regra no ramo.
- `ON DELETE CASCADE` só em `item_venda`, `refresh_token` e `pagamento_fiado`. As demais FKs barram o delete de propósito: é o que preserva o histórico.

Tabelas de fases futuras (estoque, movimento_estoque, previsão, auditoria) **não existem** — não escreva contra elas.
