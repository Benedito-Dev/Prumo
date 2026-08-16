---
paths:
  - "FrontEnd/**/*.jsx"
  - "FrontEnd/**/*.js"
  - "FrontEnd/**/*.css"
---

# FrontEnd — mapa e convenções

React 19 + Vite + React Router 7 + Tailwind v4 + `lucide-react`. Sem TypeScript, sem gerenciador de estado global (só Context para auth e tema), sem biblioteca de UI, sem lib de gráficos (`GraficoArea`/`GraficoBarras` são SVG à mão).

## Estrutura

```
src/
  auth/       AuthContext (sessão) · RotaProtegida
  theme/      ThemeContext (claro/escuro em localStorage)
  components/ design system, exportado pelo barril index.js · LayoutApp
  pages/      uma por rota (Painel, NovaVenda, Vendas, Produtos, Clientes,
              ClienteDetalhe, Fiados, Assistente, Usuarios, UsuarioDetalhe, Login)
  services/   um por domínio; tudo passa por api.js
  utils/      formato.js · ditado (useDitado, useVocabulario, corrigirDitado)
```

Toda rota interna é embrulhada em `<RotaProtegida>` (`App.jsx`) e a tela usa `<LayoutApp titulo=… periodo=… acao=…>`. O menu lateral vira drawer abaixo de `lg`.

## Camada de API

**Nunca chame `fetch` direto numa página.** Sempre `services/<dominio>.js` → `api.js`. (Exceção única hoje: `Painel.jsx` importa `api` para um `api.get('/vendas?status=concluida')` que nenhum service cobre. Não replique — crie o método no service.)

`api.js` cuida sozinho de: injetar o Bearer, renovar em 401 (uma vez, com `refreshPromise` compartilhado para não disparar refresh em paralelo) e repetir a requisição. Falhou o refresh → dispara logout. **Não escreva tratamento de 401 nas telas.**

Erros chegam como `Error` com a mensagem do campo `erro` da API — mostre-a ao usuário (ela foi escrita para ser lida por quem não é técnico).

O access token vive em módulo, em memória. Nunca o coloque em `localStorage`/`sessionStorage`.

## Como uma página é escrita aqui

Padrão observado em todas as 11 páginas — siga-o ao criar a próxima:

- **Sub-componentes locais, no mesmo arquivo, abaixo do `export default`**, separados por `// ---------- Nome ----------`. `NovaVenda.jsx` tem `BuscaCliente`, `BuscaProduto`, `LinhaItem`, `SeletorQuantidade`, `ModalNovoCliente`. Só sobe para `components/` o que **duas páginas** usam de fato.
- **Estado local com `useState`** e uma função `carregar()` chamada em `useEffect`. Requisições independentes vão juntas em `Promise.all`. Não há react-query nem cache global.
- **Estados de carga e vazio são explícitos**, nunca uma tela em branco: `carregando` retorna cedo com "Carregando…", e a lista vazia usa `EstadoVazio` ou um texto que diz o que fazer em seguida.
- **Busca com debounce** de 200–250 ms num `setTimeout` com `clearTimeout` no cleanup. `BuscaCliente` só busca a partir de 2 caracteres.
- **Modal**: overlay `fixed inset-0 z-50 bg-black/40` que fecha no clique, com `onClick={(e) => e.stopPropagation()}` no cartão interno, e `max-h-[90vh] overflow-y-auto` para rolar em tela baixa.
- **Confirmação destrutiva é modal na tela — nunca `window.confirm`.** Não existe uma única chamada a `confirm()` no projeto; não introduza a primeira.
- **Erro vira estado (`setErro`) mostrado em `text-prumo`**, com a mensagem que veio da API. Nada de `alert()` nem de engolir o erro em silêncio.

## Design system

Tokens em `index.css` (`@theme` do Tailwind v4 — **não existe `tailwind.config.js`**). Cores neutras apontam para variáveis CSS que trocam entre `:root` e `.dark`; as de marca são fixas.

| Classe | Uso |
|---|---|
| `bg-concreto-fundo` | fundo da página |
| `bg-superficie` | cartões |
| `bg-concreto` | trilhos e realces sutis |
| `text-grafite` / `text-grafite-medio` | texto principal / secundário |
| `border-linha` | bordas |
| `text-prumo` (`#c42e1e`) | cor assinatura, alertas |
| `bg-trena` | ação primária |
| `text-nivel` (`#1b7a46`) | estados positivos |

**Nunca use utilitários de cor crua do Tailwind** (`bg-white`, `text-gray-500`, `border-slate-200`): eles não trocam no tema escuro. Se falta um token, adicione-o ao `@theme` em vez de contornar.

> Atenção: `--color-trena` hoje é **teal `#0e7c86`**, não o amarelo `#FFC400` que o README e o design system HTML descrevem. O CSS é a fonte da verdade; a documentação está defasada nesse ponto.

Tipografia: `font-ui` (Inter) para tudo; `font-display` (Archivo Black) só para a marca.

Componentes: importe pelo barril — `import { Botao, Campo, Kpi, Aviso, EstadoVazio } from '../components'`. `Botao` tem as variantes `primario` (64px, largura total) · `secundario` · `perigo` · `texto`, e a regra é **uma ação primária por tela**.

## Responsivo (é requisito, não polimento)

O balcão raramente tem PC livre. Prefira soluções sem breakpoint: grid `auto-fit`/`minmax`, tabela que vira cartão empilhado no mobile. Alvos de toque de **56–64px**. Modais precisam rolar em tela baixa. Em `NovaVenda`, a barra de total é fixa no rodapé.

## Formatação

Sempre `utils/formato.js` — `moeda`, `moedaCurta` (KPI grande, sem centavos), `numero`, `quantidade`. Nunca monte `R$` na mão nem chame `toLocaleString` solto na tela.

## Ditado por voz

`useDitado` usa a Web Speech API nativa (Chrome/Edge/Safari; no Firefox `ditadoSuportado` é `false` e o microfone simplesmente não aparece — mantenha essa degradação).

O reconhecimento não conhece nome de catálogo ("Vergalhao 10mm") e chuta pelo som. Quem conhece é o banco: `useVocabulario` traz nomes de produtos e clientes, e `corrigirDitado.js` cruza a transcrição com eles.

Ao mexer em `corrigirDitado.js`:
- É **módulo puro** — sem React, sem rede, sem DOM. É o que permite testá-lo em Node sem microfone. Mantenha assim.
- Rode `node FrontEnd/src/utils/corrigirDitado.test.mjs` (59 testes) e mostre a saída.
- O corte de similaridade é `0.78` e nunca foi calibrado com voz real (só com fixtures supostas). Trocar esse número exige medição, não intuição.
- **Nome ambíguo não é corrigido** de propósito: deixa como falado e o resolvedor do Zé pergunta. Corrigir para o nome errado é pior que não corrigir — o texto errado a pessoa vê, o trocado ela não percebe.
- O texto parcial (enquanto a pessoa fala) **não** passa pelo corretor: trocar nome no meio da fala faria o texto dançar na tela.

## Recibo da venda

`utils/recibo.js` é **módulo puro** (sem React, sem DOM, sem rede) — como o corretor de ditado, e pelo mesmo motivo: dá para testá-lo em Node sem navegador nem impressora. Rode `node FrontEnd/src/utils/recibo.test.mjs` (42 testes) ao mexer.

- `reciboTermico` mira **32 colunas** (bobina de 80mm em fonte monoespaçada padrão). A suíte falha se qualquer linha estourar — é o teste que pega nome de produto longo.
- **Todo valor vem da venda gravada, nunca recalculado na tela.** O item traz `subtotal` congelado do banco (RF12); refazer a conta abriria espaço para o papel discordar do sistema, e o papel é a versão que vale numa discussão de balcão.
- `moeda()` devolve espaço **não-quebrável** (U+00A0) depois do "R$". Ele é invisível na tela, conta no alinhamento e sai como lixo em impressora térmica — por isso o recibo o normaliza.
- Nome de cliente longo é **quebrado em linhas, não truncado** (`linhaDuplaOuQuebrada`): é o recibo dele.
- Recibo de fiado diz "valor em aberto"; sem isso o comprovante pareceria quitação.

`components/AcoesRecibo.jsx` é usado por **duas** telas (confirmação em `NovaVenda` e detalhe em `Vendas`) — por isso subiu para `components/`. Ele abre uma janela própria com `<pre>` monoespaçado em vez de `window.print()` na página: menu, cartões e cores não têm o que fazer numa bobina. Usa `textContent`, nunca `innerHTML` — nome de produto com `<` ou `&` viraria marcação.

Venda cancelada **não** oferece recibo: o papel diria que a compra aconteceu.

Os dados do cabeçalho vêm de `GET /api/loja` (variáveis `LOJA_NOME`, `LOJA_TELEFONE`, `LOJA_ENDERECO`). Se a requisição falhar, o recibo sai com a marca PRUMO — a identificação da loja nunca pode impedir o cliente de sair com o papel.

## Lint

`npm run lint` (oxlint) — configurado **só no FrontEnd**, não no BackEnd. `react/rules-of-hooks` é erro.

`FrontEnd/dist/` existe no disco mas está no `.gitignore` e **não é versionado**: é resto de build local. Nunca edite nem versione.
