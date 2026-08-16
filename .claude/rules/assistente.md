---
paths:
  - "BackEnd/src/assistente/**/*.js"
  - "FrontEnd/src/pages/Assistente.jsx"
  - "FrontEnd/src/services/assistente.js"
---

# O Zé — assistente de IA

O nome do assistente é **Zé**. Ele fala como bom balconista veterano: direto, sem jargão, respostas curtas, valores em `R$ 1.234,56`.

## Fluxo de uma pergunta

```
Assistente.jsx → POST /api/assistente/perguntar { pergunta, historico, confirmacao? }
  → controller: valida entrada, valida o token ANTES do 503, checa a chave
  → service: monta system prompt + histórico (máx. 20 msgs) e roda o loop
      ┌─ chamarModelo(mensagens, tools filtradas pelo papel)
      │  sem tool_calls → resposta final
      │  com tool_calls → executarTool() → resultado entra como role:'tool' → repete
      └─ teto de 4 iterações; ao estourar, pede uma resposta final sem tools
  → { resposta, fontes[], acao_pendente? }
```

`fontes` são atalhos para a tela que tem o dado completo ("o chat responde, a tela confirma"). Cada tool declara a sua.

O servidor **não guarda sessão**: o histórico vem do cliente a cada requisição.

## Anatomia de uma tool

```js
minha_tool: {
  escreve: true,          // marca escrita: o service é mais rigoroso com args malformados
  confirma: true,         // exige confirmação em dois passos → precisa de preparar()
  papeis: ['dono'],       // ou '*' para qualquer autenticado
  fonte: { rotulo: 'Produtos', para: '/produtos' },
  schema: { name, description, parameters },  // formato function calling da OpenAI
  async preparar(args, usuario) { /* resolve, simula, NÃO grava */ },
  async executar(args, usuario) { /* grava */ },
}
```

`description` do schema é lida pelo modelo: escreva-a com exemplos de fala real ("vende 10 sacos de cimento pro João no fiado"), não com jargão de API.

Regras ao criar tool:
- **Leitura** → em `tools.js`. **Escrita** → arquivo próprio por domínio, entra por spread.
- Falha vira **retorno** (`{ ok: false, erro }`), não exceção — o modelo precisa do texto para explicar em português. Use `protegido()` de `tools.escrita.comum.js`.
- Detalhe de SQL nunca chega ao modelo. Erro inesperado vira mensagem genérica + `console.error`.

## O formato do retorno é decisão de produto

Criar/editar executam direto, sem confirmação — o usuário confere lendo o que a tool devolveu. Por isso o retorno **não é um "ok", é a ficha do que ficou gravado**:

```js
{ ok: true, acao: 'criado', entidade: 'produto',
  registro: /* a linha do RETURNING, sem editar */,
  resumo: 'Cimento CP-II 50kg · R$ 42,00 · saco · sem categoria' }
```

**Regra inegociável: o `registro` vem do `RETURNING` do banco, nunca dos argumentos que o modelo mandou.** Um INSERT aplica defaults, trunca VARCHAR, normaliza — redigir a partir do que o modelo *achou* que enviou confirma a intenção, não o fato.

**Campos vazios aparecem explícitos no `resumo`** ("sem categoria", "sem preço de custo"). É justamente o campo omitido que a pessoa precisa ver para perceber que faltou algo. O prompt manda o modelo transcrever o `resumo` sem reescrever.

Em edição, use `diferencas()` (`tools.escrita.comum.js`) — ela compara o que o **banco** gravou antes/depois, porque `NUMERIC` volta como string e comparar `"45.00"` com `45` marcaria alteração onde não houve.

## Confirmação em dois passos

Quais tools confirmam hoje, e por quê:

| Tool | Confirma? | Razão |
|---|:---:|---|
| `criar_produto`, `editar_produto`, `criar_cliente`, `editar_cliente` | não | barato de corrigir; confirmar transformaria o chat no formulário que ele evita |
| `registrar_pagamento_fiado` | não | dinheiro no balcão não espera |
| `reativar_produto` | não | não destrói nada; ter volta fácil é o ponto |
| `desativar_produto` | sim | some da tela de venda |
| `criar_venda` | sim | mexe em dinheiro, é multi-entidade, e se for fiado vira cobrança fantasma |
| `cancelar_venda` | sim (só dono) | tira dinheiro do faturamento; é cicatriz, não desfazer |

Permissão das tools de escrita: **produto é só do `dono`** (preço é margem, e margem é decisão de dono) e `cancelar_venda` também. Cliente, fiado e `criar_venda` são `'*'` — é o trabalho do balcão. Quase todas as tools de leitura do painel são `['dono']`; `produtos_mais_vendidos`, `fiados_em_aberto` e `buscar_cliente` são abertas.

Mecânica: `preparar()` devolve `{ precisa_confirmar: true, args, rotulo, resumo }` → o **service** assina `args` com HMAC (`assinarAcao`) e devolve `acao_pendente` → o front mostra o botão → volta em `confirmacao` → `verificarAcao` valida assinatura, expiração (5 min) e `usuario_id` → executa **antes de qualquer chamada ao modelo**.

Detalhes que existem por um motivo:
- O **token carrega os args já resolvidos**. O passo 2 não refaz a busca por nome, sob risco de resolver para outro registro.
- O modelo **nunca vê o token** — só o `resumo`, para redigir a pergunta.
- Comparação de assinatura é `timingSafeEqual`; `===` vazaria pelo tempo quantos bytes bateram.
- A validação de expiração vem antes da de dono: dizer "não é sua" primeiro vazaria que o token existe.
- A permissão é revalidada na confirmação — o papel pode ter sido rebaixado entre a proposta e o clique.

Em `criar_venda`, a confirmação não é um "tem certeza?": é a **nota da venda** montada por `simularVenda()`, lida como um papel de balcão. `simularVenda` e `criarVenda` fazem a mesma conta de propósito — se divergissem, a nota mentiria.

## O lado do front (`Assistente.jsx`)

- O token vive **só no objeto da mensagem**, invisível, e sai dali apenas pelo clique. Confirmar dispara `enviar('Sim, pode fazer.', token)`: o texto é para a conversa fazer sentido; **quem autoriza é o token**.
- **Só a proposta mais recente tem botões ativos** (`indiceUltimaProposta`), e ela continua clicável mesmo que a pessoa digite outra coisa depois. Amarrar isso a "é a última mensagem" fazia os botões sumirem ao digitar, deixando a nota órfã na tela (corrigido em `b12dbbf`). Propostas antigas ficam desabilitadas com "Peça de novo se ainda quiser".
- O histórico enviado ao back é montado **antes** de acrescentar a pergunta atual, e **mensagens de erro são filtradas** (`!m.erro`) — texto de falha não deve virar contexto do modelo.
- A altura do chat é `h-full`, nunca `100vh`: a topbar e o padding do main já foram gastos, e `100vh` criava rolagem dupla na janela.
- O rodapé fixo lembra que "o Zé responde com base nos seus dados; confira na tela correspondente" — é a contraparte visual do princípio "a tela comprova". Não remova.

## Resolução de nome (`resolver.js`)

`resolverProduto`/`resolverCliente` aceitam `id` **ou** `busca`. O `id` tem prioridade: quando ele vem, a pessoa já escolheu no turno anterior.

- 0 resultados → erro legível.
- 1 → resolve.
- N → `{ falha: { precisa_escolher: [{ id, rotulo }] } }`, **sem gravar nada**. Nome digitado exato desempata ("Marcos" ganha de "Marcos Antônio"). Máximo de 5 opções: mais que isso não é pergunta de balcão, é lista.

O `rotulo` precisa carregar o que **distingue**: dois cimentos só se separam por preço e unidade; dois Marcos, pelo telefone.

Aceitar `id` além de `busca` é o que fecha o segundo turno da conversa — sem isso o Zé pergunta em laço eterno. O modelo às vezes manda o **número da lista** ("1", "2") em vez do UUID; `PARECE_UUID` intercepta isso e devolve instrução clara, senão o SQL estoura com `22P02` e a pessoa lê "não consegui agora".

## Ao mexer no system prompt

Cada bloco (`LANÇANDO VENDA`, `QUANDO O NOME NÃO É ÚNICO`, `RECEBENDO PAGAMENTO DE FIADO`…) foi escrito contra um erro observado do modelo. Exemplos vivos:

- "nunca escreva uma nota de venda de cabeça" — o modelo redigia notas sem botão, com números que ninguém conferiu.
- "pergunte UMA VEZ para qual cliente" — venda gravada como Consumidor some do histórico e do ranking, e não dá para corrigir depois.
- "o `id` é o código comprido, NUNCA o número da lista".
- "nunca diga que cadastrou sem ter recebido `ok: true`".

Não enxugue esses blocos por concisão. Se remover um, saiba qual erro está reabrindo.

## Testar sem gastar API

`BackEnd/scripts/testar-tools.mjs` chama `executarTool` direto, simulando o que o modelo mandaria. Cobre service, validação, permissão por papel e o ciclo de confirmação — fica de fora só "o modelo escolheu a tool certa?". Precisa do banco de pé e de ao menos um usuário real (as FKs de autoria).

```bash
npm test --prefix BackEnd
node scripts/testar-tools.mjs criar_produto '{"nome":"X","unidade":"saco","preco_venda":10}'
```
