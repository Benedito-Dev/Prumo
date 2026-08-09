<div align="center">

# 🎙️ DITADO NO PRUMO — PLANO DE AÇÃO

### *O navegador não conhece o seu depósito. O seu sistema, sim.*

**Corrigir a transcrição por voz usando o catálogo real, sem custo e sem espera**

<br>

![Status](https://img.shields.io/badge/status-planejado-C42E1E?style=for-the-badge)
![Custo](https://img.shields.io/badge/custo-R$_0-1B7A46?style=for-the-badge)
![Latência](https://img.shields.io/badge/lat%C3%AAncia-0_ms-0E7C86?style=for-the-badge)

<br>

`📄 Documento vivo` · `📅 Criado em 09/08/2026`

</div>

---

## 📋 Sumário

- [🎯 O problema](#-o-problema)
- [🧪 As opções, comparadas](#-as-opções-comparadas)
- [🏛️ A solução em três camadas](#️-a-solução-em-três-camadas)
- [🗂️ Mudanças arquivo por arquivo](#️-mudanças-arquivo-por-arquivo)
- [🪜 Etapas](#-etapas)
- [⚠️ Riscos e limites](#️-riscos-e-limites)
- [🚫 Fora de escopo](#-fora-de-escopo)
- [✅ Como saber que funcionou](#-como-saber-que-funcionou)

---

## 🎯 O problema

O ditado usa a Web Speech API do navegador (`FrontEnd/src/utils/useDitado.js`),
que é o mesmo motor do Google/Windows. Ele é bom em português corrente e
**péssimo em nome próprio de depósito** — porque nunca ouviu falar deles.

O vocabulário real deste sistema hoje:

| Produtos | Clientes |
|---|---|
| Areia media · `m3` | Construtora Vale Verde |
| Cimento CP-II 50kg · `saco` | Jose Ferreira |
| Cimento Mizu 50kg · `saco` | Marcos Andrade |
| Vergalhao 10mm · `barra` | |

Erros típicos, todos por semelhança sonora:

| Falado | Transcrito | Tipo do erro |
|---|---|---|
| vergalhão | `ver galhão` | palavra quebrada em duas |
| CP-II | `cepe dois` · `CP 2` | sigla soletrada |
| Jose Ferreira | `josefa reira` | fronteira de palavra errada |
| trinta e nove e noventa | `trinta e nove e noventa` | número por extenso |

> 🔍 **A observação que sustenta o plano:** o Zé já conhece esses nomes — ele
> consulta o banco. Quem não conhece é o reconhecimento de voz. Então o
> conserto não é ouvir melhor: é **cruzar o que foi ouvido com o que existe**.

### O que já está lá e não é usado

`useDitado.js:36` lê `evento.results[i][0].transcript` — o `[0]` é a **primeira**
hipótese. O navegador tem outras, e elas são descartadas. Basta pedir:
`maxAlternatives = 5`. Custo zero.

---

## 🧪 As opções, comparadas

| | Correção local | Correção pela IA |
|---|---|---|
| **Latência** | **0 ms** — roda na máquina | 1–2 s por ditado |
| **Custo** | **R$ 0** | ~1 centavo por ditado |
| **Offline** | **funciona** | não funciona |
| **Erro muito torto** | pode não pegar | pega quase tudo |

**Decisão: correção local.** O fator que decide é a latência. O Prumo tem meta
declarada de **venda em 30 segundos** (README) e o público atende *em pé, no
balcão, com o cliente esperando*. Dois segundos de espera a cada frase ditada
é atrito no lugar mais sensível do produto.

> ⚠️ **Registro de erro meu, para não se repetir:** a primeira recomendação
> deste plano foi a correção pela IA. Estava errada — eu não tinha verificado
> que a Web Speech API já entrega alternativas de graça. O usuário desconfiou,
> e a desconfiança estava certa.

---

## 🏛️ A solução em três camadas

Cada camada só age no que a anterior não resolveu. Nenhuma chama a rede.

```
  fala
    ↓
  ┌──────────────────────────────────────────┐
  │ 1. ALTERNATIVAS  (maxAlternatives = 5)   │  navegador, de graça
  │    "ver galhão dez" | "vergalhão dez"    │
  └──────────────────┬───────────────────────┘
                     ↓
  ┌──────────────────────────────────────────┐
  │ 2. CATÁLOGO      (produtos + clientes)   │  já em memória
  │    parecido com "Vergalhao 10mm"? → sim  │
  └──────────────────┬───────────────────────┘
                     ↓
  ┌──────────────────────────────────────────┐
  │ 3. NÚMEROS       (regra fixa do pt-BR)   │  sem IA
  │    "trinta e nove e noventa" → 39,90     │
  └──────────────────┬───────────────────────┘
                     ↓
              texto corrigido
```

### Camada 1 — Alternativas

Uma linha em `useDitado.js`. Passa a considerar as 5 hipóteses do navegador em
vez de só a primeira.

### Camada 2 — Catálogo

O coração. Compara cada trecho falado com os nomes que **existem no banco**.

Duas regras que o caso real exige:

1. **Normalizar antes de comparar** — sem acento, minúsculo, sem pontuação.
   `"Vergalhao"` no banco vs. `"vergalhão"` falado precisam bater.
2. **Testar também janelas de 2 e 3 palavras** — `"ver galhão dez"` só casa com
   `Vergalhao 10mm` se as três forem consideradas juntas. Comparar palavra a
   palavra nunca acha.

Semelhança por **distância de edição** (Levenshtein), com corte conservador:
só substitui acima de ~78% de similaridade. Abaixo disso, **deixa como está** —
trocar por engano é pior que não trocar, porque o texto errado ao menos a
pessoa vê e corrige.

### Camada 3 — Números

Regra fixa, sem IA:
- `"dez"` → `10` · `"trinta e nove"` → `39`
- `"trinta e nove e noventa"` → `39,90`
- `"dez reais"` → `10`

---

## 🗂️ Mudanças arquivo por arquivo

### 🆕 Criar — 2 arquivos

| Arquivo | Conteúdo | Linhas ~ |
|---|---|---:|
| `FrontEnd/src/utils/corrigirDitado.js` | `normalizar`, `similaridade`, `corrigirPorCatalogo`, `numerosPorExtenso`, `corrigir` | 140 |
| `FrontEnd/src/utils/useVocabulario.js` | Hook que carrega produtos + clientes uma vez e mantém em memória | 40 |

### ✏️ Alterar — 2 arquivos

| Arquivo | O que muda |
|---|---|
| `FrontEnd/src/utils/useDitado.js` | `maxAlternatives = 5`; `onresult` passa as alternativas para o corretor; aceita um `vocabulario` opcional |
| `FrontEnd/src/pages/Assistente.jsx` | Passa o vocabulário ao `useDitado` |

### ⛔ Não mexer

Backend inteiro · o Zé e suas tools · qualquer rota HTTP. **Isto é só front.**

> 💡 O vocabulário vem de `GET /produtos` e `GET /clientes`, que já existem.
> Nenhum endpoint novo.

---

## 🪜 Etapas

| # | Etapa | Entrega | Verificação | ⏱️ |
|:---:|---|---|---|---:|
| **1** | 🔤 **Corretor puro** | `corrigirDitado.js` + testes de mesa com os casos reais da tabela acima | Roda em Node, sem navegador: `"ver galhão dez"` → `Vergalhao 10mm` | **1h** |
| **2** | 📚 **Vocabulário** | `useVocabulario.js`; carrega uma vez ao abrir a tela | Console mostra os 4 produtos e 3 clientes | **30min** |
| **3** | 🎙️ **Ligar no ditado** | `maxAlternatives`; corretor plugado no `onresult` | Ditar no Zé e comparar com o de antes | **1h** |
| **4** | 🔍 **Calibrar** | Ajustar o corte de similaridade com ditados reais | 10 frases do dia a dia; nenhuma substituição errada | **1h** |

**Total: 3h30.**

### Por que esta ordem

1. **O corretor primeiro, e isolado.** É lógica pura — testável sem microfone,
   sem navegador e sem banco. Se o algoritmo estiver errado, descobre-se aqui,
   onde o teste custa segundos.
2. **Calibrar por último e com voz real.** O corte de similaridade é o único
   número que não dá para escolher na teoria: depende de como o navegador erra
   na prática, com a sua voz e o seu microfone.

---

## ⚠️ Riscos e limites

| | Risco | Mitigação |
|:---:|---|---|
| 🔴 | **Corrigir para o nome errado.** Com dois cimentos no catálogo, "cimento" pode virar o CP-II quando era o Mizu | Só substitui acima do corte. **Nome ambíguo não é corrigido** — deixa como falado e o resolvedor do Zé (Fatia 4) pergunta qual. Já existe e funciona |
| 🟡 | **Catálogo grande deixa lento** | Hoje são 7 nomes. O algoritmo é O(n) por janela; com centenas ainda é instantâneo. Se um dia passar de ~2 mil, indexar por primeira letra |
| 🟡 | **Vocabulário velho** | Produto cadastrado agora não é reconhecido até recarregar. Aceitável: recarrega ao abrir a tela |
| ⚪ | **Firefox não tem a API** | Já tratado: o microfone não aparece (`ditadoSuportado`) |

---

## 🚫 Fora de escopo

- **Trocar o motor de reconhecimento** (Whisper e afins). Voltaria a ter custo,
  latência e dependência de rede — exatamente o que este plano evita.
- **Ditado em outras telas** (Nova Venda, busca de produto). O corretor fica
  pronto para isso, mas ligar é trabalho próprio.
- **Treinar o reconhecimento com a voz do usuário.** A Web Speech API não expõe.
- **Corrigir gramática ou pontuação.** O Zé entende texto torto; o que ele não
  entende é nome errado.

---

## ✅ Como saber que funcionou

Antes e depois, com as mesmas 10 frases ditadas em voz alta:

| Frase típica | Hoje | Meta |
|---|---|---|
| *"vende dez vergalhão pro marcos andrade no fiado"* | nome do produto e do cliente errados | os dois certos |
| *"cadastra cimento mizu a trinta e nove e noventa"* | valor por extenso | `39,90` |
| *"quanto o jose ferreira deve"* | `josefa reira` | `Jose Ferreira` |

**Critério de aprovação:** nenhuma substituição **errada** em 10 frases. Deixar
de corrigir é aceitável; corrigir para o nome errado, não — porque o texto
errado a pessoa vê, e o trocado ela não percebe.

> 📌 **Pendente do usuário:** um exemplo real do que foi falado vs. o que
> apareceu escrito. O corte de similaridade e o formato do erro (palavra
> quebrada? juntada? trocada?) dependem disso. Sem esse dado, a Etapa 4 vira
> chute.
