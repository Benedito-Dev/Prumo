# 🔌 Contrato das tools de escrita do Zé

> **Documento de coordenação.** Fixado antes das Fatias 2 e 5, que estão sendo
> implementadas **em paralelo**. Tudo aqui é decisão tomada — não reabra sem
> falar com a outra frente, porque os dois lados dependem destes formatos.
>
> `📅 09/08/2026` · Complementa [Prumo-Ze-Escrita-Plano.md](Prumo-Ze-Escrita-Plano.md)

---

## 1. Um arquivo de tools por domínio

O plano original previa um `tools.escrita.js` único (~480 linhas). **Mudado:**
com duas frentes em paralelo, arquivo único é conflito de merge garantido.

| Arquivo | Dono | Tools |
|---|---|---|
| `assistente/tools.produto.js` | Fatia 2 | `criar_produto`, `editar_produto` |
| `assistente/tools.cliente.js` | Fatia 2 | `criar_cliente`, `editar_cliente` |
| `assistente/tools.fiado.js` | Fatia 5 | `registrar_pagamento_fiado` |

Cada arquivo exporta um objeto no mesmo formato do `TOOLS` de `tools.js`:

```js
export const TOOLS_PRODUTO = {
  criar_produto: { schema, papeis, fonte, executar },
};
```

### O ponto de encontro (`tools.js`)

**Único lugar que as duas frentes tocam.** Faça a alteração mínima:

```js
import { TOOLS_PRODUTO } from './tools.produto.js';
import { TOOLS_CLIENTE } from './tools.cliente.js';
import { TOOLS_FIADO }   from './tools.fiado.js';

export const TOOLS = {
  // ...as 7 tools de leitura existentes, intactas...
  ...TOOLS_PRODUTO,
  ...TOOLS_CLIENTE,
  ...TOOLS_FIADO,
};
```

> ⚠️ Se a sua frente terminar antes da outra, o import do arquivo que ainda não
> existe quebra o boot. **Adicione só o seu**; quem chegar depois soma o dele.

---

## 2. O formato do "registro" — a decisão de produto mais importante

Criar e editar **executam direto**, sem confirmação prévia. O usuário confere
lendo o que a tool devolveu. Por isso o retorno não é um "ok": é a **ficha do
que ficou gravado**.

### Regra inegociável

**O registro vem do `RETURNING` do banco, nunca dos argumentos que o modelo
mandou.** Um `INSERT` aplica defaults, trunca `VARCHAR`, normaliza. Se o
registro for redigido a partir do que o modelo *achou* que enviou, ele confirma
a intenção — não o fato.

Os services da Fatia 1 já devolvem a linha do banco. **Devolva esse objeto.**

### Formato de retorno das tools de CRIAÇÃO

```js
{
  ok: true,
  acao: 'criado',
  entidade: 'produto',              // produto | cliente | pagamento_fiado
  registro: { ...linha do banco },  // objeto do RETURNING, sem editar
  resumo: 'Cimento CP-II 50kg · R$ 42,00 · saco · sem categoria',
}
```

`resumo` é uma linha curta, em português, para o modelo transcrever.
**Campos não informados aparecem explicitamente** ("sem categoria", "sem
telefone") — é justamente o que o usuário nota e corrige.

### Formato de retorno das tools de EDIÇÃO

```js
{
  ok: true,
  acao: 'editado',
  entidade: 'produto',
  registro: { ...linha do banco depois },
  alteracoes: [
    { campo: 'preco_venda', de: 42.0, para: 45.0, rotulo: 'Preço' },
  ],
  resumo: 'Preço do Cimento CP-II 50kg: R$ 42,00 → R$ 45,00',
}
```

`alteracoes` traz **só o que mudou de fato**. Se nada mudou, devolva
`alteracoes: []` e um resumo dizendo isso — não invente alteração.

### Erros

Não lance: **devolva**. O modelo precisa explicar em português.

```js
{ ok: false, erro: 'Unidade inválida. Use: saco, milheiro, …' }
```

Capture `ErroNegocio` (de `config/erros.js`) e use `erro.message`, que já é
escrito para gente ler. Erro inesperado vira mensagem genérica — nunca vaze
`detalhe` de SQL para o modelo.

---

## 3. Edição usa merge parcial. Sempre.

`atualizarProdutoParcial` e `atualizarClienteParcial` já existem na Fatia 1 e
**são as únicas que as tools podem chamar** para editar.

As versões totais (`atualizarProduto` / `atualizarCliente`) zeram todo campo
omitido — é o contrato do `PUT` que a tela usa, e é destrutivo vindo de IA:
*"muda o preço do cimento para 45"* apagaria categoria, custo e imagem.

Há teste cobrindo isso em `scripts/testar-tools.mjs`. **Não afrouxe.**

---

## 4. Como a tool acha o registro pelo nome

Nesta rodada, a busca é **simples e conservadora**. O resolvedor completo é a
Fatia 4 — não o antecipe.

Regra: busca por nome parcial, e então

| Resultados | O que a tool devolve |
|---|---|
| exatamente 1 | segue a operação |
| 0 | `{ ok: false, erro: 'Não achei nenhum produto com "cimento".' }` |
| 2 ou mais | `{ ok: false, precisa_escolher: [{ id, rotulo }], erro: 'Achei 3 …' }` |

**Nunca escolha por conta própria** quando houver mais de um. Ambiguidade é
pergunta, não chute — e uma escolha errada aqui grava dado errado em silêncio.

---

## 5. Permissões (do plano, seção 🔐)

| Tool | dono | vendedor |
|---|:---:|:---:|
| `criar_produto` | ✅ | ❌ |
| `editar_produto` | ✅ | ❌ |
| `criar_cliente` | ✅ | ✅ |
| `editar_cliente` | ✅ | ✅ |
| `registrar_pagamento_fiado` | ✅ | ✅ |

No catálogo: `papeis: ['dono']` ou `papeis: '*'`.

---

## 6. System prompt — como não brigar pelo mesmo trecho

`assistente.service.js` tem um único `systemPrompt()`. Para as duas frentes não
editarem as mesmas linhas, **cada uma acrescenta seu próprio bloco** no fim,
antes de `REGRA MAIS IMPORTANTE`:

- **Fatia 2** insere o bloco `ESCREVENDO NO SISTEMA` (regras gerais de escrita +
  como transcrever o registro).
- **Fatia 5** insere o bloco `RECEBENDO PAGAMENTO DE FIADO` (a cascata).

Não reescreva o bloco da outra frente. Se precisar de algo genérico que as duas
usam, ponha em `ESCREVENDO NO SISTEMA` e avise.

---

## 7. Verificação

Sem `OPENROUTER_API_KEY`, tool calling não roda. Cada frente **estende**
`scripts/testar-tools.mjs`:

- Registre suas funções no objeto `FUNCOES` (para a CLI).
- Acrescente um bloco próprio na `suite()`, com `console.log` de seção.
- **Não altere os blocos existentes** — 32 casos já passam e são a rede da
  Fatia 1.
- Toda entidade criada em teste tem que ser removida no fim. O banco é o do
  usuário, com dados reais.

Rode: `docker exec prumo-api npm test`
